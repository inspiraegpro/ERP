const express = require('express');
const router = express.Router();
const ServiceJob = require('../models/ServiceJob');
const SalesInvoice = require('../models/SalesInvoice');
const Employee = require('../models/Employee');
const Customer = require('../models/Customer');
const Car = require('../models/Car');
const Product = require('../models/Product');
const WarrantyRequest = require('../models/WarrantyRequest');
const ReissueRequest = require('../models/ReissueRequest');
const inventoryService = require('../services/inventoryService');
const FileDatabaseManager = require('../file_db_manager');
const { authenticateToken } = require('../middleware/auth');
const db = new FileDatabaseManager();

const toNumber = (value) => {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
};

const getItemRequiredQuantity = (item) => {
    const area = toNumber(item?.area);
    if (area > 0) return area;
    return toNumber(item?.quantity);
};

function normalizeServiceJobStatus(value) {
    const text = String(value || '').trim().toUpperCase();
    if (!text) return 'PENDING_OPS';
    if (text.includes('PENDING_OPS') || text.includes('PENDING OPS') || text.includes('AWAITINGTECHNICIAN') || text === 'PENDING' || text === 'AWAITING TECHNICIAN' || text.includes('AWAITING TECHNICIAN')) return 'PENDING_OPS';
    if (text.includes('PENDING_WAREHOUSE') || text.includes('PENDING WAREHOUSE') || text.includes('AWAITINGWAREHOUSEISSUE') || text === 'AWAITING WAREHOUSE ISSUE' || text.includes('AWAITING_WAREHOUSE')) return 'PENDING_WAREHOUSE';
    if (text.includes('IN_PROGRESS') || text.includes('IN PROGRESS') || text.includes('ISSUEDTOTECHNICIAN') || text === 'IN PROGRESS' || text === 'ISSUED') return 'IN_PROGRESS';
    if (text.includes('COMPLETED') || text === 'COMPLETED' || text.includes('AWAITINGFINALPAYMENT')) return 'COMPLETED';
    return 'PENDING_OPS';
}

const hydrateServiceJob = async (job) => {
    if (!job) return null;

    let technician = null;
    // Try to get technician from technicianId first (legacy)
    if (job.technicianId) {
        technician = await Employee.findById(job.technicianId);
    }
    // If not found, try to get from technicianAssignments
    if (!technician && job.technicianAssignments && job.technicianAssignments.length > 0) {
        const firstAssignment = job.technicianAssignments[0];
        technician = await Employee.findById(firstAssignment.technicianId);
    }

    let invoice = null;
    if (job.salesInvoiceId) {
        invoice = await SalesInvoice.findById(job.salesInvoiceId);
    }

    // Get items from job or fallback to invoice items
    let sourceItems = job.items || [];
    if (sourceItems.length === 0 && invoice && invoice.items) {
        console.log(`Job ${job._id} has no items, using ${invoice.items.length} items from invoice ${invoice.invoiceNumber}`);
        sourceItems = invoice.items.map(item => ({
            ...item,
            partName: item.partName || item.productName || item.description || '',
            materialCategory: item.materialCategory || item.category || item.serviceType || '',
            lengthCM: item.lengthCM || item.length || 0,
            widthCM: item.widthCM || item.width || 0,
            area: item.area || 0,
            product: typeof item.product === 'object' ? item.product._id : item.product
        }));
    }

    // Hydrate items with product data - separate product (ID) and productData (Object)
    const itemsWithProducts = await Promise.all(sourceItems.map(async (item) => {
        if (!item.product) return item;
        
        // If product is not a valid ID (e.g., 'ppf' string), try to find by code or inventorySlug
        let product = null;
        let productId = String(item.product);
        
        try {
            // First try to find by _id
            product = await db.findOne('products', { _id: item.product });
            
            // If not found, try to find by code or inventorySlug (for legacy data)
            if (!product && typeof item.product === 'string') {
                product = await db.findOne('products', { code: item.product });
                if (!product) {
                    product = await db.findOne('products', { inventorySlug: item.product });
                }
                if (!product) {
                    product = await db.findOne('products', { name: item.product });
                }
                // Update productId to the actual ID if found
                if (product) {
                    productId = String(product._id);
                }
            }
            
            if (product) {
                // Ensure materialCategory is set from product if not already present
                const materialCategory = item.materialCategory || product.category || product.type || product.serviceCategory || '';
                
                return {
                    ...item,
                    materialCategory, // Set from product if missing
                    product: productId, // Use the actual ID
                    productData: { // Add separate field for display
                        _id: product._id,
                        name: product.name,
                        code: product.code,
                        inventorySlug: product.inventorySlug,
                        linkedInventoryCodes: product.linkedInventoryCodes || [], // Include linked inventory codes
                        category: product.category || '',
                        type: product.type || '',
                        serviceCategory: product.serviceCategory || ''
                    }
                };
            }
        } catch (error) {
            console.error('Error hydrating product:', error);
        }
        
        // If product not found, return item with empty productData
        return {
            ...item,
            product: productId,
            productData: null
        };
    }));

    // Normalize status for legacy jobs
    const status = normalizeServiceJobStatus(job.status || job.workflowStatus);

    return {
        ...job,
        status,
        salesInvoiceId: invoice || job.salesInvoiceId,
        items: itemsWithProducts,
        technician: technician || (job.technicianName ? {
            _id: job.technicianId,
            name: job.technicianName
        } : null)
    };
};

