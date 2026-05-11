const express = require('express');
const router = express.Router();
const FileDbManager = require('../file_db_manager');

const db = new FileDbManager();

// GET: All Purchase Invoices
router.get('/', async (req, res) => {
    try {
        const { paymentStatus, supplier } = req.query;
        const invoices = await db.find('purchaseinvoices');
        res.json(invoices);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

// GET: Single Purchase Invoice
router.get('/:id', async (req, res) => {
    try {
        const invoices = await db.find('purchaseinvoices');
        const inv = invoices.find(i => i._id === req.params.id);
        if (!inv) return res.status(404).json({ message: "Not Found" });
        res.json(inv);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
});

module.exports = router;
