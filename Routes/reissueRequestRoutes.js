const express = require('express');
const router = express.Router();
const ReissueRequest = require('../models/ReissueRequest');
const ServiceJob = require('../models/ServiceJob');
const inventoryService = require('../services/inventoryService');
const { authenticateToken } = require('../middleware/auth');

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

function calculateDeductionBySize(item = {}) {
    const width = toNumber(item.widthCM || item.width || 0);
    const length = toNumber(item.lengthCM || item.length || 0);
    return (width >= 100 && length >= 152) ? 100 : 50;
}

router.post('/', authenticateToken, async (req, res) => {
    try {
        const { originalJobId, originalItemIndex, type, reason, requestedBy, technicianName, technicianId, jobOrder } = req.body;
        if (!originalJobId || originalItemIndex === undefined || !type || !reason) {
            return res.status(400).json({ message: 'بيانات طلب إعادة الصرف غير مكتملة.' });
        }

        // توليد رقم طلب ذو معنى: REI-<jobOrder>-<تسلسل>
        const allReissue = await ReissueRequest.find();
        const seq = String(allReissue.length + 1).padStart(3, '0');
        const jobRef = jobOrder || String(originalJobId).slice(-6).toUpperCase();
        const requestNumber = `REI-${jobRef}-${seq}`;

        const row = await ReissueRequest.create({
            requestNumber,
            originalJobId,
            originalItemIndex: Number(originalItemIndex),
            type: String(type).toLowerCase() === 'defective' ? 'defective'
                : String(type).toLowerCase() === 'installation' ? 'installation'
                : 'mistake',
            reason,
            requestedBy: requestedBy || req.user?.username || req.user?.id || '',
            requestedAt: new Date().toISOString(),
            technicianName: technicianName || '',
            technicianId: technicianId || '',
            jobOrder: jobOrder || '',
            status: 'pending_execution',
            execution: {},
            accounting: {
                status: 'pending',
                costCenter: String(type).toLowerCase() === 'installation' ? 'technician' : '',
                deductionAmount: 0
            }
        });

        // Create the ServiceJob immediately so it shows up in warehouse_dashboard and service_jobs
        try {
            const originalJob = await ServiceJob.findById(originalJobId);
            if (originalJob && originalJob.items && originalJob.items[Number(originalItemIndex)]) {
                const originalItem = originalJob.items[Number(originalItemIndex)];
                const itemObj = typeof originalItem.toObject === 'function' ? originalItem.toObject() : originalItem;
                
                const reissueJob = await ServiceJob.create({
                    jobOrder: requestNumber,
                    type: 'REISSUE',
                    sourceType: 'REISSUE_REQUEST',
                    sourceId: row._id,
                    status: 'PENDING_WAREHOUSE', 
                    workflowStatus: 'AwaitingWarehouseIssue',
                    customer: originalJob.customer || '',
                    customerName: originalJob.customerName || '',
                    customerPhone: originalJob.customerPhone || '',
                    carName: originalJob.carName || '',
                    carModel: originalJob.carModel || '',
                    items: [{
                        ...itemObj,
                        issueStatus: 'Pending',
                        issuedQuantity: 0,
                        barcode: '',
                        issuedBarcode: '',
                        issuedInventoryCode: ''
                    }],
                    technicianId: technicianId || originalJob.technicianId || '',
                    technicianName: technicianName || originalJob.technicianName || '',
                    technicianAssignments: technicianId ? [{ technicianId, name: technicianName, assignedAt: new Date().toISOString() }] : (originalJob.technicianAssignments || [])
                });
                
                // Update request to show it's linked
                await ReissueRequest.updateOne({ _id: row._id }, { 
                    status: 'completed',
                    execution: { newJobId: reissueJob._id, completedAt: new Date().toISOString() } 
                });
            }
        } catch (jobErr) {
            console.error('Error auto-creating reissue job:', jobErr);
        }

        res.status(201).json(row);
    } catch (error) {
        console.error('Error creating reissue request:', error);
        res.status(500).json({ message: 'فشل إنشاء طلب إعادة الصرف.' });
    }
});

router.get('/', authenticateToken, async (req, res) => {
    try {
        const all = await ReissueRequest.find();
        const status = req.query.status ? String(req.query.status) : '';
        const filtered = status ? all.filter((row) => row.status === status) : all;
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ message: 'فشل جلب طلبات إعادة الصرف.' });
    }
});

