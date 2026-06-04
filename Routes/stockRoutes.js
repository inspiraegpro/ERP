const express = require('express');
const router = express.Router();
const FileDbManager = require('../file_db_manager');
const inventoryService = require('../services/inventoryService');
const { authenticateToken: auth } = require('../middleware/auth');

const db = new FileDbManager();

// POST: حساب المساحة بالمتر المربع من الطول والعرض بالسنتيمتر
router.post('/calculate-area', auth, async (req, res) => {
    try {
        const { lengthCm, widthCm } = req.body;
        const length = Number(lengthCm || 0);
        const width = Number(widthCm || 0);
        const areaM2 = (length * width) / 10000;
        res.json({ lengthCm: length, widthCm: width, areaM2: Number(areaM2.toFixed(4)) });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST: توليد كود رول تلقائي للاستلام
router.post('/generate-roll-code', auth, async (req, res) => {
    try {
        const { ref, index, productName, date, lengthCm, widthCm } = req.body;
        
        // تنسيق: {last5digits}/{index+1}-{productName}-{yyyymmdd}-{lengthCm×widthCm}
        const refDigits = String(ref || '').replace(/[^0-9]/g, '');
        const last5 = refDigits.length >= 5 ? refDigits.slice(-5) : refDigits.padStart(5, '0');
        const nameToken = String(productName || 'XX').trim().replace(/\s+/g, '');
        const dateToken = String(date || '').trim().replace(/[^0-9]/g, '').slice(0, 8) || new Date().toISOString().slice(0, 10).replace(/-/g, '');
        const l = Math.max(0, Math.round(Number(lengthCm || 0)));
        const w = Math.max(0, Math.round(Number(widthCm || 0)));
        const sizeToken = (l && w) ? `${l}×${w}` : '';
        
        let rollCode = `${last5}/${index + 1}-${nameToken}`;
        if (dateToken) rollCode += `-${dateToken}`;
        if (sizeToken) rollCode += `-${sizeToken}`;
        
        // التحقق من عدم تكرار الكود
        const existing = await db.findOne('rollbalances', { rollCode });
        if (existing) {
            // إضافة لاحقة عشوائية إذا كان مكرراً
            rollCode += `-${Math.floor(Math.random() * 1000)}`;
        }
        
        res.json({ rollCode });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// ─── مولّد رقم مسلسل فريد ────────────────────────────────────────────────────
async function generateSerialNumber(type) {
    const prefix = (type === 'Inbound' || type === 'Stock In') ? 'IN' : 'OUT';
    const all    = await db.find('stocktransactions');
    const same   = all.filter(t => String(t.serialNumber || '').startsWith(prefix));
    const max    = same.reduce((m, t) => {
        const n = parseInt(String(t.serialNumber).replace(prefix, '')) || 0;
        return n > m ? n : m;
    }, 0);
    return `${prefix}-${String(max + 1).padStart(5, '0')}`;
}

// GET: All Transactions
router.get('/', auth, async (req, res) => { 
    try {
        const { type, warehouse, supplierDoc, jobOrder } = req.query;
        const filters = {};
        if (type)        filters.type        = type;
        if (warehouse)   filters.warehouse   = warehouse;
        if (supplierDoc) filters.supplierDoc = supplierDoc;
        if (jobOrder)    filters.jobOrder    = jobOrder;
        
        const transactions = await db.find('stocktransactions', filters);
        res.json(transactions || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET: Available Rolls (Helper for Stock-Out or Stock-In validation)
router.get('/available-rolls', auth, async (req, res) => {
    try {
        const { productId, warehouse, warehouseId } = req.query;
        if(!productId) return res.json([]);
        
        const warehouseFilter = String(warehouse || warehouseId || '').trim();
        const rolls = await db.find('rollbalances');
        const filtered = rolls.filter(r => {
            const productMatch = String(r.product) === String(productId) || String(r.productCode) === String(productId);
            const statusMatch = r.status === 'Available' || r.status === 'PartiallyUsed';
            const warehouseMatch = !warehouseFilter ||
                String(r.warehouse).trim() === warehouseFilter ||
                String(r.warehouseId).trim() === warehouseFilter;
            return productMatch && statusMatch && warehouseMatch;
        });
        
        res.json(filtered.map(r => ({
            rollCode: r.rollCode,
            remainingArea: r.remainingArea || r.currentArea || 0,
            originalWidth: r.width || r.widthCm || 0,
            originalLength: r.length || r.lengthCm || 0,
            status: r.status,
            display: `${r.rollCode} (Available: ${(r.remainingArea || r.currentArea || 0).toFixed(2)} m²)`
        })));
    } catch(e) {
        res.status(500).json({ error: e.message });
    }
});

// GET: Smart Suggestions for Stock-Out (Waste-First Consumption)
router.get('/smart-suggestions', auth, async (req, res) => {
    try {
        const { productId, area, lengthCm, widthCm, warehouse } = req.query;
        
        if (!productId) {
            return res.status(400).json({ error: 'productId is required' });
        }

        const suggestions = await inventoryService.getSmartSuggestions(
            productId,
            parseFloat(area)    || 0,
            parseFloat(lengthCm)|| 0,
            parseFloat(widthCm) || 0,
            warehouse || ''
        );

        res.json(suggestions);
    } catch (error) {
        console.error('Error in smart-suggestions:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST: Create Stock Transaction (Stock In / Stock Out)
router.post('/', auth, async (req, res) => {
    try {
        const txData = req.body;

        // رقم مسلسل فريد تلقائياً إذا لم يُرسَل أو كان مكرراً
        const providedSerial = String(txData.serialNumber || '').trim();
        let serialNumber = providedSerial;
        if (!serialNumber) {
            serialNumber = await generateSerialNumber(txData.type);
        } else {
            // تحقق من التكرار
            const existing = await db.findOne('stocktransactions', { serialNumber: providedSerial });
            if (existing) {
                return res.status(400).json({ message: 'رقم الإذن مكرر، يرجى إدخال رقم مختلف أو تركه فارغاً للتوليد التلقائي.', error: 'رقم الإذن مكرر.' });
            }
        }

        // 1. Create the transaction record
        const transaction = await db.create('stocktransactions', {
            ...txData,
            serialNumber,
            reversedBy:  null,   // يُملأ عند الإلغاء
            isReversed:  false,
            createdAt:   new Date().toISOString()
        });

        // 2. Process the transaction effect on inventory balance
        if (transaction.type === 'Inbound' || transaction.type === 'Stock In') {
            await inventoryService.processInbound(transaction);
        } else if (transaction.type === 'Outbound' || transaction.type === 'Stock Out') {
            await inventoryService.processOutbound(transaction);
        }

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error creating stock transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET: Transactions by Purchase Invoice
router.get('/by-purchase/:purchaseId', auth, async (req, res) => {
    try {
        const transactions = await db.find('stocktransactions');
        const filtered = transactions.filter(t => t.purchaseInvoiceId === req.params.purchaseId);
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Stock Transaction by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const transaction = await db.findOne('stocktransactions', { _id: req.params.id });
        if (!transaction) {
            return res.status(404).json({ error: 'الإذن المخزني غير موجود.' });
        }
        res.json(transaction);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// POST: Reverse (Undo) a Stock Transaction — يُنشئ حركة عكسية ويُعيد الأرصدة
router.post('/:id/reverse', auth, async (req, res) => {
    try {
        const original = await db.findOne('stocktransactions', { _id: req.params.id });
        if (!original) {
            return res.status(404).json({ error: 'الإذن المخزني غير موجود.' });
        }
        if (original.isReversed) {
            return res.status(400).json({ error: 'هذا الإذن تم إلغاؤه مسبقاً.' });
        }

        // نوع الحركة العكسية
        const reverseType = (original.type === 'Inbound' || original.type === 'Stock In')
            ? 'Outbound'
            : 'Inbound';

        const reverseSerial = await generateSerialNumber(reverseType);

        // إنشاء الحركة العكسية
        const reversal = await db.create('stocktransactions', {
            type:             reverseType,
            serialNumber:     reverseSerial,
            date:             new Date().toISOString().split('T')[0],
            jobOrder:         original.jobOrder    || null,
            jobOrderId:       original.jobOrderId  || null,
            warehouseId:      original.warehouseId || original.warehouse,
            warehouse:        original.warehouseId || original.warehouse,
            carName:          original.carName     || '',
            customerName:     original.customerName|| '',
            items:            original.items       || [],
            notes:            `إلغاء إذن ${original.serialNumber} — ${req.body.reason || 'بدون سبب'}`,
            source:           'Reversal',
            reversalOf:       original._id,
            isReversed:       false,
            reversedBy:       null,
            status:           'completed',
            createdAt:        new Date().toISOString()
        });

        // تطبيق الأثر العكسي على المخزون
        if (reverseType === 'Inbound') {
            await inventoryService.processInbound(reversal);
        } else {
            await inventoryService.processOutbound(reversal);
        }

        // تعليم الأصل كـ "مُلغى"
        await db.updateOne('stocktransactions', { _id: original._id }, {
            isReversed:  true,
            reversedBy:  reversal._id,
            reversedAt:  new Date().toISOString()
        });

        res.status(201).json({
            message:  `تم إلغاء الإذن ${original.serialNumber} وإنشاء حركة عكسية ${reverseSerial}`,
            original: { _id: original._id, serialNumber: original.serialNumber },
            reversal
        });
    } catch (error) {
        console.error('Error reversing stock transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST: Bulk delete multiple stock transactions by IDs
router.post('/bulk-delete', auth, async (req, res) => {
    try {
        const ids = Array.isArray(req.body.ids) ? req.body.ids : [];
        if (ids.length === 0) {
            return res.status(400).json({ error: 'يجب إرسال قائمة بالمعرفات للحذف.' });
        }

        let deletedCount = 0;
        let notFoundCount = 0;

        for (const id of ids) {
            const deleted = await db.deleteOne('stocktransactions', { _id: id });
            if (deleted) deletedCount += 1;
            else notFoundCount += 1;
        }

        res.json({
            message: `تم حذف ${deletedCount} حركة بنجاح.`,
            deletedCount,
            notFoundCount
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE: Remove a Stock Transaction by ID (حذف مباشر — استخدم /reverse للإلغاء الآمن)
router.delete('/:id', auth, async (req, res) => {
    try {
        const deleted = await db.deleteOne('stocktransactions', { _id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'الإذن المخزني غير موجود.' });
        }
        res.json({ message: 'تم حذف الإذن المخزني.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
