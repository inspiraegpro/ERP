const express = require('express');
const router = express.Router();
const Warehouse = require('../models/Warehouse');

const getFallbackWarehouse = () => ([{
    _id: 'default-warehouse',
    code: 'MAIN',
    name: 'Main Warehouse',
    path: 'Main Warehouse',
    isActive: true,
    isTransactional: true
}]);

// GET: All warehouses
router.get('/', async (req, res) => {
    try {
        const warehouses = await Warehouse.find();
        res.json(warehouses.length > 0 ? warehouses : getFallbackWarehouse());
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// GET: Transactional warehouses
router.get('/transactional', async (req, res) => {
    try {
        const warehouses = await Warehouse.find({ isTransactional: true });
        res.json(warehouses.length > 0 ? warehouses : getFallbackWarehouse());
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// GET: Single warehouse
router.get('/:id', async (req, res) => {
    try {
        const warehouse = await Warehouse.findOne({ _id: req.params.id });
        if (!warehouse) {
            return res.status(404).json({ message: "Warehouse not found" });
        }
        res.json(warehouse);
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// POST: Create warehouse
router.post('/', async (req, res) => {
    try {
        const warehouse = await Warehouse.create(req.body);
        res.status(201).json(warehouse);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// PUT: Update warehouse
router.put('/:id', async (req, res) => {
    try {
        const updated = await Warehouse.updateOne({ _id: req.params.id }, req.body);
        if (!updated) {
            return res.status(404).json({ message: "Warehouse not found" });
        }
        res.json(updated);
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

// DELETE: Delete warehouse
router.delete('/:id', async (req, res) => {
    try {
        const deleted = await Warehouse.deleteOne({ _id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ message: "Warehouse not found" });
        }
        res.json({ message: "Warehouse deleted successfully" });
    } catch (e) {
        res.status(400).json({ message: e.message });
    }
});

module.exports = router;