router.get('/', async (req, res) => {
    try {
        const jobs = await ServiceJob.find();
        const typeFilter = String(req.query.type || '').toUpperCase().trim();
        console.log('GET /service-jobs - raw jobs count:', jobs.length);
        if (jobs.length > 0) {
            console.log('First job ID:', jobs[0]._id);
            console.log('First job raw items count:', jobs[0].items?.length);
            if (jobs[0].items && jobs[0].items.length > 0) {
                console.log('First item raw product:', jobs[0].items[0].product);
                console.log('First item raw productData:', jobs[0].items[0].productData);
            }
        }
        const filteredJobs = typeFilter
            ? jobs.filter((job) => String(job.type || 'SALES').toUpperCase() === typeFilter)
            : jobs;
        filteredJobs.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
        const hydrated = await Promise.all(filteredJobs.map(hydrateServiceJob));
        console.log('After hydration - first job hydrated items count:', hydrated[0]?.items?.length);
        if (hydrated[0] && hydrated[0].items && hydrated[0].items.length > 0) {
            console.log('First item hydrated product:', hydrated[0].items[0].product);
            console.log('First item hydrated productData:', hydrated[0].items[0].productData ? 'exists' : 'undefined');
            if (hydrated[0].items[0].productData) {
                console.log('First item productData.name:', hydrated[0].items[0].productData.name);
            }
        }
        res.json(hydrated);
    } catch (error) {
        console.error('Error in GET /service-jobs:', error);
        res.status(500).json({ message: 'فشل تحميل أوامر التشغيل.' });
    }
});

router.post('/warranty', authenticateToken, async (req, res) => {
    try {
        const { warrantyRequestId, items } = req.body;
        if (!warrantyRequestId) return res.status(400).json({ message: 'warrantyRequestId مطلوب.' });
        const requestRow = await WarrantyRequest.findById(warrantyRequestId);
        if (!requestRow) return res.status(404).json({ message: 'طلب الضمان غير موجود.' });

        const payload = {
            jobOrder: `WJ-${Date.now()}`,
            type: 'WARRANTY',
            sourceType: 'WARRANTY_REQUEST',
            sourceId: requestRow._id,
            status: 'PENDING_OPS',
            workflowStatus: 'AwaitingTechnician',
            customer: requestRow.customerId || '',
            customerName: requestRow.customerName || '',
            customerPhone: requestRow.customerPhone || '',
            items: Array.isArray(items) ? items : (requestRow.items || []),
            warrantyInfo: {
                originalInvoiceId: requestRow.originalInvoiceId || '',
                originalJobId: requestRow.originalJobId || '',
                complaintDate: requestRow.complaintDate || null,
                complaint: requestRow.complaint || '',
                warrantyValidUntil: requestRow.warrantyValidUntil || null
            }
        };
        const createdJob = await ServiceJob.create(payload);
        await WarrantyRequest.updateOne({ _id: requestRow._id }, { status: 'converted_to_job', convertedJobId: createdJob._id });
        res.status(201).json(createdJob);
    } catch (error) {
        console.error('Error creating warranty service job:', error);
        res.status(500).json({ message: 'فشل فتح أمر الضمان.' });
    }
});

