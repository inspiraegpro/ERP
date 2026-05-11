const express = require('express');
const router = express.Router();
const FileDatabaseManager = require('../file_db_manager');
const treasuryService = require('../services/treasuryService');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const db = new FileDatabaseManager();

const normalizeType = (type) => {
    const value = String(type || '').toLowerCase();
    if (value === 'income' || value === 'receipt' || value === 'inbound') return 'income';
    if (value === 'expense' || value === 'payment' || value === 'outbound') return 'expense';
    return type || '';
};

const normalizeTransaction = (transaction) => ({
    ...transaction,
    type: normalizeType(transaction.type),
    amount: Number(transaction.amount ?? 0) || 0,
    accountId: transaction.accountId || transaction.treasuryAccount || transaction.account || '',
    reference: transaction.reference || '',
    description: transaction.description || ''
});

const ensurePayload = (body) => {
    if (!body) throw new Error('Request body is required');
    if (!body.date) throw new Error('date is required');
    if (!body.type) throw new Error('type is required');
    if (!body.amount || Number(body.amount) <= 0) throw new Error('amount must be greater than zero');
    if (!body.accountId) throw new Error('accountId is required');
};

const getTreasuryAccounts = async () => {
    const accounts = await db.find('accounts');
    return accounts.filter(account =>
        (account.code && String(account.code).startsWith('110')) ||
        (account.name && (
            String(account.name).includes('خزنة') ||
            String(account.name).includes('بنك') ||
            String(account.name).includes('Ø®Ø²Ù†Ø©') ||
            String(account.name).includes('Ø¨Ù†Ùƒ')
        ))
    );
};

// 1. Get All Treasury Transactions
router.get('/', async (req, res, next) => {
    try {
        const transactions = await treasuryService.find();
        transactions.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        res.json(transactions.map(normalizeTransaction));
    } catch (error) {
        console.error('Error getting treasury transactions:', error);
        res.status(500).json({ error: 'Failed to get treasury transactions' });
    }
});

// 2. Get Treasury Balances
router.get('/balances', async (req, res, next) => {
    try {
        const accounts = await getTreasuryAccounts();
        const transactions = (await treasuryService.find()).map(normalizeTransaction);

        const balances = accounts.map(account => {
            const accountTransactions = transactions.filter(tx => String(tx.accountId) === String(account._id));
            const balance = accountTransactions.reduce((sum, tx) => {
                return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
            }, 0);

            return {
                accountId: account._id,
                accountCode: account.code,
                accountName: account.name,
                balance
            };
        });

        res.json(balances);
    } catch (error) {
        console.error('Error getting treasury balances:', error);
        res.status(500).json({ error: 'Failed to get treasury balances' });
    }
});

// 3. Get Treasury Balances Summary
router.get('/balances/summary', async (req, res, next) => {
    try {
        const accounts = await getTreasuryAccounts();
        const transactions = (await treasuryService.find()).map(normalizeTransaction);

        const accountSummaries = accounts.map(account => {
            const accountTransactions = transactions.filter(tx => String(tx.accountId) === String(account._id));
            const balance = accountTransactions.reduce((sum, tx) => {
                return sum + (tx.type === 'income' ? tx.amount : -tx.amount);
            }, 0);

            return {
                accountId: account._id,
                accountCode: account.code,
                accountName: account.name,
                balance
            };
        });

        res.json({
            totalAccounts: accountSummaries.length,
            totalBalance: accountSummaries.reduce((sum, account) => sum + account.balance, 0),
            accounts: accountSummaries
        });
    } catch (error) {
        console.error('Error getting treasury balances summary:', error);
        res.status(500).json({ error: 'Failed to get treasury balances summary' });
    }
});

// 4. Get Treasury Transaction by ID
router.get('/:id', async (req, res, next) => {
    try {
        const transaction = await treasuryService.findOne({ _id: req.params.id });
        if (!transaction) {
            return res.status(404).json({ error: 'Treasury transaction not found' });
        }
        res.json(normalizeTransaction(transaction));
    } catch (error) {
        console.error('Error getting treasury transaction:', error);
        res.status(500).json({ error: 'Failed to get treasury transaction' });
    }
});

// 5. Create Treasury Transaction
router.post('/', async (req, res, next) => {
    try {
        ensurePayload(req.body);
        const newTransaction = await treasuryService.createTreasuryTransaction(req.body);
        res.status(201).json(normalizeTransaction(newTransaction));
    } catch (error) {
        console.error('Error creating treasury transaction:', error);
        res.status(500).json({ error: 'Failed to create treasury transaction: ' + error.message });
    }
});

// 6. Update Treasury Transaction
router.put('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        ensurePayload(req.body);
        const updatedTransaction = await treasuryService.updateOne(req.params.id, req.body);
        if (!updatedTransaction) {
            return res.status(404).json({ error: 'Treasury transaction not found' });
        }
        res.json(normalizeTransaction(updatedTransaction));
    } catch (error) {
        console.error('Error updating treasury transaction:', error);
        res.status(500).json({ error: 'Failed to update treasury transaction: ' + error.message });
    }
});

// 7. Delete Treasury Transaction
router.delete('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const deleted = await treasuryService.deleteOne(req.params.id);
        if (!deleted) {
            return res.status(404).json({ error: 'Treasury transaction not found' });
        }
        res.json({ message: 'Treasury transaction deleted successfully' });
    } catch (error) {
        console.error('Error deleting treasury transaction:', error);
        res.status(500).json({ error: 'Failed to delete treasury transaction: ' + error.message });
    }
});

module.exports = router;
