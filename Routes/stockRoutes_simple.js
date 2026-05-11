const express = require('express');
const router = express.Router();
const FileDbManager = require('../file_db_manager');

const db = new FileDbManager();

// GET: Available Rolls
router.get('/available-rolls', async (req, res) => {
    try {
        const { productId, warehouse } = req.query;
        if(!productId) return res.json([]);
        
        const rolls = await db.find('rollbalances');
        const filtered = rolls.filter(r => 
            (r.product === productId || r.productCode === productId) &&
            (r.status === 'Available' || r.status === 'PartiallyUsed') &&
            (!warehouse || r.warehouse === warehouse)
        );
        
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

// GET: All Transactions
router.get('/', async (req, res) => { 
    try {
        const transactions = await db.find('stocktransactions');
        res.json(transactions);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
