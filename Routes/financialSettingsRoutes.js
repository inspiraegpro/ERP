const express = require('express');
const router = express.Router();
const financialSettingsService = require('../services/financialSettingsService');

/**
 * @route   GET /api/financial-settings
 * @desc    Fetch financial settings
 */
router.get('/', async (req, res) => {
    try {
        const settings = await financialSettingsService.getSettings();
        res.json(settings || {});
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

/**
 * @route   PUT /api/financial-settings
 * @desc    Update financial settings
 */
router.put('/', async (req, res) => {
    try {
        const settings = await financialSettingsService.updateSettings(req.body);
        res.json({ success: true, data: settings });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