router.post('/reissue', authenticateToken, async (req, res) => {
    try {
        const { reissueRequestId, items } = req.body;
        if (!reissueRequestId) return res.status(400).json({ message: 'reissueRequestId مطلوب.' });
        const requestRow = await ReissueRequest.findById(reissueRequestId);
        if (!requestRow) return res.status(404).json({ message: 'طلب إعادة الصرف غير موجود.' });

        const payload = {
            jobOrder: `RJ-${Date.now()}`,
            type: 'REISSUE',
            sourceType: 'REISSUE_REQUEST',
            sourceId: requestRow._id,
            status: 'PENDING_OPS',
            workflowStatus: 'AwaitingTechnician',
            items: Array.isArray(items) ? items : [],
            reissueInfo: {
                originalJobId: requestRow.originalJobId || '',
                originalItemIndex: Number(requestRow.originalItemIndex || 0),
                type: requestRow.type || 'mistake',
                requestId: requestRow._id,
                deductionAmount: Number(requestRow.accounting?.deductionAmount || 0),
                costCenter: requestRow.accounting?.costCenter || 'technician'
            }
        };
        const createdJob = await ServiceJob.create(payload);
        await ReissueRequest.updateOne(
            { _id: requestRow._id },
            {
                status: 'completed',
                execution: {
                    ...(requestRow.execution || {}),
                    newJobId: createdJob._id,
                    completedBy: req.user?.username || req.user?.id || '',
                    completedAt: new Date().toISOString()
                }
            }
        );
        res.status(201).json(createdJob);
    } catch (error) {
        console.error('Error creating reissue service job:', error);
        res.status(500).json({ message: 'فشل فتح أمر إعادة الصرف.' });
    }
});

router.get('/by-order/:jobOrder', async (req, res) => {
    try {
        const job = await ServiceJob.findOne({ jobOrder: req.params.jobOrder });
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }
        res.json(await hydrateServiceJob(job));
    } catch (error) {
        res.status(500).json({ message: 'فشل تحميل أمر التشغيل.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }
        res.json(await hydrateServiceJob(job));
    } catch (error) {
        res.status(500).json({ message: 'فشل تحميل أمر التشغيل.' });
    }
});

router.post('/', authenticateToken, async (req, res) => {
    try {
        const payload = {
            ...req.body,
            workflowStatus: req.body.workflowStatus || 'AwaitingTechnician',
            evaluationStatus: req.body.evaluationStatus || 'Pending'
        };

        if (!payload.jobOrder) {
            return res.status(400).json({ message: 'رقم أمر الشغل مطلوب.' });
        }

        const exists = await ServiceJob.findOne({ jobOrder: payload.jobOrder });
        if (exists) {
            return res.status(400).json({ message: 'يوجد أمر تشغيل بنفس الرقم بالفعل.' });
        }

        const created = await ServiceJob.create(payload);
        res.status(201).json(created);
    } catch (error) {
        res.status(500).json({ message: 'فشل إنشاء أمر التشغيل.' });
    }
});

router.put('/:id', authenticateToken, async (req, res) => {
    try {
        const updated = await ServiceJob.updateOne({ _id: req.params.id }, req.body);
        if (!updated) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }
        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'فشل تحديث أمر التشغيل.' });
    }
});

router.post('/:id/assign-technician', authenticateToken, async (req, res) => {
    try {
        const { technicianId, technicianName, plannedDate, notes } = req.body;
        if (!technicianId && !technicianName) {
            return res.status(400).json({ message: 'اسم الفني أو معرفه مطلوب.' });
        }

        const technician = technicianId ? await Employee.findById(technicianId) : null;
        const updated = await ServiceJob.updateOne(
            { _id: req.params.id },
            {
                technicianId: technician?._id || technicianId || '',
                technicianName: technician?.name || technicianName || '',
                plannedDate: plannedDate || null,
                operationNotes: notes || '',
                workflowStatus: 'AwaitingWarehouseIssue',
                operationAssignedAt: new Date().toISOString()
            }
        );

        if (!updated) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'فشل إسناد الفني.' });
    }
});

