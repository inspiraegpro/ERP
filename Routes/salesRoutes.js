const express = require('express');
const router = express.Router();
const FileDatabaseManager = require('../file_db_manager');
const salesService = require('../services/salesService');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Car = require('../models/Car');
const ServiceJob = require('../models/ServiceJob');
const journalService = require('../services/journalService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const db = new FileDatabaseManager();

const normalizeDimensionToCm = (value) => {
    const numericValue = Number(value) || 0;
    if (!numericValue) return 0;
    return numericValue < 100 ? numericValue * 100 : numericValue;
};

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const getItemEffectiveQty = (item) => {
    const area = toNumber(item?.area);
    if (area > 0) return area;
    return toNumber(item?.quantity);
};

const normalizeInvoiceItem = (item) => {
    const quantity = toNumber(item.quantity || item.area || 1);
    const price = toNumber(item.price);
    const total = toNumber(item.total || (price * quantity));
    return {
        ...item,
        quantity,
        area: toNumber(item.area),
        price,
        total
    };
};

const refreshInvoiceTotals = (invoice) => {
    const subtotal = (invoice.items || [])
        .filter((it) => !it.isCancelled)
        .reduce((sum, it) => sum + toNumber(it.total || (toNumber(it.price) * toNumber(it.quantity || 1))), 0);
    const discount = toNumber(invoice.discount || invoice.totalDiscount);
    const vatRate = 0.14;
    const taxableBase = Math.max(0, subtotal - discount);
    const vat = Number((taxableBase * vatRate).toFixed(2));
    const finalTotal = Number((taxableBase + vat).toFixed(2));
    return {
        subtotal: Number(subtotal.toFixed(2)),
        totalDiscount: discount,
        discount,
        totalTax: vat,
        vatAmount: vat,
        totalAmount: finalTotal,
        finalAmount: finalTotal,
        finalTotal
    };
};

const resolveProductId = async (identifier) => {
    const value = typeof identifier === 'object' ? identifier?._id : identifier;
    if (!value) return null;

    let product = await Product.findOne({ _id: value });
    if (!product) product = await Product.findOne({ inventorySlug: value });
    if (!product) product = await Product.findOne({ code: value });
    return product || null;
};

const hydrateSalesInvoice = async (invoice) => {
    const customer = invoice.customer && typeof invoice.customer !== 'object'
        ? await Customer.findOne({ _id: invoice.customer })
        : invoice.customer;

    let hydratedCarModel = invoice.carModel;
    if (hydratedCarModel && typeof hydratedCarModel !== 'object') {
        const car = await Car.findOne({ _id: hydratedCarModel });
        if (car) hydratedCarModel = car;
    }

    const productCache = new Map();
    const items = await Promise.all((invoice.items || []).map(async (item) => {
        const productId = typeof item.product === 'object' ? item.product._id : item.product;

        // ابحث بالـ _id أولاً، ثم بالـ slug/code كـ fallback
        let product = productCache.get(String(productId || ''));
        if (product === undefined) {
            product = await resolveProductId(productId);
            productCache.set(String(productId || ''), product || null);
        }

        const dimensions = product?.dimensions || {};
        const rawLength = Number(item.lengthCM ?? item.length ?? dimensions.length ?? 0) || 0;
        const rawWidth  = Number(item.widthCM  ?? item.width  ?? dimensions.width  ?? 0) || 0;
        const length    = normalizeDimensionToCm(rawLength);
        const width     = normalizeDimensionToCm(rawWidth);
        const area      = Number(item.area ?? (length && width ? (length * width) / 10000 : item.quantity ?? 0)) || 0;

        return {
            ...item,
            // لو لقينا product حقيقي نرجعه، لو لأ نحافظ على الـ slug الأصلي
            product:          product || item.product,
            // حقل إضافي للـ frontend يعرف منه الـ slug الأصلي
            productSlug:      productId,
            materialCategory: item.materialCategory || product?.type || product?.serviceCategory || '',
            partName:         item.partName || product?.name || item.productName || '',
            lengthCM:         length,
            widthCM:          width,
            area
        };
    }));

    return {
        ...invoice,
        customer: customer || invoice.customer,
        carModel: hydratedCarModel,
        items
    };
};

// Get Next Invoice Number
router.get('/number/next', async (req, res, next) => {
    try {
        const nextNumber = await salesService.generateInvoiceNumber();
        res.json({ nextNumber });
    } catch (error) {
        res.status(500).json({ error: 'فشل جلب رقم الفاتورة التالي' });
    }
});

// Get Window Film Packages (MUST be before /:id route)
router.get('/window-film-packages', authenticateToken, async (req, res, next) => {
    try {
        const packages = await db.find('windowFilmPackages');
        res.json(packages);
    } catch (error) {
        console.error('Error fetching window film packages:', error);
        res.status(500).json({ error: 'فشل جلب باقات وندو فيلم' });
    }
});

// 1. Get All Sales Invoices
router.get('/', async (req, res, next) => {
    try {
        const invoices = await db.find('salesinvoices');
        // Sort manually since FileDatabaseManager doesn't have sort method
        invoices.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        const hydrated = await Promise.all(invoices.map(hydrateSalesInvoice));
        res.json(hydrated);
    } catch (error) {
        console.error('Error getting sales invoices:', error);
        res.status(500).json({ error: 'فشل جلب فواتير المبيعات' });
    }
});

// 2. Get Sales Invoice by ID
router.get('/:id', authenticateToken, async (req, res, next) => {
    try {
        const invoice = await db.findOne('salesinvoices', { _id: req.params.id });
        if (!invoice) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        const hydrated = await hydrateSalesInvoice(invoice);
        res.json(hydrated);
    } catch (error) {
        console.error('Error getting sales invoice:', error);
        res.status(500).json({ error: 'فشل جلب الفاتورة' });
    }
});

// 3. Create Sales Invoice
router.post('/', authenticateToken, async (req, res, next) => {
    try {
        if (!req.body.customer) {
            return res.status(400).json({ error: 'العميل مطلوب' });
        }
        if (!req.body.items || req.body.items.length === 0) {
            return res.status(400).json({ error: 'المنتجات مطلوبة' });
        }
        if (req.body.invoiceNumber) {
            const existingInvoice = await db.findOne('salesinvoices', { invoiceNumber: req.body.invoiceNumber });
            if (existingInvoice) {
                return res.status(400).json({ error: 'رقم الفاتورة مكرر، اختر رقمًا آخر' });
            }
        }
        const newInvoice = await salesService.createSalesInvoice(req.body, req.user);
        res.status(201).json({
            success: true,
            message: 'تم حفظ الفاتورة والقيود المخزنية والمحاسبية بنجاح',
            invoice: newInvoice
        });
    } catch (error) {
        console.error('Error creating sales invoice:', error.message);
        res.status(500).json({ error: 'فشل إنشاء فاتورة المبيعات: ' + error.message });
    }
});


// 4. Update Sales Invoice — يُحدّث الفاتورة ويعكس التغييرات على أمر التشغيل
router.put('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const invoiceId = req.params.id;

        // التحقق من تكرار رقم الفاتورة
        if (req.body.invoiceNumber) {
            const existingInvoice = await db.findOne('salesinvoices', { invoiceNumber: req.body.invoiceNumber });
            if (existingInvoice && existingInvoice._id !== invoiceId) {
                return res.status(400).json({ error: 'رقم الفاتورة مكرر، اختر رقمًا آخر' });
            }
        }

        // ── resolve slugs → IDs في الـ items ──────────────────────────
        let updatedItems = req.body.items;
        if (Array.isArray(updatedItems)) {
            updatedItems = await Promise.all(updatedItems.map(async (item) => {
                let productId = typeof item.product === 'object' ? item.product._id : item.product;
                if (productId) {
                    const product = await resolveProductId(productId);
                    if (product) productId = product._id;
                }
                return { ...item, product: productId };
            }));
        }

        await journalService.archiveBeforeMutation({
            transactionType: 'SALES_INVOICE',
            transactionCollection: 'salesinvoices',
            transactionId: invoiceId,
            referenceNumber: req.body.invoiceNumber,
            incomingPayload: req.body,
            user: req.user,
            action: 'UPDATE'
        });

        const updateData = {
            ...req.body,
            ...(Array.isArray(updatedItems) ? { items: updatedItems } : {}),
            updatedAt: new Date().toISOString()
        };

        const updatedInvoice = await db.updateOne('salesinvoices', { _id: invoiceId }, updateData);
        if (!updatedInvoice) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }

        // ── مزامنة أمر التشغيل المرتبط ──────────────────────────────
        try {
            // ابحث بالـ salesInvoiceId أو بالـ jobOrder (رقم الفاتورة)
            let job = await ServiceJob.findOne({ salesInvoiceId: invoiceId });
            if (!job && updatedInvoice.invoiceNumber) {
                job = await ServiceJob.findOne({ jobOrder: updatedInvoice.invoiceNumber });
            }

            if (job) {
                // بناء items محدثة للـ Job — نحافظ على بيانات التشغيل (فني، issueStatus، تقييم)
                // ونحدث فقط البيانات التجارية (partName, dimensions, area, price)
                const existingJobItems = job.items || [];

                const mergedItems = (updatedItems || []).map((invItem, idx) => {
                    // ابحث عن البند المقابل في الـ Job بالـ partName أو الـ index
                    const jobItem = existingJobItems.find(ji =>
                        ji.partName === invItem.partName ||
                        (typeof ji.product === 'string' && ji.product === String(invItem.product))
                    ) || existingJobItems[idx] || {};

                    return {
                        // بيانات تشغيلية محفوظة من الـ Job
                        assignedTechnicianId: jobItem.assignedTechnicianId || null,
                        technicianName:       jobItem.technicianName       || '',
                        issueStatus:          jobItem.issueStatus          || 'Pending',
                        rating:               jobItem.rating               ?? null,
                        evaluation:           jobItem.evaluation           || null,
                        materialCategory:     jobItem.materialCategory     || invItem.materialCategory || '',
                        // بيانات تجارية محدثة من الفاتورة
                        product:    invItem.product,
                        partName:   invItem.partName   || '',
                        lengthCM:   invItem.lengthCM   || 0,
                        widthCM:    invItem.widthCM    || 0,
                        area:       invItem.area        || 0,
                        price:      invItem.price       || 0
                    };
                });

                // حالة الـ Job: لو كان COMPLETED لا نرجعه للخلف
                const keepStatus = ['COMPLETED'].includes(job.status);

                await ServiceJob.updateOne(
                    { _id: job._id },
                    {
                        items:       mergedItems,
                        // حدّث الحقول المالية/التجارية فقط
                        ...(req.body.customer  && { customer:     req.body.customer }),
                        ...(req.body.carModel  && { carModel:     req.body.carModel }),
                        ...(req.body.date      && { date:         req.body.date }),
                        // أعد الـ Job لـ PENDING_OPS لو أُضيفت/حُذفت بنود (إلا لو مكتمل)
                        ...(!keepStatus && mergedItems.length !== existingJobItems.length && {
                            status:         'PENDING_OPS',
                            workflowStatus: 'AwaitingTechnician'
                        })
                    }
                );
            }
        } catch (jobSyncErr) {
            // مزامنة الـ Job اختيارية — لا توقف الـ response
            console.error('Job sync after invoice update failed:', jobSyncErr.message);
        }

        try {
            await journalService.syncSalesJournal(updatedInvoice, req.user);
        } catch (journalError) {
            console.error('Sales journal sync failed after invoice update:', journalError.message);
        }

        res.json(updatedInvoice);
    } catch (error) {
        console.error('Error updating sales invoice:', error);
        res.status(500).json({ error: 'فشل تحديث الفاتورة' });
    }
});

