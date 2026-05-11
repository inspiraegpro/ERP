const express = require('express');
const router = express.Router();
const AccountingMapping = require('../models/AccountingMapping');
const JournalEntry = require('../models/JournalEntry');

// Get all mappings
router.get('/', async (req, res) => {
    try {
        const type = req.query.mappingType; // e.g., 'CATEGORY', 'TREASURY', 'CUSTOMER_TYPE'
        const query = type ? { mappingType: type } : {};
        const mappings = await AccountingMapping.find(query);
        res.json(mappings);
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Check if mapping is used in GL
const isMappingUsedInGL = async (mapping) => {
    const entries = await JournalEntry.find();
    
    // Extract all accounts used in this mapping
    const mappingAccounts = [
        mapping.revenueAccount, 
        mapping.cogsAccount, 
        mapping.inventoryAccount,
        mapping.arAccount,
        mapping.apAccount,
        mapping.cashAccount
    ].filter(Boolean);

    if (mappingAccounts.length === 0) return false;

    // Check if any journal entry detail uses one of these accounts AND the description contains the mapped value
    for (const entry of entries) {
        if (!entry.details) continue;
        const usesAccount = entry.details.some(d => mappingAccounts.includes(d.accountId));
        
        // A simple heuristic: if it uses the account, it's used. 
        // For more strictness we could check the mappedValue string.
        if (usesAccount) {
            return true;
        }
    }
    return false;
};

// Create a new mapping
router.post('/', async (req, res) => {
    try {
        const mapping = {
            ...req.body,
            _id: `map_${Date.now()}_${Math.random().toString(36).substr(2, 5)}`,
            createdAt: new Date().toISOString()
        };
        await AccountingMapping.create(mapping);
        res.status(201).json({ success: true, mapping });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Update a mapping
router.put('/:id', async (req, res) => {
    try {
        const existing = await AccountingMapping.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Mapping not found' });
        }

        // Check if old mapping is used in GL
        const used = await isMappingUsedInGL(existing);
        if (used) {
            return res.status(400).json({ 
                success: false, 
                message: 'لا يمكن تعديل هذا التوجيه المحاسبي لأنه تم استخدامه بالفعل في قيود يومية مسجلة. يرجى إلغاء القيود أولاً أو إنشاء توجيه جديد.' 
            });
        }

        await AccountingMapping.updateOne({ _id: req.params.id }, { ...req.body, updatedAt: new Date().toISOString() });
        res.json({ success: true, message: 'Updated successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

// Delete a mapping
router.delete('/:id', async (req, res) => {
    try {
        const existing = await AccountingMapping.findById(req.params.id);
        if (!existing) {
            return res.status(404).json({ success: false, message: 'Mapping not found' });
        }

        // Check if old mapping is used in GL
        const used = await isMappingUsedInGL(existing);
        if (used) {
            return res.status(400).json({ 
                success: false, 
                message: 'لا يمكن حذف هذا التوجيه المحاسبي لأنه تم استخدامه بالفعل في قيود يومية مسجلة.' 
            });
        }

        await AccountingMapping.deleteOne({ _id: req.params.id });
        res.json({ success: true, message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ success: false, message: err.message });
    }
});

module.exports = router;
