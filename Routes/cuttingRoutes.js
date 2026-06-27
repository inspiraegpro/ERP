const express = require('express');
const router = express.Router();
const cuttingService = require('../services/cuttingService');
const { authenticateToken: auth } = require('../middleware/auth');

router.post('/optimize', auth, async (req, res) => {
    try {
        const { rolls, pieces, allowRotate } = req.body;
        res.json(cuttingService.optimizeCutting(rolls, pieces, allowRotate !== false));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
