const express = require('express');
const router = express.Router();
const purchaseService = require('../services/purchaseService');
const { authenticateToken: auth } = require('../middleware/auth');

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
        const purchase = await purchaseService.createPurchase(req.body);
        res.status(201).json(purchase);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// PUT update purchase
router.put('/:id', auth, async (req, res) => {
    try {
        const purchase = await purchaseService.updatePurchase(req.params.id, req.body);
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
