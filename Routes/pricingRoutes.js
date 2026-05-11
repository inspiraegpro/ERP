const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');
const Product = require('../models/Product');
const pricingLogic = require('../services/pricingLogic');
const PricingMatrix = require('../models/PricingMatrix');

const matrixFilePath = path.join(__dirname, '../data_storage/pricingmatrices/pricing_matrix.json');

// 1. جلب بيانات المصفوفة (بدون Auth)
router.get('/matrix', (req, res) => {
    try {
        if (!fs.existsSync(matrixFilePath)) return res.json([]);
        const data = fs.readFileSync(matrixFilePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: "فشل تحميل المصفوفة: " + error.message });
    }
});

// 2. حفظ التعديلات (بدون Auth)
router.post('/matrix', (req, res) => {
    try {
        const matrixDir = path.dirname(matrixFilePath);
        if (!fs.existsSync(matrixDir)) fs.mkdirSync(matrixDir, { recursive: true });

        const processed = req.body.map(item => ({
            ...item,
            inclusivePrice: parseFloat(item.inclusivePrice) || 0,
            netPrice: parseFloat((parseFloat(item.inclusivePrice) / 1.14).toFixed(2))
        }));

        fs.writeFileSync(matrixFilePath, JSON.stringify(processed, null, 2), 'utf8');
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "فشل حفظ المصفوفة: " + error.message });
    }
});

// 3. تسعير الفاتورة 
router.get('/product-price', async (req, res) => {
    try {
        const allProducts = await Product.find();
        const netPrice = await pricingLogic.getPriceForInvoice(req.query, allProducts);
        res.json({ 
            priceWithoutVat: netPrice, 
            priceWithVat: netPrice * 1.14 
        });
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// 4. حساب السعر من مصفوفة العزل (للفاتورة)
router.get('/calculate', (req, res) => {
    try {
        const { materialType, vehicleCategory, carPart, area, grade } = req.query;
        
        // قراءة ملف مصفوفة العزل
        if (!fs.existsSync(matrixFilePath)) {
            return res.json({ basePrice: 0, totalPrice: 0, pricingUsed: null });
        }
        
        const matrix = JSON.parse(fs.readFileSync(matrixFilePath, 'utf8'));
        
        // البحث عن السعر المطابق
        const entry = matrix.find(e => 
            String(e.carSize).trim().toLowerCase() === String(vehicleCategory).trim().toLowerCase() && 
            String(e.partName).trim().toLowerCase() === String(carPart).trim().toLowerCase()
        );
        
        if (entry) {
            const netPrice = entry.netPrice || (entry.inclusivePrice / 1.14);
            res.json({
                basePrice: netPrice,
                totalPrice: netPrice * (parseFloat(area) || 1),
                pricingUsed: entry
            });
        } else {
            res.json({ basePrice: 0, totalPrice: 0, pricingUsed: null });
        }
    } catch (error) {
        res.status(500).json({ error: "فشل حساب السعر: " + error.message });
    }
});

module.exports = router;