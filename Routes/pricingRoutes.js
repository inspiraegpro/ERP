const express = require('express');
const router = express.Router();
const pricingService = require('../services/pricingService');
const cuttingService = require('../services/cuttingService');
const validationService = require('../services/validationService');
const { authenticateToken: auth } = require('../middleware/auth');

const matrixFilePath = require('path').join(__dirname, '../data_storage/pricingmatrices/pricing_matrix.json');

router.get('/matrix', (req, res) => {
    try {
        res.json(pricingService.loadPricingMatrix());
    } catch (error) {
        res.status(500).json({ error: 'فشل قراءة المصفوفة' });
    }
});

router.post('/matrix', (req, res) => {
    try {
        pricingService.savePricingMatrix(req.body);
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: 'فشل حفظ المصفوفة' });
    }
});

router.get('/calculate', (req, res) => {
    try {
        const { vehicleCategory, carPart, area, grade } = req.query;
        const netPrice = pricingService.getWindowFilmPrice(vehicleCategory, carPart, grade);
        const qty = parseFloat(area) || 1;
        res.json({ basePrice: netPrice, totalPrice: netPrice * qty, netPrice });
    } catch (error) {
        res.status(500).json({ error: 'فشل حساب السعر' });
    }
});

router.get('/product-price', async (req, res) => {
    try {
        const { serviceName, quantity, area } = req.query;
        const lineTotal = await pricingService.getItemPrice({
            materialCategory: serviceName,
            area: parseFloat(area) || 0,
            quantity: parseFloat(quantity) || 1
        });
        const vatRate = pricingService.VAT_RATE;
        res.json({
            priceWithoutVat: lineTotal,
            priceWithVat: lineTotal * (1 + vatRate)
        });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/calculate-invoice', auth, async (req, res) => {
    try {
        const calculated = await pricingService.calculateInvoice(req.body);
        res.json(calculated);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/cutting/optimize', auth, async (req, res) => {
    try {
        const { rolls, pieces, allowRotate } = req.body;
        res.json(cuttingService.optimizeCutting(rolls, pieces, allowRotate !== false));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/cutting/calculate-waste', auth, async (req, res) => {
    try {
        const { rolls, pieces } = req.body;
        res.json(cuttingService.calculateWaste(rolls, pieces));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/integrity/check', auth, async (req, res) => {
    try {
        res.json(await validationService.checkJournalIntegrity());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.post('/integrity/cleanup', auth, async (req, res) => {
    try {
        res.json(await validationService.cleanupOrphanedJournals());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

router.get('/system-check', auth, async (req, res) => {
    try {
        res.json(await validationService.runFullSystemCheck());
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