router.post('/:id/evaluate', authenticateToken, async (req, res) => {
    try {
        const { rating, notes, completedAt } = req.body;
        const ratingValue = Number(rating);
        if (isNaN(ratingValue) || ratingValue < 0 || ratingValue > 10) {
            return res.status(400).json({ message: 'التقييم يجب أن يكون بين 0 و 10.' });
        }

        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        const evaluationEntry = {
            rating: ratingValue,
            notes: notes || '',
            completedAt: completedAt || new Date().toISOString(),
            evaluatedBy: req.user?.username || '',
            timestamp: new Date().toISOString()
        };

        const history = Array.isArray(job.evaluationHistory) ? [...job.evaluationHistory, evaluationEntry] : [evaluationEntry];

        const updated = await ServiceJob.updateOne(
            { _id: req.params.id },
            {
                evaluation: evaluationEntry,
                evaluationHistory: history,
                evaluationStatus: 'Completed',
                workflowStatus: 'AwaitingFinalPayment'
            }
        );

        if (!updated) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        res.json(updated);
    } catch (error) {
        console.error('Error evaluating service job:', error);
        res.status(500).json({ message: 'فشل حفظ تقييم الفني.' });
    }
});

router.post('/:id/evaluate-items', authenticateToken, async (req, res) => {
    try {
        const { items, completedAt } = req.body;
        if (!Array.isArray(items) || items.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة البنود لتقييمها.' });
        }

        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        // Validate that all items are rated
        const totalItems = job.items?.length || 0;
        const ratedItemsCount = items.length;
        if (ratedItemsCount < totalItems) {
            return res.status(400).json({ 
                message: `يجب تقييم جميع البنود قبل الإنتهاء. تم تقييم ${ratedItemsCount} من ${totalItems} بند.` 
            });
        }

        const updatedItems = (job.items || []).map((item, index) => {
            const payload = items.find((row) => Number(row.index) === index);
            if (!payload) return item;
            const ratingValue = Number(payload.rating);
            if (isNaN(ratingValue) || ratingValue < 0 || ratingValue > 10) {
                throw new Error('التقييم لكل بند يجب أن يكون بين 0 و 10.');
            }
            return {
                ...item,
                rating: ratingValue,
                evaluation: {
                    rating: ratingValue,
                    notes: payload.notes || '',
                    completedAt: completedAt || new Date().toISOString(),
                    evaluatedBy: req.user?.username || '',
                    timestamp: new Date().toISOString()
                }
            };
        });

        const ratedItems = updatedItems.filter((item) => item.rating !== undefined && item.rating !== null);
        const averageRating = ratedItems.length ? (ratedItems.reduce((sum, item) => sum + Number(item.rating || 0), 0) / ratedItems.length) : null;
        const evaluationEntry = averageRating !== null ? {
            rating: Number(averageRating.toFixed(1)),
            notes: 'تقييم تفاصيل البنود',
            completedAt: completedAt || new Date().toISOString(),
            evaluatedBy: req.user?.username || '',
            timestamp: new Date().toISOString()
        } : job.evaluation || null;

        const history = Array.isArray(job.evaluationHistory) ? [...job.evaluationHistory] : [];
        if (evaluationEntry) history.push(evaluationEntry);

        const updated = await ServiceJob.updateOne(
            { _id: req.params.id },
            {
                items: updatedItems,
                evaluation: evaluationEntry,
                evaluationHistory: history,
                evaluationStatus: 'Completed',
                status: 'COMPLETED',
                workflowStatus: 'AwaitingFinalPayment'
            }
        );

        if (!updated) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        res.json(updated);
    } catch (error) {
        console.error('Error evaluating service job items:', error);
        res.status(500).json({ message: error.message || 'فشل حفظ تقييم البنود.' });
    }
});