// GET: التحقق من حالة الصرف المخزني لفاتورة معينة
// يُستخدم قبل السماح بتعديل/إلغاء بنود الفاتورة
router.get('/:id/stock-issue-status', authenticateToken, async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const invoice = await db.findOne('salesinvoices', { _id: invoiceId });
        if (!invoice) return res.status(404).json({ error: 'الفاتورة غير موجودة' });

        // جلب جميع إذونات الصرف المرتبطة بالفاتورة
        const allTxns = await db.find('stocktransactions');
        const related = allTxns.filter(t =>
            t.type === 'Outbound' &&
            !t.isReversed &&
            (String(t.jobOrder) === String(invoice.invoiceNumber) ||
             String(t.jobOrderId) === String(invoiceId))
        );

        // بناء map: partName → مجموع المساحة المصروفة
        const issuedMap = {};
        related.forEach(txn => {
            (txn.items || []).forEach(item => {
                const key = item.partName || String(item.product || '');
                issuedMap[key] = (issuedMap[key] || 0) + Number(item.consumedArea || item.area || 0);
            });
        });

        // مقارنة مع بنود الفاتورة
        const itemsStatus = (invoice.items || []).map((item, idx) => {
            const key = item.partName || String(item.product || '');
            const required = Number(item.area || item.quantity || 0);
            const issued   = issuedMap[key] || 0;
            const remaining = Math.max(0, required - issued);
            return {
                idx,
                partName:  item.partName || '',
                product:   item.product  || '',
                required:  Number(required.toFixed(4)),
                issued:    Number(issued.toFixed(4)),
                remaining: Number(remaining.toFixed(4)),
                isFullyIssued:   issued >= required - 0.001,
                isPartiallyIssued: issued > 0.001 && issued < required - 0.001,
                canCancel: remaining > 0.001,
                isCancelled: !!item.isCancelled
            };
        });

        const hasAnyIssued = itemsStatus.some(i => i.issued > 0.001);
        const allFullyIssued = itemsStatus.every(i => i.isFullyIssued || i.isCancelled);

        res.json({
            invoiceId,
            invoiceNumber: invoice.invoiceNumber,
            hasAnyIssued,
            allFullyIssued,
            relatedTransactions: related.length,
            itemsStatus
        });
    } catch (error) {
        console.error('Error checking stock issue status:', error);
        res.status(500).json({ error: 'فشل التحقق من حالة الصرف' });
    }
});

