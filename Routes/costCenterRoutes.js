const express = require('express');
const router = express.Router();
const CostCenter = require('../models/CostCenter');

router.post('/', async (req, res) => {
    try {
        const newCC = await CostCenter.create(req.body);
        res.status(201).json(newCC);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.get('/', async (req, res) => {
    try {
        const centers = await CostCenter.find();
        res.json(centers);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.put('/:id', async (req, res) => {
    try {
        await CostCenter.updateOne({ _id: req.params.id }, req.body);
        res.json({ message: 'تم التحديث' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/:id', async (req, res) => {
    try {
        await CostCenter.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم الحذف' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