router.post('/:id/execute', authenticateToken, async (req, res) => {
    try {
        const row = await ReissueRequest.findById(req.params.id);
        if (!row) return res.status(404).json({ message: 'طلب إعادة الصرف غير موجود.' });
        if (row.status !== 'pending_execution') {
            return res.status(400).json({ message: 'تم تنفيذ الطلب مسبقًا.' });
        }

        const originalJob = await ServiceJob.findById(row.originalJobId);
        if (!originalJob) return res.status(404).json({ message: 'أمر التشغيل الأصلي غير موجود.' });

        const originalItem = originalJob.items?.[Number(row.originalItemIndex)];
        if (!originalItem) return res.status(400).json({ message: 'بند أمر التشغيل الأصلي غير موجود.' });

        const issuedItems = Array.isArray(req.body.issuedItems) ? req.body.issuedItems : [];
        const warehouseId = req.body.warehouseId || originalJob.warehouseId || 'main_warehouse';
        if (!issuedItems.length) return res.status(400).json({ message: 'بيانات الصرف مطلوبة.' });

        const outboundItems = [];
        for (const item of issuedItems) {
            const barcode = String(item.barcode || '').trim();
            const qty = toNumber(item.quantity || item.area || 0);
            if (!barcode || qty <= 0) {
                return res.status(400).json({ message: 'كل بند صرف يحتاج barcode و quantity.' });
            }

            const inv = await inventoryService.findInventoryItemByBarcode(barcode);
            if (!inv) {
                return res.status(400).json({ message: `الباركود ${barcode} غير موجود في المخزون.` });
            }

            outboundItems.push({
                product: originalItem.product,
                quantity: qty,
                area: qty,
                rollCode: inv.itemType === 'roll' ? inv.code : undefined,
                pieceCode: inv.itemType !== 'roll' ? inv.code : undefined
            });
        }

        await inventoryService.processOutbound({
            warehouseId,
            jobOrderId: row.originalJobId,
            items: outboundItems
        });

        const returnedStatus = req.body.returnedStatus || 'none';
        const usableQuantity = toNumber(req.body.usableQuantity || 0);
        const wasteQuantity = toNumber(req.body.wasteQuantity || 0);
        const returnedQuantity = usableQuantity + wasteQuantity;

        const patchedOriginalItems = [...(originalJob.items || [])];
        patchedOriginalItems[Number(row.originalItemIndex)] = {
            ...originalItem,
            returnedStatus,
            usableQuantity,
            wasteQuantity,
            returnedQuantity
        };
        await ServiceJob.updateOne({ _id: originalJob._id }, { items: patchedOriginalItems });

        const deductionAmount = calculateDeductionBySize(originalItem);
        const reissueJob = await ServiceJob.create({
            jobOrder: `RJ-${Date.now()}`,
            type: 'REISSUE',
            sourceType: 'REISSUE_REQUEST',
            sourceId: row._id,
            status: 'PENDING_OPS',
            workflowStatus: 'AwaitingTechnician',
            customer: originalJob.customer || '',
            customerName: originalJob.customerName || '',
            customerPhone: originalJob.customerPhone || '',
            items: issuedItems.map((i) => ({
                ...originalItem,
                issueStatus: 'Issued',
                barcode: i.barcode,
                quantity: toNumber(i.quantity || i.area || 0)
            })),
            reissueInfo: {
                originalJobId: row.originalJobId,
                originalItemIndex: Number(row.originalItemIndex),
                type: row.type,
                requestId: row._id,
                deductionAmount,
                costCenter: 'technician'
            }
        });

        const updated = await ReissueRequest.updateOne({ _id: row._id }, {
            status: 'completed',
            execution: {
                completedBy: req.user?.username || req.user?.id || '',
                completedAt: new Date().toISOString(),
                newJobId: reissueJob._id
            },
            accounting: {
                ...(row.accounting || {}),
                status: 'pending',
                costCenter: row.accounting?.costCenter || 'technician',
                deductionAmount
            }
        });

        res.json({ request: updated, serviceJob: reissueJob });
    } catch (error) {
        console.error('Error executing reissue request:', error);
        res.status(500).json({ message: error.message || 'فشل تنفيذ طلب إعادة الصرف.' });
    }
});

router.post('/:id/post-accounting', authenticateToken, async (req, res) => {
    try {
        const row = await ReissueRequest.findById(req.params.id);
        if (!row) return res.status(404).json({ message: 'طلب إعادة الصرف غير موجود.' });
        if (row.status !== 'completed') return res.status(400).json({ message: 'يجب تنفيذ الطلب أولًا.' });

        const costCenter = req.body.costCenter || 'technician';
        const deductionAmount = toNumber(req.body.deductionAmount || row.accounting?.deductionAmount || 0);

        const updated = await ReissueRequest.updateOne({ _id: row._id }, {
            accounting: {
                ...(row.accounting || {}),
                status: 'posted',
                costCenter,
                deductionAmount,
                postedBy: req.user?.username || req.user?.id || '',
                postedAt: new Date().toISOString()
            }
        });

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'فشل التسجيل المحاسبي.' });
    }
});

module.exports = router;