// 5. Sales Service Adjustments (Add/Cancel services without losing invoice history)
router.post('/:id/service-adjustments', authenticateToken, async (req, res) => {
    return res.status(410).json({
        error: 'تم إيقاف التعديل المباشر من داخل الفاتورة. استخدم صفحة ملحق التعديلات الجديدة.',
        redirect: '/sales/service_adjustments.html'
    });
});

/*
router.post('/:id/service-adjustments', authenticateToken, async (req, res) => {
    try {
        const invoiceId = req.params.id;
        const mode = String(req.body.mode || '').toLowerCase();
        const itemsPayload = Array.isArray(req.body.items) ? req.body.items : [];
        const notes = String(req.body.notes || '').trim();

        if (!['add', 'cancel'].includes(mode)) {
            return res.status(400).json({ error: 'mode يجب أن يكون add أو cancel' });
        }
        if (!itemsPayload.length) {
            return res.status(400).json({ error: 'لا توجد بنود مرسلة في الملحق' });
        }

        const invoice = await db.findOne('salesinvoices', { _id: invoiceId });
        if (!invoice) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }

        let linkedJob = await ServiceJob.findOne({ salesInvoiceId: invoiceId });
        if (!linkedJob && invoice.invoiceNumber) {
            linkedJob = await ServiceJob.findOne({ jobOrder: invoice.invoiceNumber });
        }

        const beforeItems = Array.isArray(invoice.items) ? [...invoice.items] : [];
        let nextItems = [...beforeItems];
        const changes = [];
        const adjustmentRef = `ADJ-${Date.now()}`;

        if (mode === 'add') {
            for (const rawItem of itemsPayload) {
                const resolvedProduct = await resolveProductId(rawItem.product || rawItem.productSlug || rawItem.productCode);
                const normalized = normalizeInvoiceItem({
                    ...rawItem,
                    product: resolvedProduct?._id || rawItem.product,
                    productSlug: rawItem.productSlug || rawItem.productCode || rawItem.product || '',
                    partName: rawItem.partName || rawItem.productName || resolvedProduct?.name || 'خدمة إضافية',
                    adjustmentRef,
                    addedByAdjustment: true
                });
                nextItems.push(normalized);
                changes.push({
                    action: 'add',
                    partName: normalized.partName,
                    quantity: normalized.quantity,
                    total: normalized.total
                });
            }
        } else {
            for (const cancelRow of itemsPayload) {
                const targetIndex = Number(cancelRow.lineIndex);
                const cancelQty = Math.max(0, toNumber(cancelRow.quantity || cancelRow.area || 0));
                const cancelReason = String(cancelRow.reason || notes || '').trim();

                let idx = Number.isInteger(targetIndex) ? targetIndex : -1;
                if (idx < 0 || idx >= nextItems.length) {
                    idx = nextItems.findIndex((line) =>
                        String(line.product || '') === String(cancelRow.product || '') &&
                        String(line.partName || '') === String(cancelRow.partName || '')
                    );
                }
                if (idx < 0) {
                    return res.status(400).json({ error: `تعذر تحديد البند المراد إلغاؤه (${cancelRow.partName || '-'})` });
                }

                const line = { ...nextItems[idx] };
                const currentQty = getItemEffectiveQty(line);
                const linePricePerUnit = currentQty > 0 ? (toNumber(line.total) / currentQty) : toNumber(line.price);
                const issuedQty = linkedJob ? toNumber((linkedJob.items || [])[idx]?.issuedQuantity) : 0;
                const requestedCancelQty = cancelQty > 0 ? cancelQty : currentQty;
                const newQty = Math.max(0, currentQty - requestedCancelQty);

                if (newQty < issuedQty - 0.0001) {
                    return res.status(400).json({
                        error: `لا يمكن إلغاء الكمية لهذا البند لأن المصروف فعليًا من المخزن (${issuedQty.toFixed(2)}) أكبر من الكمية بعد الإلغاء.`
                    });
                }

                if (toNumber(line.area) > 0) {
                    line.area = Number(newQty.toFixed(2));
                } else {
                    line.quantity = Number(newQty.toFixed(2));
                }
                line.total = Number((linePricePerUnit * newQty).toFixed(2));
                line.isCancelled = newQty <= 0;
                line.cancelReason = cancelReason || line.cancelReason || '';
                line.cancelledAt = newQty <= 0 ? new Date().toISOString() : line.cancelledAt;
                line.adjustmentRef = adjustmentRef;

                nextItems[idx] = line;
                changes.push({
                    action: 'cancel',
                    partName: line.partName,
                    cancelledQty: Number((currentQty - newQty).toFixed(2)),
                    remainingQty: Number(newQty.toFixed(2))
                });
            }
        }

        const totals = refreshInvoiceTotals({ ...invoice, items: nextItems });
        const serviceAdjustments = Array.isArray(invoice.serviceAdjustments) ? [...invoice.serviceAdjustments] : [];
        serviceAdjustments.push({
            ref: adjustmentRef,
            mode,
            notes,
            changes,
            createdAt: new Date().toISOString(),
            createdBy: req.user?.username || req.user?.name || 'system'
        });

        const updatedInvoice = await db.updateOne('salesinvoices', { _id: invoiceId }, {
            items: nextItems,
            serviceAdjustments,
            ...totals,
            updatedAt: new Date().toISOString()
        });

        if (linkedJob) {
            const jobItems = nextItems.map((line, index) => {
                const existing = (linkedJob.items || [])[index] || {};
                return {
                    ...existing,
                    ...line,
                    issueStatus: existing.issueStatus || line.issueStatus || 'Pending',
                    issuedQuantity: toNumber(existing.issuedQuantity || 0)
                };
            });
            await ServiceJob.updateOne(
                { _id: linkedJob._id },
                {
                    items: jobItems,
                    status: 'PENDING_OPS',
                    workflowStatus: 'AwaitingTechnician',
                    updatedAt: new Date().toISOString()
                }
            );
        }

        try {
            await journalService.syncSalesJournal(updatedInvoice, req.user);
        } catch (journalError) {
            console.error('Sales journal sync failed after service adjustment:', journalError.message);
        }

        res.json({
            success: true,
            message: mode === 'add' ? 'تم إضافة ملحق خدمات للفاتورة بنجاح' : 'تم تسجيل إلغاء خدمات على الفاتورة بنجاح',
            adjustmentRef,
            invoice: updatedInvoice
        });
    } catch (error) {
        console.error('Error creating sales service adjustment:', error);
        res.status(500).json({ error: error.message || 'فشل إنشاء ملحق الفاتورة' });
    }
});
*/

// 6. Delete Sales Invoice
router.delete('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const deleted = await db.deleteOne('salesinvoices', { _id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        res.json({ message: 'تم حذف الفاتورة بنجاح' });
    } catch (error) {
        console.error('Error deleting sales invoice:', error);
        res.status(500).json({ error: 'فشل حذف الفاتورة' });
    }
});

module.exports = router;
