const express = require('express');
const router = express.Router();
const multer = require('multer');

// استدعاء الحماية بشكل آمن لمنع تعطل السيرفر (Defensive Import)
const authModule = require('../middleware/auth');
const auth = typeof authModule.authenticateToken === 'function' ? authModule.authenticateToken : (req, res, next) => next();

const InventoryPiece = require('../models/InventoryPiece');
const inventoryService = require('../services/inventoryService');
const FileDbManager = require('../file_db_manager');

const db = new FileDbManager();
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// Inventory Pieces - القطع المقطوعة
// ==========================================

// الحصول على جميع القطع
router.get('/pieces', auth, async (req, res) => {
    try {
        const { status, materialType, productCode, parentRollCode, type } = req.query;
        const filters = {};
        
        if (status) filters.status = status;
        if (materialType) filters.materialType = materialType;
        if (productCode) filters.productCode = productCode;
        if (parentRollCode) filters.parentRollCode = parentRollCode;
        if (type) filters.type = type;
        
        const pieces = await InventoryPiece.findAll(filters);
        res.json(pieces || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// الحصول على قطعة بواسطة الكود
router.get('/pieces/by-code/:code', auth, async (req, res) => {
    try {
        const piece = await InventoryPiece.findByCode(req.params.code);
        if (!piece) {
            return res.status(404).json({ error: 'Piece not found' });
        }
        res.json(piece);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// إنشاء قطعة جديدة
router.post('/pieces', auth, async (req, res) => {
    try {
        const piece = new InventoryPiece(req.body);
        await piece.save();
        res.status(201).json(piece);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تحديث قطعة
router.put('/pieces/:id', auth, async (req, res) => {
    try {
        const piece = await InventoryPiece.update(req.params.id, req.body);
        res.json(piece);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// حذف قطعة
router.delete('/pieces/:id', auth, async (req, res) => {
    try {
        await InventoryPiece.delete(req.params.id);
        res.json({ message: 'Piece deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// Roll Balances - رصيد الرولات
// ==========================================

// الحصول على جميع الرولات
router.get('/rolls', auth, async (req, res) => {
    try {
        const { status, product, warehouse } = req.query;
        const filters = {};
        
        if (status) filters.status = status;
        if (product) filters.product = product;
        if (warehouse) filters.warehouse = warehouse;
        
        const rolls = await db.find('rollbalances', filters);
        res.json(rolls || []);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// الحصول على رول بواسطة الكود
router.get('/rolls/:code', auth, async (req, res) => {
    try {
        const rolls = await db.find('rollbalances');
        const roll = (rolls || []).find(r => r.rollCode === req.params.code || r.barcode_id === req.params.code);
        
        if (!roll) {
            return res.status(404).json({ error: 'Roll not found' });
        }
        
        res.json(roll);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// Opening Balance & Barcode Center - مركز الأرصدة الافتتاحية
// ==========================================

// معاينة الملف قبل الاستيراد
router.post('/opening-balance/preview', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        const text = req.file.buffer.toString('utf8');
        const rows = inventoryService.parseOpeningInventoryText(text);
        
        const rolls = rows.filter(r => r.itemType === 'roll').length;
        const remnants = rows.filter(r => r.itemType === 'remnant').length;
        
        res.json({
            totalRows: rows.length,
            rolls,
            remnants,
            sample: rows.slice(0, 5)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// استيراد الأرصدة الافتتاحية
router.post('/opening-balance/import', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ error: 'No file uploaded' });
        let { warehouseId } = req.body;
        
        // Fix warehouse mismatch
        if (warehouseId === 'main_warehouse' || !warehouseId) {
            warehouseId = 'default-warehouse';
        }

        const text = req.file.buffer.toString('utf8');
        const rows = inventoryService.parseOpeningInventoryText(text);
        const result = await inventoryService.importOpeningInventoryRows(rows, warehouseId);
        
        // Ensure master products exist and fix broken references (products file may be overwritten later)
        const sync = await inventoryService.syncProductsFromStock({ dryRun: false });
        
        res.json({ ...result, sync });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// Sync Products Master from stock (rollbalances + pieces)
router.post('/sync-products-from-stock', auth, async (req, res) => {
    try {
        const dryRun = Boolean(req.body?.dryRun);
        const result = await inventoryService.syncProductsFromStock({ dryRun });
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تصفير المخزون التشغيلي
router.post('/opening-balance/reset', auth, async (req, res) => {
    try {
        const result = await inventoryService.resetOperationalInventory();
        res.json(result);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// البحث عن باركود (رول أو قطعة)
router.get('/lookup/:barcode', auth, async (req, res) => {
    try {
        const item = await inventoryService.findInventoryItemByBarcode(req.params.barcode);
        if (!item) return res.status(404).json({ error: 'Barcode not found' });
        res.json(item);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ==========================================
// Inventory Reports - تقارير المخزون
// ==========================================

// تقرير الجرد التفصيلي
router.get('/report/detailed', auth, async (req, res) => {
    try {
        const rolls = await db.find('rollbalances');
        const pieces = await InventoryPiece.findAll({ status: 'available' });
        
        res.json({
            rolls: rolls || [],
            pieces: pieces || [],
            totalRolls: (rolls || []).length,
            totalPieces: (pieces || []).length
        });
    } catch (error) {
        console.error('Error in /report/detailed:', error);
        res.status(500).json({ error: error.message });
    }
});

// تقرير حركات المخزون
router.get('/reports/movement', auth, async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        const filters = {};
        if (startDate && endDate) {
            filters.date = { $gte: startDate, $lte: endDate };
        }
        
        const transactions = await db.find('stocktransactions', filters);
        const inbound = (transactions || []).filter(t => String(t.type).toLowerCase() === 'inbound');
        const outbound = (transactions || []).filter(t => String(t.type).toLowerCase() === 'outbound');

        const totalInboundArea = inbound.reduce((sum, trx) => {
            return sum + (Array.isArray(trx.items) ? trx.items.reduce((s, i) => s + (Number(i.area || i.quantity || 0)), 0) : 0);
        }, 0);
        const totalOutboundArea = outbound.reduce((sum, trx) => {
            return sum + (Array.isArray(trx.items) ? trx.items.reduce((s, i) => s + (Number(i.consumedArea || i.area || i.quantity || 0)), 0) : 0);
        }, 0);

        res.json({
            transactions: transactions || [],
            inbound,
            outbound,
            summary: {
                total: (transactions || []).length,
                totalInboundArea,
                totalOutboundArea
            }
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تقرير فئات المخزون
router.get('/reports/category', auth, async (req, res) => {
    try {
        const rolls = await db.find('rollbalances');
        const pieces = await InventoryPiece.findAll({ status: 'available' });
        const products = await db.find('products');
        const priceByName = (products || []).reduce((map, prod) => {
            map[prod.name] = prod.pricing?.purchasePrice || prod.pricing?.standardCost || 0;
            return map;
        }, {});

        const grouped = {};

        const processItem = (item, type) => {
            const key = item.productName || item.materialName || item.product || item.productCode || 'غير مصنف';
            const area = Number(item.area || item.currentArea || item.remainingArea || 0);
            if (!grouped[key]) {
                grouped[key] = { name: key, count: 0, totalArea: 0, totalValue: 0 };
            }
            grouped[key].count += 1;
            grouped[key].totalArea += area;
            grouped[key].totalValue += area * (priceByName[key] || 0);
        };

        (rolls || []).forEach(r => processItem(r, 'roll'));
        (pieces || []).forEach(p => processItem(p, 'piece'));

        const categories = Object.values(grouped).map(item => ({
            ...item,
            percentage: 0
        }));
        const totalArea = categories.reduce((sum, item) => sum + item.totalArea, 0);
        categories.forEach(item => {
            item.percentage = totalArea > 0 ? (item.totalArea / totalArea) * 100 : 0;
        });

        res.json({ categories, totalArea, totalCategories: categories.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تقرير النواقص في المخزون
router.get('/reports/lowstock', auth, async (req, res) => {
    try {
        const rolls = await db.find('rollbalances');
        const pieces = await InventoryPiece.findAll({ status: 'available' });
        const products = await db.find('products');

        const stockByProduct = {};
        const productMin = {};

        const productName = item => item.productName || item.materialName || item.product || item.productCode || 'غير مصنف';

        const addItem = item => {
            const name = productName(item);
            const area = Number(item.area || item.currentArea || item.remainingArea || 0);
            if (!stockByProduct[name]) {
                stockByProduct[name] = { productName: name, currentStock: 0, minStock: 10, dailyConsumption: 0 };
            }
            stockByProduct[name].currentStock += area;
        };

        (rolls || []).forEach(addItem);
        (pieces || []).forEach(addItem);

        const items = Object.values(stockByProduct).map(item => ({
            ...item,
            daysRemaining: item.dailyConsumption > 0 ? Math.round(item.currentStock / item.dailyConsumption) : 999,
            status: item.currentStock <= item.minStock ? 'منخفض' : 'مستقر'
        })).filter(item => item.currentStock <= item.minStock + 5);

        res.json({ items, count: items.length });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// تقرير البواقي
router.get('/reports/remnants', auth, async (req, res) => {
    try {
        const remnants = await InventoryPiece.findRemnants();
        
        res.json({
            remnants: remnants || [],
            total: (remnants || []).length,
            totalArea: (remnants || []).reduce((sum, r) => sum + (r.area || 0), 0)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// 11. Search for available pieces and rolls (Smart Suggestions)
router.get('/pieces/suggestions/:productId', auth, async (req, res) => {
    try {
        const { productId } = req.params;
        const { area, lengthCm, widthCm, warehouse } = req.query;
        const suggestions = await inventoryService.getSmartSuggestions(
            productId, 
            parseFloat(area) || 0,
            parseFloat(lengthCm) || 0,
            parseFloat(widthCm) || 0,
            warehouse || ''
        );
        res.json(suggestions);
    } catch (error) {
        console.error('Error fetching suggestions:', error);
        res.status(500).json({ message: 'Error fetching suggestions' });
    }
});

// 12. Execute Stock Out
router.post('/stock-out', auth, async (req, res) => {
    try {
        const transactionData = req.body;
        
        // 1. Save Transaction to stocktransactions collection
        const stockTrx = await db.create('stocktransactions', {
            ...transactionData,
            jobOrderId: transactionData.jobOrderId || null,
            status: 'completed',
            createdAt: new Date().toISOString()
        });

        // 2. Process Inventory Changes
        await inventoryService.processOutbound(transactionData);

        try {
            // Generate GL Entry for Stock Out
            const glLogic = require('../services/glLogic');
            const glService = require('../services/glService');
            
            // Calculate total cost for the outbound items
            let totalCost = 0;
            const outboundItems = transactionData.items || [];
            for (const item of outboundItems) {
                 const product = await db.findById('products', item.product || item.productCode);
                 totalCost += (Number(product?.cost || 1) * Number(item.quantity || item.area || 1));
            }

            if (totalCost > 0) {
                 const mockInvoice = {
                      invoiceNumber: transactionData.jobOrder || transactionData.jobOrderId || `TRX-${Date.now()}`,
                      items: outboundItems.map(item => ({ product: item.product || item.productCode, cost: totalCost / outboundItems.length }))
                 };
                 
                 const details = await glLogic.getCogsEntryDetails(mockInvoice, totalCost);
                 
                 if (details && details.length > 0) {
                      await glService.createGlEntry({
                           date: new Date().toISOString(),
                           description: `صرف بضاعة مخزن - حركة رقم ${mockInvoice.invoiceNumber}`,
                           referenceNumber: `OUT-${mockInvoice.invoiceNumber}`,
                           journalType: 'Inventory',
                           details: details
                      });
                 }
            }
        } catch (glError) {
            console.error('Failed to generate GL Entry for Stock Out:', glError.message);
            // We still processed the stock out physically, but warn about GL error
            return res.status(400).json({ message: 'Stock out processed, but accounting entry failed: ' + glError.message });
        }

        res.json({ message: 'Stock out processed successfully', transaction: stockTrx });
    } catch (error) {
        console.error('Stock out error:', error);
        res.status(500).json({ message: 'Failed to process stock out', error: error.message });
    }
});

// =====================================
// STEP 4: Warehouse Issuance (Stock Out)
// =====================================
router.put('/issue-job/:jobId', auth, async (req, res) => {
    try {
        const { issuedInventory, warehouseId } = req.body; // array of { barcode, quantity, itemIndex }
        const jobId = req.params.jobId;

        const ServiceJob = require('../models/ServiceJob');
        const job = await ServiceJob.findById(jobId);
        if (!job) return res.status(404).json({ message: 'Service Job not found' });

        if (job.status !== 'PENDING_WAREHOUSE' && job.workflowStatus !== 'PENDING_WAREHOUSE') {
           return res.status(400).json({ message: 'Job is not pending warehouse issue.' });
        }

        const outboundItems = [];
        const warnings = [];

        for (const item of (issuedInventory || [])) {
             const inventoryItem = await inventoryService.findInventoryItemByBarcode(item.barcode);
             if (!inventoryItem) {
                 return res.status(400).json({ message: `Barcode ${item.barcode} not found.` });
             }

             // Check for barcode mismatch with selectedInventoryCode (non-blocking warning)
             const jobItem = (job.items || [])[item.itemIndex || 0];
             if (jobItem && jobItem.selectedInventoryCode && jobItem.selectedInventoryCode !== item.barcode) {
                 warnings.push({
                     itemIndex: item.itemIndex,
                     expected: jobItem.selectedInventoryCode,
                     scanned: item.barcode,
                     message: `تحذير: الباركود الممسوح (${item.barcode}) لا يطابق الصنف المختار (${jobItem.selectedInventoryCode})`
                 });
                 console.warn(`Barcode mismatch for job ${jobId}: expected ${jobItem.selectedInventoryCode}, got ${item.barcode}`);
             }

             outboundItems.push({
                 product: inventoryItem.raw.product || inventoryItem.raw.productCode || inventoryItem.raw._id,
                 quantity: item.quantity,
                 rollCode: inventoryItem.itemType === 'roll' ? inventoryItem.code : undefined,
                 pieceCode: inventoryItem.itemType === 'piece' || inventoryItem.itemType === 'remnant' ? inventoryItem.code : undefined
             });
        }

        if (outboundItems.length > 0) {
            await inventoryService.processOutbound({
                warehouseId: warehouseId || 'main_warehouse',
                jobOrderId: job._id,
                items: outboundItems
            });

            await db.create('stocktransactions', {
                type: 'Outbound',
                source: 'ServiceJob',
                serviceJobId: job._id,
                jobOrder: job.jobOrder,
                warehouseId: warehouseId || 'main_warehouse',
                items: outboundItems,
                status: 'completed',
                createdAt: new Date().toISOString()
            });

            try {
                // Generate GL Entry for Stock Out
                const glLogic = require('../services/glLogic');
                const glService = require('../services/glService');
                
                // Calculate total cost for the outbound items
                let totalCost = 0;
                for (const item of outboundItems) {
                     const product = await db.findById('products', item.product);
                     totalCost += (Number(product?.cost || 1) * Number(item.quantity || 1));
                }

                if (totalCost > 0) {
                     // We use a mock invoice object to pass to getCogsEntryDetails
                     const mockInvoice = {
                          invoiceNumber: job.jobOrder,
                          items: outboundItems.map(item => ({ product: item.product, cost: totalCost / outboundItems.length }))
                     };
                     
                     const details = await glLogic.getCogsEntryDetails(mockInvoice, totalCost);
                     
                     if (details && details.length > 0) {
                          await glService.createGlEntry({
                               date: new Date().toISOString(),
                               description: `صرف بضاعة مخزن - أمر تشغيل رقم ${job.jobOrder}`,
                               referenceNumber: `OUT-${job.jobOrder}`,
                               journalType: 'Inventory',
                               details: details
                          });
                     }
                }
            } catch (glError) {
                console.error('Failed to generate GL Entry for Stock Out:', glError.message);
                // Return clear error string if account is missing
                return res.status(400).json({ message: glError.message });
            }
        }

        await ServiceJob.updateOne(
            { _id: jobId },
            {
                issuedInventory: issuedInventory || [],
                status: 'IN_PROGRESS',
                workflowStatus: 'IN_PROGRESS',
                warehouseIssuedAt: new Date().toISOString()
            }
        );

        res.json({
            message: 'Items issued successfully',
            warnings: warnings.length > 0 ? warnings : undefined
        });
    } catch (error) {
        console.error('Issue Job Error:', error);
        res.status(500).json({ message: 'Failed to issue items', error: error.message });
    }
});

module.exports = router;
