const express = require('express');
const router = express.Router();
const purchaseService = require('../services/purchaseService');
const FileDbManager = require('../file_db_manager');
const { authenticateToken: auth } = require('../middleware/auth');
const db = new FileDbManager();

// GET all purchases
router.get('/', auth, async (req, res) => {
    try {
        const purchases = await purchaseService.getAllPurchases();
        res.json(purchases);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET next invoice number
router.get('/number/next', auth, async (req, res) => {
    try {
        const next = await purchaseService.getNextInvoiceNumber();
        res.json({ next });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET purchase by invoice number (for receiving note)
router.get('/number/:ref/remaining', auth, async (req, res) => {
    try {
        const ref = decodeURIComponent(req.params.ref).trim().toLowerCase();
        const allPurchases = (await purchaseService.getAllPurchases()) || [];
        const purchase = allPurchases.find(p =>
            String(p._id).trim().toLowerCase() === ref ||
            (p.invoiceNumber && String(p.invoiceNumber).trim().toLowerCase() === ref)
        );

        if (!purchase) {
            return res.status(404).json({ error: 'Purchase invoice not found' });
        }

        const transactions = await db.find('stocktransactions', {
            supplierDoc: purchase.invoiceNumber || purchase._id
        });
        const inbound = (transactions || []).filter(t => String(t.type).toLowerCase() === 'inbound');
        const receivedByProduct = {};

        inbound.forEach((trx) => {
            (trx.items || []).forEach((item) => {
                const key = String(item.product?._id || item.product || '');
                receivedByProduct[key] = (receivedByProduct[key] || 0) + Number(item.quantity || 0);
            });
        });

        const remainingItems = (purchase.items || []).map((item) => {
            const key = String(item.product?._id || item.product || '');
            const ordered = Number(item.quantity || 0);
            const received = Number(receivedByProduct[key] || 0);
            const remaining = Math.max(0, Number((ordered - received).toFixed(2)));
            return {
                product: key,
                productName: item.product?.name || '',
                ordered,
                received,
                remaining,
                unitCost: Number(item.cost || 0)
            };
        });

        res.json({
            invoiceNumber: purchase.invoiceNumber || '',
            items: remainingItems,
            allReceived: remainingItems.every((row) => row.remaining <= 0.0001)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET purchase by invoice number (for receiving note)
router.get('/number/:ref', auth, async (req, res) => {
    try {
        // فك تشفير المرجع وإزالة المسافات لضمان المطابقة
        const ref = decodeURIComponent(req.params.ref).trim().toLowerCase();

        // جلب كل الفواتير للبحث الشامل المباشر وتجنب أي أخطاء في Service
        const allPurchases = (await purchaseService.getAllPurchases()) || [];
        
        // بحث ذكي جداً (يطابق كود الـ ID، أو رقم الفاتورة سواء حروف أو أرقام، ويتجاهل المسافات وحالة الأحرف)
        const purchase = allPurchases.find(p => 
            String(p._id).trim().toLowerCase() === ref || 
            (p.invoiceNumber && String(p.invoiceNumber).trim().toLowerCase() === ref)
        );

        if (!purchase) {
            return res.status(404).json({ error: 'Purchase invoice not found' });
        }
        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET single purchase by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const purchase = await purchaseService.getPurchaseById(req.params.id);
        if (!purchase) {
            return res.status(404).json({ error: 'Purchase not found' });
        }
        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// POST create purchase
router.post('/', auth, async (req, res) => {
    try {
        // Ensure date is set if missing
        if (!req.body.date) {
            req.body.date = new Date().toISOString();
        }
        const purchase = await purchaseService.createPurchase(req.body, req.user);
        res.status(201).json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update purchase
router.put('/:id', auth, async (req, res) => {
    try {
        const purchase = await purchaseService.updatePurchase(req.params.id, req.body, req.user);
        res.json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// DELETE purchase
router.delete('/:id', auth, async (req, res) => {
    try {
        await purchaseService.deletePurchase(req.params.id);
        res.json({ message: 'Purchase deleted successfully' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
