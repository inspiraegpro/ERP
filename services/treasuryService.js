const FileDatabaseManager = require('../file_db_manager');
const Customer = require('../models/Customer');
const Supplier = require('../models/Supplier');
const { createGlEntry } = require('./glService');
const glLogic = require('./glLogic');

const db = new FileDatabaseManager();

const normalizeTreasuryType = (type) => {
    const value = String(type || '').toLowerCase();
    if (value === 'income' || value === 'receipt' || value === 'inbound') return 'income';
    if (value === 'expense' || value === 'payment' || value === 'outbound') return 'expense';
    return type || '';
};

const mapUiPayload = (data) => {
    const type = normalizeTreasuryType(data.type);
    return {
        ...data,
        type,
        amount: Number(data.amount ?? 0) || 0,
        accountId: data.accountId || data.treasuryAccount || data.account || '',
        treasuryAccount: data.accountId || data.treasuryAccount || data.account || '',
        targetAccount: data.targetAccount || data.otherAccountId || '',
        reference: data.reference || '',
        description: data.description || '',
        serialNumber: data.serialNumber || `TR-${Date.now()}`,
        date: data.date || new Date().toISOString()
    };
};

const updateRelatedBalances = async (data, reverse = false) => {
    if (!data.targetAccount) return;

    const multiplier = reverse ? -1 : 1;
    const amount = (Number(data.amount) || 0) * multiplier;
    const isIncome = normalizeTreasuryType(data.type) === 'income';

    const customer = await Customer.findOne({ accountId: data.targetAccount });
    if (customer) {
        const change = isIncome ? -amount : amount;
        await Customer.updateOne(
            { _id: customer._id },
            { balance: (Number(customer.balance) || 0) + change }
        );
    }

    const supplier = await Supplier.findOne({ accountId: data.targetAccount });
    if (supplier) {
        const change = isIncome ? amount : -amount;
        await Supplier.updateOne(
            { _id: supplier._id },
            { balance: (Number(supplier.balance) || 0) + change }
        );
    }
};

const buildGlPayload = async (data) => {
    const glType = normalizeTreasuryType(data.type) === 'income' ? 'Receipt' : 'Payment';
    const glDetails = await glLogic.getTreasuryEntryDetails({
        ...data,
        type: glType,
        treasuryAccount: data.accountId,
        targetAccount: data.targetAccount
    });

    return {
        date: data.date,
        referenceNumber: data.serialNumber || `TX-${Date.now()}`,
        description: data.description,
        journalType: 'Treasury',
        details: glDetails
    };
};

const treasuryService = {
    createTreasuryTransaction: async (data) => {
        const payload = mapUiPayload(data);
        if (!payload.accountId) {
            throw new Error('accountId is required');
        }
        if (!payload.amount || payload.amount <= 0) {
            throw new Error('amount must be greater than zero');
        }
        if (!['income', 'expense'].includes(payload.type)) {
            throw new Error('type must be income or expense');
        }

        const tx = await db.create('treasurytransactions', {
            ...payload,
            _id: payload._id || `tx_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });

        // GL and balance updates enabled
        const glPayload = await buildGlPayload(payload);
        await createGlEntry(glPayload);
        await updateRelatedBalances(payload, false);

        return tx;
    },

    create: async (data) => {
        return await treasuryService.createTreasuryTransaction(data);
    },

    createTransaction: async (data) => {
        return await treasuryService.createTreasuryTransaction(data);
    },

    find: async (query = {}) => {
        return await db.find('treasurytransactions', query);
    },

    findOne: async (query) => {
        const results = await db.find('treasurytransactions', query);
        return results.length > 0 ? results[0] : null;
    },

    updateOne: async (id, data) => {
        const existing = await treasuryService.findOne({ _id: id });
        if (!existing) return null;
        
        const updated = await db.updateOne('treasurytransactions', { _id: id }, data);
        return updated;
    },

    deleteOne: async (id) => {
        const existing = await treasuryService.findOne({ _id: id });
        if (!existing) return null;
        
        await db.deleteOne('treasurytransactions', { _id: id });
        return existing;
    }
};

module.exports = treasuryService;
