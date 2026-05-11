const express = require('express');
const router = express.Router();

const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const SalesInvoice = require('../models/SalesInvoice');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const StockTransaction = require('../models/StockTransaction');
const TreasuryTransaction = require('../models/TreasuryTransaction');
const glService = require('../services/glService');

// =================================================================
// 0. فحص سلامة القيود (Integrity Check)
// =================================================================
router.get('/integrity/check', async (req, res) => {
    try {
        const entries = await JournalEntry.find();
        const orphans = [];
        const stats = { total: entries.length, orphans: 0, checked: 0 };

        const salesRefs = new Set((await SalesInvoice.find() || []).map(i => String(i.invoiceNumber)));
        const purchRefs = new Set((await PurchaseInvoice.find() || []).map(i => 'PUR-' + i.invoiceNumber));
        const stockRefs = new Set((await StockTransaction.find() || []).map(t => t.serialNumber));
        const treasRefs = new Set((await TreasuryTransaction.find() || []).map(t => t.serialNumber));

        for (const entry of entries) {
            const ref = entry.referenceNumber || entry.reference;
            if (!ref) continue;

            let isOrphan = false;
            let type = 'Unknown';

            if (ref.startsWith('PUR-')) {
                type = 'Purchase';
                if (!purchRefs.has(ref)) isOrphan = true;
            } else if (ref.startsWith('TRX-')) {
                type = 'Stock';
                if (!stockRefs.has(ref)) isOrphan = true;
            } else if (ref.includes('-IN-') || ref.includes('-OUT-')) {
                type = 'Treasury';
                if (!treasRefs.has(ref)) isOrphan = true;
            } else if (ref.startsWith('MAN-')) {
                type = 'Manual';
            } else if (ref.startsWith('PAY-')) {
                type = 'Payroll';
            } else if (!isNaN(ref)) {
                type = 'Sales';
                if (!salesRefs.has(ref)) isOrphan = true;
            }

            if (isOrphan) {
                orphans.push({
                    _id: entry._id,
                    referenceNumber: ref,
                    date: entry.date,
                    description: entry.description,
                    amount: entry.totalDebit,
                    likelyType: type
                });
                stats.orphans++;
            }
            stats.checked++;
        }

        res.json({ stats, orphans });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/integrity/cleanup', async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids)) return res.status(400).json({ message: "Provide list of IDs" });

        const result = await JournalEntry.deleteMany({ _id: { $in: ids } });
        res.json({ message: `Deleted ${result.deletedCount} orphaned entries successfully.` });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// =================================================================
// 1. عرض كل القيود
// =================================================================
router.get('/', async (req, res) => {
    try {
        const entries = await JournalEntry.find();
        res.json(entries);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// =================================================================
// 2. جلب قيد واحد بالتفصيل
// =================================================================
router.get('/:id', async (req, res) => {
    try {
        const entry = await JournalEntry.findById(req.params.id);
        if (!entry) return res.status(404).json({ message: "القيد غير موجود" });

        const allAccounts = await Account.find();
        const accountsMap = {};
        allAccounts.forEach(a => accountsMap[String(a._id)] = a);

        const details = entry.details || entry.lines || [];
        const enhancedDetails = details.map(line => {
            const accId = line.accountId ? String(line.accountId) : null;
            const account = accountsMap[accId] || {};

            let mainAccountName = '-';
            let subAccountName = line.accountName || account.name || 'غير معروف';
            let accountCode = account.code || '-';

            let parentCode = account.parentId;
            if (!parentCode && account.code) {
                const sCode = String(account.code);
                if (sCode.includes('-')) parentCode = sCode.split('-')[0];
                else if (sCode.length >= 4) parentCode = sCode.substring(0, 2);
            }

            if (parentCode) {
                const parent = allAccounts.find(a => String(a.code) === String(parentCode));
                if (parent) mainAccountName = parent.name;
            }

            return {
                ...line,
                accountCode,
                mainAccountName,
                subAccountName,
                description: line.description || '-'
            };
        });

        res.json({ ...entry, details: enhancedDetails });

    } catch (err) {
        console.error('Error in journal/:id:', err);
        res.status(500).json({ message: err.message });
    }
});

// =================================================================
// 3. إضافة قيد يدوي
// =================================================================
router.post('/', async (req, res) => {
    try {
        const { description, details, date, referenceNumber } = req.body;

        const newEntry = await glService.createGlEntry({
            description,
            details: details || [],
            date: date || new Date().toISOString(),
            referenceNumber: referenceNumber || ('MAN-' + Math.floor(Date.now() / 1000))
        });

        res.status(201).json(newEntry);

    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

module.exports = router;
