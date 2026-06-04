const express = require('express');
const router = express.Router();
const fs = require('fs');
const path = require('path');

const matrixFilePath = path.join(__dirname, '../data_storage/pricingmatrices/pricing_matrix.json');

// 1. ??? ????????
router.get('/matrix', (req, res) => {
    try {
        if (!fs.existsSync(matrixFilePath)) return res.json([]);
        const data = fs.readFileSync(matrixFilePath, 'utf8');
        res.json(JSON.parse(data));
    } catch (error) {
        res.status(500).json({ error: "??? ????? ????????" });
    }
});

// 2. ??? ????????
router.post('/matrix', (req, res) => {
    try {
        const dir = path.dirname(matrixFilePath);
        if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
        fs.writeFileSync(matrixFilePath, JSON.stringify(req.body, null, 2));
        res.json({ success: true });
    } catch (error) {
        res.status(500).json({ error: "??? ??? ????????" });
    }
});

// 3. ???? ??? Window Film
router.get('/calculate', (req, res) => {
    try {
        const { materialType, vehicleCategory, carPart, area, grade } = req.query;
        if (!fs.existsSync(matrixFilePath)) {
            return res.json({ totalPrice: 0 });
        }
        const matrix = JSON.parse(fs.readFileSync(matrixFilePath, 'utf8'));
        const entry = matrix.find(e =>
            String(e.carSize).trim().toLowerCase() === String(vehicleCategory).trim().toLowerCase() &&
            String(e.partName).trim().toLowerCase() === String(carPart).trim().toLowerCase()
        );
        if (entry) {
            const netPrice = entry.netPrice || (entry.inclusivePrice / 1.14);
            const total = netPrice * (parseFloat(area) || 1);
            res.json({ basePrice: netPrice, totalPrice: total, pricingUsed: entry });
        } else {
            res.json({ totalPrice: 0 });
        }
    } catch (error) {
        res.status(500).json({ error: "??? ???? ?????" });
    }
});

// 4. ???? ??? ???????? ?????? (PPF, Matt, Vinyl)
router.get('/product-price', async (req, res) => {
    try {
        const { serviceName, quantity, area } = req.query;
        const Product = require('../models/Product');
        const products = await Product.find();
        const categoryProduct = products.find(p =>
            String(p.type || p.category || '').toLowerCase() === String(serviceName || '').toLowerCase()
        );
        if (categoryProduct && categoryProduct.pricing) {
            let price = categoryProduct.pricing.priceWithoutVat || 0;
            if (price === 0 && categoryProduct.pricing.salePrice) {
                price = categoryProduct.pricing.salePrice / 1.14;
            }
            const qty = parseFloat(quantity) || 1;
            res.json({ priceWithoutVat: price * qty, priceWithVat: price * qty * 1.14 });
        } else {
            res.json({ priceWithoutVat: 0, priceWithVat: 0 });
        }
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
