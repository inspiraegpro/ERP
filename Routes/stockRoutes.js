const express = require('express');
const router = express.Router();
const FileDbManager = require('../file_db_manager');
const inventoryService = require('../services/inventoryService');
const { authenticateToken: auth } = require('../middleware/auth');

const db = new FileDbManager();

// GET: All Transactions
router.get('/', auth, async (req, res) => { 
    try {
        const { type, warehouse, supplierDoc } = req.query;
        const filters = {};
        if (type) filters.type = type;
        if (warehouse) filters.warehouse = warehouse;
        if (supplierDoc) filters.supplierDoc = supplierDoc;
        
        const transactions = await db.find('stocktransactions', filters);
        res.json(transactions || []);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// GET: Available Rolls (Helper for Stock-Out or Stock-In validation)
router.get('/available-rolls', auth, async (req, res) => {
    try {
        const { productId, warehouse } = req.query;
        if(!productId) return res.json([]);
        
        const rolls = await db.find('rollbalances');
        const filtered = rolls.filter(r => 
            (String(r.product) === String(productId) || String(r.productCode) === String(productId)) &&
            (r.status === 'Available' || r.status === 'PartiallyUsed' || r.status === 'Available') &&
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

// GET: Smart Suggestions for Stock-Out (Waste-First Consumption)
router.get('/smart-suggestions', auth, async (req, res) => {
    try {
        const { productId, area, lengthCm, widthCm, warehouse } = req.query;
        
        if (!productId) {
            return res.status(400).json({ error: 'productId is required' });
        }

        const suggestions = await inventoryService.getSmartSuggestions(
            productId,
            parseFloat(area) || 0,
            parseFloat(lengthCm) || 0,
            parseFloat(widthCm) || 0,
            warehouse || ''
        );

        res.json(suggestions);
    } catch (error) {
        console.error('Error in smart-suggestions:', error);
        res.status(500).json({ error: error.message });
    }
});

// POST: Create Stock Transaction (Stock In / Stock Out)
router.post('/', auth, async (req, res) => {
    try {
        const txData = req.body;
        
        // 1. Create the transaction record
        const transaction = await db.create('stocktransactions', {
            ...txData,
            createdAt: new Date().toISOString()
        });

        // 2. Process the transaction effect on inventory balance
        if (transaction.type === 'Inbound' || transaction.type === 'Stock In') {
            await inventoryService.processInbound(transaction);
        } else if (transaction.type === 'Outbound' || transaction.type === 'Stock Out') {
            await inventoryService.processOutbound(transaction);
        }

        res.status(201).json(transaction);
    } catch (error) {
        console.error('Error creating stock transaction:', error);
        res.status(500).json({ error: error.message });
    }
});

// GET: Transactions by Purchase Invoice
router.get('/by-purchase/:purchaseId', auth, async (req, res) => {
    try {
        const transactions = await db.find('stocktransactions');
        const filtered = transactions.filter(t => t.purchaseInvoiceId === req.params.purchaseId);
        res.json(filtered);
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

// GET: Stock Transaction by ID
router.get('/:id', auth, async (req, res) => {
    try {
        const transaction = await db.findOne('stocktransactions', { _id: req.params.id });
        if (!transaction) {
            return res.status(404).json({ error: 'الإذن المخزني غير موجود.' });
        }
        res.json(transaction);
    } catch (e) {
        res.status(500).json({ error: e.message });
    }
});

// DELETE: Remove a Stock Transaction by ID
router.delete('/:id', auth, async (req, res) => {
    try {
        const deleted = await db.deleteOne('stocktransactions', { _id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'الإذن المخزني غير موجود.' });
        }
        res.json({ message: 'تم حذف الإذن المخزني.' });
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