router.post('/:id/warehouse-issue', authenticateToken, async (req, res) => {
    try {
        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        const rows = Array.isArray(req.body.items) ? req.body.items : [];
        if (!rows.length) {
            return res.status(400).json({ message: 'لا توجد بنود صرف مرسلة.' });
        }

        const outboundItems = [];
        const barcodeMeta = {};
        const updatedItems = [...(job.items || [])];

        for (const row of rows) {
            const itemIndex = Number(row.itemIndex);
            const barcode = String(row.barcode || '').trim();
            const requestedQty = toNumber(row.quantity || 0);
            const jobItem = updatedItems[itemIndex];

            if (!jobItem) {
                return res.status(400).json({ message: `البند رقم ${itemIndex + 1} غير صالح.` });
            }
            if (!barcode) {
                return res.status(400).json({ message: `الباركود مطلوب للبند ${itemIndex + 1}.` });
            }

            const inventoryItem = await inventoryService.findInventoryItemByBarcode(barcode);
            if (!inventoryItem) {
                return res.status(400).json({ message: `الباركود ${barcode} غير موجود بالمخزن.` });
            }

            const requiredQty = getItemRequiredQuantity(jobItem);
            const issuedBefore = toNumber(jobItem.issuedQuantity);
            const remainingQty = Math.max(0, requiredQty - issuedBefore);
            const issueNowQty = requestedQty > 0
                ? Math.min(requestedQty, remainingQty)
                : remainingQty;

            if (issueNowQty <= 0) {
                continue;
            }

            const outboundItem = {
                product: jobItem.product,
                quantity: issueNowQty,
                rollCode: inventoryItem.type === 'roll' ? inventoryItem.code : undefined,
                pieceCode: inventoryItem.type === 'piece' ? inventoryItem.code : undefined
            };

            if (!outboundItem.rollCode && !outboundItem.pieceCode) {
                return res.status(400).json({ message: `تعذر تحديد عنصر مخزني صالح للباركود ${barcode}.` });
            }

            outboundItems.push(outboundItem);
            barcodeMeta[itemIndex] = {
                barcode,
                inventoryCode: inventoryItem.code || barcode,
                inventoryType: inventoryItem.type || '',
                issuedNow: issueNowQty
            };

            const newIssuedQty = issuedBefore + issueNowQty;
            updatedItems[itemIndex] = {
                ...jobItem,
                issuedQuantity: Number(newIssuedQty.toFixed(2)),
                issueStatus: newIssuedQty + 0.0001 >= requiredQty ? 'Issued' : 'PartiallyIssued',
                issuedBarcode: barcode,
                issuedInventoryCode: inventoryItem.code || barcode,
                issuedInventoryType: inventoryItem.type || '',
                issuedAt: new Date().toISOString()
            };
        }

        if (!outboundItems.length) {
            return res.status(400).json({ message: 'لا توجد كميات متبقية للصرف في البنود المحددة.' });
        }

        const warehouseId = req.body.warehouseId || job.warehouseId || 'default-warehouse';
        await inventoryService.processOutbound({
            warehouseId,
            jobOrderId: job._id,
            items: outboundItems
        });

        await db.create('stocktransactions', {
            type: 'Outbound',
            source: 'ServiceJob',
            serviceJobId: job._id,
            jobOrder: job.jobOrder,
            warehouseId,
            items: outboundItems,
            status: 'completed',
            createdAt: new Date().toISOString()
        });

        const isFullyIssued = updatedItems.every((item) => {
            const required = getItemRequiredQuantity(item);
            if (required <= 0) return true;
            return toNumber(item.issuedQuantity) + 0.0001 >= required;
        });

        const updated = await ServiceJob.updateOne(
            { _id: job._id },
            {
                items: updatedItems,
                warehouseIssuedAt: new Date().toISOString(),
                status: isFullyIssued ? 'IN_PROGRESS' : 'PENDING_WAREHOUSE',
                workflowStatus: isFullyIssued ? 'IssuedToTechnician' : 'PENDING_WAREHOUSE'
            }
        );

        res.json(updated);
    } catch (error) {
        console.error('Error issuing warehouse items:', error);
        res.status(500).json({ message: error.message || 'فشل تنفيذ الصرف المخزني.' });
    }
});

