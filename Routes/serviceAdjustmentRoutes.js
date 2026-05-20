const express = require('express');
const router = express.Router();
const FileDatabaseManager = require('../file_db_manager');
const ServiceJob = require('../models/ServiceJob');
const ServiceAdjustment = require('../models/ServiceAdjustment');
const { authenticateToken } = require('../middleware/auth');

const db = new FileDatabaseManager();

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const getItemQty = (item) => {
    const area = toNumber(item?.area);
    if (area > 0) return area;
    return toNumber(item?.quantity);
};

const findLinkedJob = async (invoiceId, invoiceNumber) => {
    let linkedJob = await ServiceJob.findOne({ salesInvoiceId: invoiceId });
    if (!linkedJob && invoiceNumber) linkedJob = await ServiceJob.findOne({ jobOrder: invoiceNumber });
    return linkedJob;
};

const calcTotals = (invoice) => {
    const itemsSubtotal = (invoice.items || [])
        .filter((it) => !it.isCancelled)
        .reduce((sum, it) => sum + toNumber(it.total || (toNumber(it.price) * getItemQty(it))), 0);
    const extraCost = toNumber(invoice.extraCost || 0);
    const discount = toNumber(invoice.discount || 0);
    const taxable = Math.max(0, itemsSubtotal + extraCost - discount);
    const vat = Number((taxable * 0.14).toFixed(2));
    const finalTotal = Number((taxable + vat).toFixed(2));
    return {
        subtotal: Number(itemsSubtotal.toFixed(2)),
        totalAmount: finalTotal,
        finalAmount: finalTotal,
        finalTotal,
        totalTax: vat,
        vatAmount: vat
    };
};

