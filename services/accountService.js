const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');

const accountService = {
    createAccount: async (data) => {
        // Unique code check
        if (data.code) {
            const existing = await Account.findOne({ code: data.code });
            if (existing) throw new Error(`Account code ${data.code} already exists.`);
        }

        // Parent validation
        if (data.parentId) {
            const parent = await Account.findOne({ code: data.parentId });
            if (!parent) throw new Error(`Parent account with code ${data.parentId} not found.`);
        }

        return await Account.create(data);
    },

    updateAccount: async (id, data) => {
        // For file-based DB, we use code as identifier
        const account = await Account.findOne({ _id: id });
        if (!account) throw new Error("Account not found");

        // Unique code check if changing code
        if (data.code && data.code !== account.code) {
            const existing = await Account.findOne({ code: data.code });
            if (existing) throw new Error(`Account code ${data.code} is already in use.`);
        }

        return await Account.updateOne({ _id: id }, data);
    },

    deleteAccount: async (id) => {
        const account = await Account.findOne({ _id: id });
        if (!account) throw new Error("Account not found");

        // 1. Check for Sub-accounts (Children)
        const hasChildren = await Account.findOne({ parentId: account.code });
        if (hasChildren) {
            throw new Error("Cannot delete this account because it has sub-accounts. Delete them first.");
        }

        // 2. Check for Transactions (Journal Entries)
        const entries = await JournalEntry.find();
        const hasEntries = entries.some(e =>
            (e.details || e.lines || []).some(l => String(l.accountId) === String(id))
        );
        if (hasEntries) {
            throw new Error("Cannot delete this account because it has associated financial transactions.");
        }

        await Account.deleteOne({ _id: id });
        return { message: "Account deleted successfully" };
    },

    getAccountTree: async () => {
        const accounts = await Account.find();
        return accounts.sort((a, b) => {
            // Convert to string for comparison
            const codeA = String(a.code || '');
            const codeB = String(b.code || '');
            return codeA.localeCompare(codeB);
        });
    }
};

module.exports = accountService;