router.post('/:id/sync-from-sales', authenticateToken, async (req, res) => {
    try {
        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        const invoice = await SalesInvoice.findById(job.salesInvoiceId);
        if (!invoice) return res.status(404).json({ message: 'فاتورة البيع المرتبطة غير موجودة.' });

        const updated = await ServiceJob.updateOne(
            { _id: req.params.id },
            {
                workflowStatus: 'AwaitingWarehouseIssue',
                evaluationStatus: 'Pending',
                items: invoice.items.map((item, index) => ({
                    ...item,
                    issueStatus: 'Pending',
                    selectedMaterial: null,
                    selectedMaterialType: null,
                    selectedMaterialCategory: item.materialCategory || 'general',
                    partName: item.partName || '',
                    product: item.product,
                    lengthCM: Number(item.lengthCM || item.length || 0),
                    widthCM: Number(item.widthCM || item.width || 0),
                    area: Number(item.area || 0),
                    salePrice: Number(item.price || 0),
                    issueStatus: item.issueStatus || 'Pending'
                }))
            }
        );

        res.json(updated);
    } catch (error) {
        res.status(500).json({ message: 'فشل تحديث أمر التشغيل من فاتورة البيع.' });
    }
});

// Update material types for items (Operations Manager level)
router.post('/:id/update-material-types', authenticateToken, async (req, res) => {
    try {
        const { materialTypes } = req.body;
        
        const updated = await ServiceJob.updateMaterialTypes(req.params.id, materialTypes);
        if (!updated) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        res.json({ success: true, updated });
    } catch (error) {
        console.error('Error updating material types:', error);
        res.status(500).json({ message: 'فشل تحديث أنواع الأصناف.' });
    }
});

// Update inventory codes for items (Operations Manager level)
router.post('/:id/update-inventory-codes', authenticateToken, async (req, res) => {
    try {
        const { inventoryCodes } = req.body;
        
        const updated = await ServiceJob.updateInventoryCodes(req.params.id, inventoryCodes);
        if (!updated) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        res.json({ success: true, updated });
    } catch (error) {
        console.error('Error updating inventory codes:', error);
        res.status(500).json({ message: 'فشل تحديث الأكواد المخزنية.' });
    }
});