router.get('/', authenticateToken, async (req, res) => {
    try {
        const rows = await ServiceAdjustment.find();
        const invoiceId = req.query.invoiceId ? String(req.query.invoiceId) : '';
        const filtered = invoiceId ? rows.filter((r) => String(r.invoiceId) === invoiceId) : rows;
        filtered.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        res.json(filtered);
    } catch (error) {
        console.error('Error listing service adjustments:', error);
        res.status(500).json({ message: 'فشل جلب تعديلات الخدمات.' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const {
            invoiceId,
            actionType,
            notes,
            stockReturnConfirmed,
            discountAmount,
            items
        } = req.body;

        if (!invoiceId) return res.status(400).json({ message: 'invoiceId مطلوب.' });
        if (!['ADD_SERVICE', 'CANCEL_SERVICE', 'MODIFY_SERVICE', 'DISCOUNT_ONLY'].includes(actionType)) {
            return res.status(400).json({ message: 'نوع التعديل غير مدعوم.' });
        }

        const invoice = await db.findOne('salesinvoices', { _id: invoiceId });
        if (!invoice) return res.status(404).json({ message: 'الفاتورة غير موجودة.' });

        const linkedJob = await findLinkedJob(invoiceId, invoice.invoiceNumber);
        const hasWarehouseIssue = !!linkedJob && (linkedJob.items || []).some((it) => toNumber(it.issuedQuantity) > 0);

        if (hasWarehouseIssue && ['CANCEL_SERVICE', 'MODIFY_SERVICE'].includes(actionType) && !stockReturnConfirmed) {
            return res.status(400).json({
                message: 'لا يمكن إلغاء/تعديل خدمة بعد الصرف المخزني قبل تأكيد المرتجع.',
                requiresStockReturn: true
            });
        }

        const adjustmentNo = `ADJ-${Date.now()}`;
        const adjustment = await ServiceAdjustment.create({
            adjustmentNo,
            invoiceId,
            invoiceNumber: invoice.invoiceNumber || '',
            actionType,
            notes: notes || '',
            stockReturnConfirmed: !!stockReturnConfirmed,
            discountAmount: toNumber(discountAmount || 0),
            items: Array.isArray(items) ? items : [],
            status: 'applied',
            createdBy: req.user?.username || req.user?.id || ''
        });

        const updatedItems = [...(invoice.items || [])];
        const parsedItems = Array.isArray(items) ? items : [];

        if (actionType === 'ADD_SERVICE') {
            parsedItems.forEach((row) => {
                const qty = Math.max(0, toNumber(row.quantity || row.area || 1));
                const price = toNumber(row.price || 0);
                const total = Number((qty * price).toFixed(2));
                updatedItems.push({
                    partName: row.partName || 'خدمة مضافة',
                    product: row.product || '',
                    materialCategory: row.materialCategory || '',
                    lengthCM: toNumber(row.lengthCM || 0),
                    widthCM: toNumber(row.widthCM || 0),
                    area: toNumber(row.area || 0),
                    quantity: qty,
                    price,
                    total,
                    sourceType: 'ADJUSTMENT',
                    adjustmentNo
                });
            });
        }

        if (actionType === 'CANCEL_SERVICE' || actionType === 'MODIFY_SERVICE') {
            parsedItems.forEach((row) => {
                const idx = Number(row.itemIndex);
                if (!Number.isInteger(idx) || idx < 0 || idx >= updatedItems.length) return;
                const line = { ...updatedItems[idx] };

                if (actionType === 'CANCEL_SERVICE') {
                    line.isCancelled = true;
                    line.cancelReason = row.reason || notes || 'إلغاء عبر صفحة التعديلات';
                    line.cancelledAt = new Date().toISOString();
                    line.adjustmentNo = adjustmentNo;
                    line.total = 0;
                } else {
                    const qty = Math.max(0, toNumber(row.quantity ?? getItemQty(line)));
                    const price = Math.max(0, toNumber(row.price ?? line.price));
                    line.partName = row.partName || line.partName;
                    line.lengthCM = toNumber(row.lengthCM ?? line.lengthCM);
                    line.widthCM = toNumber(row.widthCM ?? line.widthCM);
                    if (Object.prototype.hasOwnProperty.call(row, 'area')) line.area = toNumber(row.area);
                    line.quantity = qty;
                    line.price = price;
                    line.total = Number((qty * price).toFixed(2));
                    line.adjustmentNo = adjustmentNo;
                }

                updatedItems[idx] = line;
            });
        }

        const nextInvoice = {
            ...invoice,
            items: updatedItems,
            discount: actionType === 'DISCOUNT_ONLY'
                ? toNumber(invoice.discount || 0) + toNumber(discountAmount || 0)
                : toNumber(invoice.discount || 0)
        };
        const totals = calcTotals(nextInvoice);
        const invoiceAdjustments = Array.isArray(invoice.invoiceAdjustments) ? [...invoice.invoiceAdjustments] : [];
        invoiceAdjustments.push({
            adjustmentId: adjustment._id,
            adjustmentNo,
            actionType,
            createdAt: new Date().toISOString()
        });

        const updatedInvoice = await db.updateOne('salesinvoices', { _id: invoice._id }, {
            items: nextInvoice.items,
            discount: nextInvoice.discount,
            invoiceAdjustments,
            ...totals,
            updatedAt: new Date().toISOString()
        });

        if (linkedJob) {
            const jobNumber = `${linkedJob.jobOrder || invoice.invoiceNumber}-ADJ`;
            await ServiceJob.create({
                salesInvoiceId: invoice._id,
                invoiceNumber: invoice.invoiceNumber,
                jobOrder: `${jobNumber}-${Date.now().toString().slice(-5)}`,
                status: 'PENDING_OPS',
                workflowStatus: 'AwaitingTechnician',
                type: 'SALES',
                sourceType: 'INVOICE',
                sourceId: invoice._id,
                serviceType: `${linkedJob.serviceType || ''} (ADJUSTMENT)`,
                customer: linkedJob.customer || invoice.customer || '',
                customerName: linkedJob.customerName || invoice.customerName || '',
                carModel: linkedJob.carModel || invoice.carModel || '',
                items: parsedItems.map((r) => ({
                    partName: r.partName || '',
                    product: r.product || '',
                    quantity: toNumber(r.quantity || r.area || 0),
                    price: toNumber(r.price || 0),
                    total: Number((toNumber(r.quantity || r.area || 0) * toNumber(r.price || 0)).toFixed(2)),
                    sourceType: 'ADJUSTMENT',
                    adjustmentNo
                })),
                adjustmentRef: adjustmentNo
            });
        }

        res.status(201).json({
            message: 'تم تطبيق التعديل بنجاح.',
            adjustment,
            invoice: updatedInvoice
        });
    } catch (error) {
        console.error('Error applying service adjustment:', error);
        res.status(500).json({ message: error.message || 'فشل تطبيق التعديل.' });
    }
});

module.exports = router;
