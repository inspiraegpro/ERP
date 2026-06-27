const express = require('express');
const router = express.Router();
const Product = require('../models/Product');
const { calculateFinancials, VAT_RATE } = require('../services/pricingService');

function buildPricingObject(salePrice) {
    const financials = calculateFinancials(salePrice);

    return {
        salePrice: financials.total,
        priceWithoutVat: financials.net,
        unitSalePrice: financials.total,
        vatRate: VAT_RATE,
        vatAmount: financials.vat,
        lastUpdated: new Date().toISOString()
    };
}

router.post('/', async (req, res) => {
    try {
        const data = req.body || {};

        data.dimensions = data.dimensions || {};
        data.dimensions.length = Number(data.dimensions.length) || 0;
        data.dimensions.width = Number(data.dimensions.width) || 0;
        data.dimensions.area = data.dimensions.length * data.dimensions.width;

        const inputPrice = Number(data.price) || Number(data.pricing?.salePrice) || 0;
        data.pricing = buildPricingObject(inputPrice);
        delete data.price;
        delete data.pricing.purchasePrice;
        data.currentStock = 0;
        
        data.isDefault = data.isDefault === true || data.isDefault === 'true';

        const newProduct = await Product.create(data);
        
        if (newProduct.isDefault && newProduct.type) {
            const products = await Product.find({ type: newProduct.type });
            for (const p of products) {
                if (String(p._id) !== String(newProduct._id) && p.isDefault) {
                    await Product.updateOne({ _id: p._id }, { isDefault: false });
                }
            }
        }

        res.status(201).json(newProduct);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/:id', async (req, res) => {
    try {
        const data = req.body || {};

        if (data.dimensions) {
            data.dimensions.length = Number(data.dimensions.length) || 0;
            data.dimensions.width = Number(data.dimensions.width) || 0;
            data.dimensions.area = data.dimensions.length * data.dimensions.width;
        }

        if (data.price !== undefined || data.pricing?.salePrice !== undefined) {
            const inputPrice = Number(data.price) || Number(data.pricing?.salePrice) || 0;
            data.pricing = buildPricingObject(inputPrice);
        }

        delete data.price;
        if (data.pricing) delete data.pricing.purchasePrice;
        
        data.isDefault = data.isDefault === true || data.isDefault === 'true';

        const updated = await Product.updateOne({ _id: req.params.id }, data);
        
        if (data.isDefault && data.type) {
            const products = await Product.find({ type: data.type });
            for (const p of products) {
                if (String(p._id) !== String(req.params.id) && p.isDefault) {
                    await Product.updateOne({ _id: p._id }, { isDefault: false });
                }
            }
        }
        
        res.json(updated);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/', async (_req, res) => {
    res.json(await Product.find());
});

router.get('/:id', async (req, res) => {
    res.json(await Product.findOne({ _id: req.params.id }));
});

router.delete('/:id', async (req, res) => {
    await Product.deleteOne({ _id: req.params.id });
    res.json({ message: 'تم الحذف' });
});

router.get('/:id/linked-inventory', async (req, res) => {
    try {
        const product = await Product.findOne({ _id: req.params.id });
        if (!product) {
            return res.status(404).json({ message: 'المنتج غير موجود' });
        }

        const linkedItems = await Product.getLinkedInventoryItems(req.params.id);
        res.json({
            product,
            linkedInventoryCodes: product.linkedInventoryCodes || [],
            linkedItems
        });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.put('/:id/linked-inventory', async (req, res) => {
    try {
        const { inventoryCodes } = req.body || {};
        const updated = await Product.updateLinkedInventoryCodes(req.params.id, inventoryCodes || []);
        res.json({ success: true, updated });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.patch('/:id/price', async (req, res) => {
    try {
        const { price } = req.body || {};
        const newPricing = buildPricingObject(Number(price) || 0);

        await Product.updateOne(
            { _id: req.params.id },
            { pricing: newPricing }
        );

        res.json({ success: true, pricing: newPricing });
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
