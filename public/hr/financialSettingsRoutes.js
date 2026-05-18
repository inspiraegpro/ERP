const express = require('express');
const router = express.Router();
const FinancialSetting = require('../models/FinancialSetting');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

// GET financial settings
router.get('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const settings = await FinancialSetting.getSettings();
        res.json(settings);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// PUT (update) financial settings
router.put('/', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const updatedSettings = await FinancialSetting.updateSettings(req.body);
        res.json({ success: true, message: 'تم حفظ الإعدادات بنجاح', settings: updatedSettings });
    } catch (err) {
        res.status(400).json({ success: false, message: err.message });
    }
});

module.exports = router;