// مزامنة الفواتير التي ليس لها أوامر شغل
router.post('/sync-missing-from-sales', authenticateToken, async (req, res) => {
    try {
        const allInvoices = await SalesInvoice.find();
        const allCustomers = await Customer.find(); // Fetch all customers once
        const allCars = await Car.find(); // Fetch all cars once
        const allJobs = await ServiceJob.find();
        
        // Find and delete orphaned jobs (jobs whose invoice no longer exists)
        const invoiceIdsSet = new Set(allInvoices.map(inv => String(inv._id)));
        const orphanedJobs = allJobs.filter(job => job.salesInvoiceId && !invoiceIdsSet.has(String(job.salesInvoiceId)));
        let deletedCount = 0;
        for (const job of orphanedJobs) {
            console.log(`Deleting orphaned job ${job._id} - invoice ${job.salesInvoiceId} no longer exists`);
            await ServiceJob.deleteOne({ _id: job._id });
            deletedCount++;
        }
        
        const existingInvoiceIds = new Set(allJobs.map(j => String(j.salesInvoiceId)));
        
        const missingInvoices = allInvoices.filter(inv => !existingInvoiceIds.has(String(inv._id)));
        const customerMap = new Map(allCustomers.map(c => [String(c._id), c])); // Create customer map
        const carMap = new Map(allCars.map(c => [String(c._id), c])); // Create car map
        
        const createdJobs = [];
        for (const inv of missingInvoices) {
            // Resolve Customer Name
            let customerName = inv.customerName || '';
            if (!customerName && inv.customer) {
                const customerId = typeof inv.customer === 'object' ? inv.customer._id : inv.customer;
                const cust = customerMap.get(String(customerId)); // Use map for lookup
                if (cust) customerName = cust.name;
            }

            // Resolve Car Name
            let carDisplayName = '';
            const carId = typeof inv.carModel === 'object' ? inv.carModel._id : inv.carModel;
            const car = carMap.get(String(carId)); // Use map for lookup
            if (car) carDisplayName = `${car.brand || ''} ${car.model || ''}`.trim();
            if (!carDisplayName) {
                carDisplayName = typeof inv.carModel === 'object' 
                    ? `${inv.carModel.brand || ''} ${inv.carModel.model || ''}`.trim()
                    : (inv.carName || inv.carModel || '-');
            }

            const invoiceItems = inv.items || [];
            console.log(`Sync: Invoice ${inv.invoiceNumber} has ${invoiceItems.length} items`);
            if (invoiceItems.length > 0) {
                console.log('First item fields:', Object.keys(invoiceItems[0]));
                console.log('First item category:', invoiceItems[0].category || invoiceItems[0].materialCategory);
            }

            // Hydrate items with product data to get proper categories
            const hydratedItems = await Promise.all(invoiceItems.map(async (item) => {
                const productId = typeof item.product === 'object' ? item.product._id : item.product;
                let materialCategory = item.materialCategory || item.category || item.serviceType || '';
                
                // If product exists, get its category information
                if (productId) {
                    try {
                        const product = await db.findOne('products', { _id: productId });
                        if (product) {
                            materialCategory = materialCategory || product.category || product.type || product.serviceCategory || '';
                        }
                    } catch (error) {
                        console.error('Error fetching product for category:', error);
                    }
                }
                
                return {
                    ...item,
                    partName: item.partName || item.productName || item.description || '',
                    materialCategory,
                    lengthCM: item.lengthCM || item.length || 0,
                    widthCM: item.widthCM || item.width || 0,
                    area: item.area || 0,
                    issueStatus: 'Pending',
                    product: productId
                };
            }));
            
            const newJob = await ServiceJob.create({
                salesInvoiceId: inv._id,
                invoiceNumber: inv.invoiceNumber,   // رقم الفاتورة — المفتاح المشترك مع إذن الصرف
                jobOrder: inv.invoiceNumber,
                date: inv.date,
                customer: inv.customer,
                customerName: customerName,
                carModel: inv.carModel,
                carName: carDisplayName,
                serviceType: inv.serviceType || '',
                status: 'PENDING_OPS', // New status for Operations Manager
                workflowStatus: 'AwaitingTechnician', // Backward compatibility
                items: hydratedItems
            });
            console.log(`Created job ${newJob._id} with ${newJob.items?.length || 0} items`);
            
            // Update invoice with the new job ID
            await SalesInvoice.updateOne({ _id: inv._id }, { serviceJobId: newJob._id });
            createdJobs.push(newJob);
        }
        
        res.json({ 
            success: true, 
            message: `تمت المزامنة بنجاح. تم حذف ${deletedCount} أمر غير مرتبط، وإنشاء ${createdJobs.length} أمر شغل جديد.`,
            deleted: deletedCount,
            created: createdJobs.length 
        });
    } catch (error) {
        console.error('Error syncing jobs:', error);
        res.status(500).json({ message: 'فشل مزامنة أوامر التشغيل.' });
    }
});
// =====================================
// STEP 3: Ops Setup Route
// =====================================
router.put('/:id/ops-setup', authenticateToken, async (req, res) => {
    try {
        const { itemsData, requiredProducts, technicianAssignments } = req.body;

        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        // بناء map للفنيين من الـ assignments المرسلة
        const techMap = {};
        for (const td of (itemsData || [])) {
            if (td.assignedTechnicianId && td.assignedTechnicianId !== 'null') {
                if (!techMap[td.assignedTechnicianId]) {
                    // جلب اسم الفني من قاعدة البيانات
                    try {
                        const emp = await Employee.findById(td.assignedTechnicianId);
                        techMap[td.assignedTechnicianId] = emp ? emp.name : '';
                    } catch (_) { techMap[td.assignedTechnicianId] = ''; }
                }
            }
        }

        const currentItems = job.items || [];
        const updatedItems = currentItems.map((item, index) => {
            const data = itemsData?.find(d => d.itemIndex === index);
            if (data) {
                const techId   = data.assignedTechnicianId || item.assignedTechnicianId || null;
                const techName = (techId && techId !== 'null') ? (techMap[techId] || item.technicianName || '') : (item.technicianName || '');
                return {
                    ...item,
                    product:              data.productId || item.product,
                    assignedTechnicianId: techId,
                    technicianName:       techName   // ← حفظ الاسم مباشرة في الـ item
                };
            }
            return item;
        });

        const updated = await ServiceJob.updateOne(
            { _id: req.params.id },
            {
                items:                updatedItems,
                requiredProducts:     requiredProducts     || [],
                technicianAssignments: technicianAssignments || [],
                status:               'PENDING_WAREHOUSE',
                workflowStatus:       'PENDING_WAREHOUSE'
            }
        );

        res.json({ success: true, updated });
    } catch (error) {
        console.error('Error in ops-setup:', error);
        res.status(500).json({ message: 'فشل إعداد أمر التشغيل.' });
    }
});

