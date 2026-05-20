const express = require('express');
const router = express.Router();
const WarrantyRequest = require('../models/WarrantyRequest');
const ServiceJob = require('../models/ServiceJob');
const { authenticateToken } = require('../middleware/auth');

function addYears(dateInput, years) {
    const d = new Date(dateInput);
    d.setFullYear(d.getFullYear() + years);
    return d;
}

function isWarrantyValid(originalInvoiceDate) {
    if (!originalInvoiceDate) return false;
    const validUntil = addYears(originalInvoiceDate, 10);
    return { valid: validUntil > new Date(), validUntil };
}

function buildWarrantyJobPayload(requestDoc, items, username) {
    // رقم أمر التشغيل: WAR-<jobOrder أو آخر 6 أحرف من originalJobId>
    const jobRef = requestDoc.originalJobOrder
        || String(requestDoc.originalJobId || '').slice(-6).toUpperCase();
    return {
        jobOrder: `WAR-${jobRef}-${Date.now().toString().slice(-4)}`,
        type: 'WARRANTY',
        sourceType: 'WARRANTY_REQUEST',
        sourceId: requestDoc._id,
        status: 'PENDING_OPS',
        workflowStatus: 'AwaitingTechnician',
        customer: requestDoc.customerId || '',
        customerName: requestDoc.customerName || '',
        customerPhone: requestDoc.customerPhone || '',
        items: Array.isArray(items) ? items : [],
        warrantyInfo: {
            originalInvoiceId: requestDoc.originalInvoiceId || '',
            originalJobId: requestDoc.originalJobId || '',
            complaintDate: requestDoc.complaintDate || new Date().toISOString(),
            complaint: requestDoc.complaint || '',
            warrantyValidUntil: requestDoc.warrantyValidUntil || null
        },
        createdBy: username || ''
    };
}

router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            originalInvoiceId,
            originalJobId,
            originalJobOrder,   // رقم أمر التشغيل المقروء (مثل JOB-001)
            customerId,
            customerName,
            customerPhone,
            complaint,
            originalInvoiceDate,
            items
        } = req.body;

        if (!originalInvoiceId || !originalJobId || !customerName || !complaint) {
            return res.status(400).json({ message: 'البيانات الأساسية مطلوبة: رقم الفاتورة، رقم أمر التشغيل، اسم العميل، الشكوى.' });
        }

        // originalInvoiceDate اختياري — لو مش موجود نستخدم تاريخ اليوم للتحقق
        const dateToCheck = originalInvoiceDate || new Date().toISOString().split('T')[0];

        // توليد رقم طلب ذو معنى: WAR-<jobOrder>-<تسلسل>
        const allWarranty = await WarrantyRequest.find();
        const seq = String(allWarranty.length + 1).padStart(3, '0');
        const jobRef = originalJobOrder || String(originalJobId).slice(-6).toUpperCase();
        const requestNumber = `WAR-${jobRef}-${seq}`;

        const check = isWarrantyValid(dateToCheck);
        const status = check.valid ? 'approved' : 'rejected';
        const requestDoc = await WarrantyRequest.create({
            requestNumber,
            originalInvoiceId,
            originalJobId,
            originalJobOrder: originalJobOrder || '',
            customerId: customerId || '',
            customerName,
            customerPhone: customerPhone || '',
            complaint,
            complaintDate: new Date().toISOString(),
            originalInvoiceDate: originalInvoiceDate || dateToCheck,
            warrantyValidUntil: check.validUntil.toISOString(),
            items: Array.isArray(items) ? items : [],
            status,
            createdBy: req.user?.username || req.user?.id || ''
        });

        if (!check.valid) {
            return res.status(201).json({
                request: requestDoc,
                message: 'تم رفض طلب الضمان: الفاتورة خارج مدة 10 سنوات.'
            });
        }

        const createdJob = await ServiceJob.create(
            buildWarrantyJobPayload(requestDoc, requestDoc.items, req.user?.username || req.user?.id || '')
        );

        await WarrantyRequest.updateOne({ _id: requestDoc._id }, {
            status: 'converted_to_job',
            convertedJobId: createdJob._id
        });

        res.status(201).json({
            request: { ...requestDoc, status: 'converted_to_job', convertedJobId: createdJob._id },
            serviceJob: createdJob,
            message: 'تم اعتماد طلب الضمان وإنشاء أمر تشغيل ضمان.'
        });
    } catch (error) {
        console.error('Error creating warranty request:', error);
        res.status(500).json({ message: 'فشل إنشاء طلب الضمان.' });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const all = await WarrantyRequest.find();
        all.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        res.json(all);
    } catch (error) {
        res.status(500).json({ message: 'فشل جلب طلبات الضمان.' });
    }
});

router.get('/:id', authenticateToken, async (req, res) => {
    try {
        const row = await WarrantyRequest.findById(req.params.id);
        if (!row) return res.status(404).json({ message: 'طلب الضمان غير موجود.' });
        res.json(row);
    } catch (error) {
        res.status(500).json({ message: 'فشل جلب طلب الضمان.' });
    }
});

router.post('/:id/verify', authenticateToken, async (req, res) => {
    try {
        const row = await WarrantyRequest.findById(req.params.id);
        if (!row) return res.status(404).json({ message: 'طلب الضمان غير موجود.' });

        const check = isWarrantyValid(row.originalInvoiceDate);
        const status = check.valid ? 'approved' : 'rejected';
        const updated = await WarrantyRequest.updateOne({ _id: row._id }, {
            status,
            warrantyValidUntil: check.validUntil.toISOString(),
            verifiedBy: req.user?.username || req.user?.id || '',
            verifiedAt: new Date().toISOString()
        });
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'فشل التحقق من الضمان.' });
    }
});

module.exports = router;
