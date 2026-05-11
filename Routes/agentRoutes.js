const express = require('express');
const router = express.Router();
const SalesAgent = require('../models/SalesAgent');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// Get all agents
router.get('/', async (req, res) => {
    try {
        const agents = await SalesAgent.find({});
        res.json(agents);
    } catch (error) {
        console.error('Error fetching agents:', error);
        res.status(500).json({ error: 'فشل جلب الوكلاء' });
    }
});

// Get agent by ID
router.get('/:id', async (req, res) => {
    try {
        const agent = await SalesAgent.findById(req.params.id);
        if (!agent) {
            return res.status(404).json({ error: 'الوكيل غير موجود' });
        }
        res.json(agent);
    } catch (error) {
        console.error('Error fetching agent:', error);
        res.status(500).json({ error: 'فشل جلب الوكيل' });
    }
});

// Create agent
router.post('/', authenticateToken, async (req, res) => {
    try {
        const { name, type, phone, email, commissionType, commissionValue, notes } = req.body;

        if (!name || !type) {
            return res.status(400).json({ error: 'الاسم والنوع مطلوبان' });
        }

        const agent = await SalesAgent.create({
            _id: `agent_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            name,
            type, // 'internal' (موظف) أو 'external' (خارجي)
            phone: phone || '',
            email: email || '',
            commissionType: commissionType || 'percentage', // 'percentage', 'fixed', 'variable'
            commissionValue: parseFloat(commissionValue) || 0,
            notes: notes || '',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        res.status(201).json(agent);
    } catch (error) {
        console.error('Error creating agent:', error);
        res.status(500).json({ error: 'فشل إنشاء الوكيل: ' + error.message });
    }
});

// Update agent
router.put('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const updateData = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        const agent = await SalesAgent.updateOne({ _id: req.params.id }, updateData);
        if (!agent) {
            return res.status(404).json({ error: 'الوكيل غير موجود' });
        }
        res.json(agent);
    } catch (error) {
        console.error('Error updating agent:', error);
        res.status(500).json({ error: 'فشل تحديث الوكيل' });
    }
});

// Delete agent
router.delete('/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await SalesAgent.deleteOne({ _id: req.params.id });
        if (!result) {
            return res.status(404).json({ error: 'الوكيل غير موجود' });
        }
        res.json({ message: 'تم حذف الوكيل بنجاح' });
    } catch (error) {
        console.error('Error deleting agent:', error);
        res.status(500).json({ error: 'فشل حذف الوكيل' });
    }
});

module.exports = router;