// =====================================
// STEP 5: Post-Job Technician Rating
// =====================================
router.put('/:id/rate-technicians', authenticateToken, async (req, res) => {
    try {
        const { ratings } = req.body; // array of { technicianId, partName, rating }
        
        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        if (job.status !== 'IN_PROGRESS' && job.status !== 'COMPLETED') {
            return res.status(400).json({ message: 'حالة أمر التشغيل لا تسمح بالتقييم الآن.' });
        }

        const assignments = job.technicianAssignments || [];
        for (const assignment of assignments) {
             const matchingRating = (ratings || []).find(r => 
                 String(r.technicianId) === String(assignment.technicianId) && 
                 r.partName === assignment.partName
             );
             if (matchingRating && matchingRating.rating >= 1 && matchingRating.rating <= 10) {
                 assignment.rating = matchingRating.rating;
             }
        }

        const updated = await ServiceJob.updateOne(
            { _id: req.params.id },
            {
                technicianAssignments: assignments,
                status: 'COMPLETED',
                workflowStatus: 'COMPLETED',
                evaluationStatus: 'Completed'
            }
        );

        res.json({ success: true, updated });
    } catch (error) {
        console.error('Error in rate-technicians:', error);
        res.status(500).json({ message: 'فشل حفظ التقييم.' });
    }
});

// =====================================
// STEP 6: Cutting Action (Generate Remnant)
// =====================================
router.put('/:id/cutting-action', authenticateToken, async (req, res) => {
    try {
        const { inspectionReport, cutLength, cutWidth, remainingLength, remainingWidth, rollBarcode } = req.body;
        
        const job = await ServiceJob.findById(req.params.id);
        if (!job) {
            return res.status(404).json({ message: 'أمر التشغيل غير موجود.' });
        }

        // Ensure the job is in a state where cutting is allowed (e.g., IN_PROGRESS)
        const currentStatus = normalizeServiceJobStatus(job.status || job.workflowStatus);
        if (currentStatus !== 'IN_PROGRESS') {
            return res.status(400).json({ message: 'لا يمكن إجراء عملية القص إلا على أمر تشغيل قيد التنفيذ.' });
        }

        // تحديث أمر الشغل بتقرير المعاينة وبيانات القص
        const updated = await ServiceJob.updateOne(
            { _id: req.params.id },
            {
                inspectionReport: inspectionReport || '',
                cuttingData: {
                    cutLength: Number(cutLength) || 0,
                    cutWidth: Number(cutWidth) || 0,
                    remainingLength: Number(remainingLength) || 0,
                    remainingWidth: Number(remainingWidth) || 0,
                    rollBarcode: rollBarcode || '',
                    cutAt: new Date().toISOString()
                }
            });

        // Delegate inventory update and remnant creation to inventoryService
        // The inventoryService will handle finding the roll, updating its dimensions,
        // and creating a new remnant piece if remainingLength/Width > 0.
        const warehouseId = job.warehouseId || 'main_warehouse'; // Assuming job has a warehouseId
        await inventoryService.processCuttingAction({
            rollBarcode,
            cutLength,
            cutWidth,
            remainingLength, // Pass remainingLength from UI
            remainingWidth,  // Pass remainingWidth from UI
            jobId: job._id,
            warehouseId,
            inspectionReport // Pass inspection report for potential logging in stock transaction
        });
        
        // Optionally, create a stock transaction for the cut
        await db.create('stocktransactions', {
            type: 'Outbound',
            source: 'ServiceJobCutting',
            serviceJobId: job._id,
            jobOrder: job.jobOrder,
            warehouseId,
            items: [{
                rollCode: rollBarcode,
                cutLength,
                cutWidth,
                remainingLength,
                remainingWidth,
                productName: job.items[0]?.productData?.name || 'Unknown Product', // Assuming first item is representative
                area: (cutLength * cutWidth) / 10000 // Area consumed
            }],
            status: 'completed',
            createdAt: new Date().toISOString()
        }
        );
        res.json({ success: true, updated });
    } catch (error) {
        console.error('Error in cutting-action:', error);
        res.status(500).json({ message: 'فشل إتمام القص وتوليد الفضلة.' });
    }
});


module.exports = router;
