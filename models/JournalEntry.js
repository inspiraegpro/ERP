const FileDatabaseManager = require('../file_db_manager');

class JournalEntry {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new journal entry
    async create(entryData) {
        return await this.db.create('journal', entryData);
    }

    // Find all journal entries
    async find(query = {}) {
        return await this.db.find('journal', query);
    }

    // Find one journal entry
    async findOne(query) {
        return await this.db.findOne('journal', query);
    }
    // Find by ID
    async findById(id) {
        return await this.db.findById('journal', id);
    }

    // Delete many
    async deleteMany(query) {
        return await this.db.deleteMany('journal', query);
    }
    // Find by entry number
    async findByEntryNumber(entryNumber) {
        return await this.db.findOne('journal', { entryNumber });
    }

    // Update journal entry
    async updateOne(query, updateData) {
        return await this.db.updateOne('journal', query, updateData);
    }

    // Delete journal entry
    async deleteOne(query) {
        return await this.db.deleteOne('journal', query);
    }

    // Count journal entries
    async countDocuments(query = {}) {
        return await this.db.countDocuments('journal', query);
    }

    // Get entries by date range
    async getByDateRange(fromDate, toDate) {
        const entries = await this.db.find('journal', {});
        return entries.filter(entry => {
            const entryDate = new Date(entry.date);
            return entryDate >= new Date(fromDate) && entryDate <= new Date(toDate);
        });
    }

    // Get entries by account
    async getByAccount(accountCode) {
        const entries = await this.db.find('journal', {});
        return entries.filter(entry =>
            (entry.details || entry.lines || []).some(line => line.accountCode === accountCode || line.accountId === accountCode)
        );
    }

    // Create balanced journal entry (with debit and credit)
    async createBalancedEntry(entryData) {
        // Validate that total debit equals total credit
        const lines = entryData.details || entryData.lines || [];
        const totalDebit = lines.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
        const totalCredit = lines.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);

        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            throw new Error(`القيد غير متوازن: مدين=${totalDebit}, دائن=${totalCredit}`);
        }

        // Create main entry
        const mainEntry = {
            referenceNumber: entryData.referenceNumber || entryData.entryNumber,
            date: entryData.date || new Date().toISOString(),
            description: entryData.description,
            source: entryData.source || 'Manual',
            status: 'Posted',
            totalDebit: totalDebit,
            totalCredit: totalCredit,
            details: lines
        };

        return await this.create(mainEntry);
    }

    // Get trial balance (Manual Aggregation)
    async getTrialBalance(asOfDate) {
        const entries = await this.db.find('journal', {
            status: 'Posted'
        });

        const filterDate = asOfDate ? new Date(asOfDate) : new Date();
        const accountBalances = {};

        entries.forEach(entry => {
            if (new Date(entry.date) > filterDate) return;

            const lines = entry.details || entry.lines || [];
            lines.forEach(line => {
                const accId = line.accountId;
                if (!accountBalances[accId]) {
                    accountBalances[accId] = {
                        accountId: accId,
                        accountCode: line.accountCode,
                        accountName: line.accountName,
                        debit: 0,
                        credit: 0
                    };
                }

                accountBalances[accId].debit += parseFloat(line.debit) || 0;
                accountBalances[accId].credit += parseFloat(line.credit) || 0;
            });
        });

        // Calculate final balances
        Object.keys(accountBalances).forEach(accId => {
            const b = accountBalances[accId];
            b.finalBalance = b.debit - b.credit;
        });

        return Object.values(accountBalances);
    }

    // Generate entry number
    async generateEntryNumber() {
        const entries = await this.db.find('journal');
        const maxEntry = (entries || []).reduce((max, entry) => {
            const num = parseInt(entry.entryNumber?.replace('JE', '') || 0);
            return num > max ? num : max;
        }, 0);

        return `JE${String(maxEntry + 1).padStart(6, '0')}`;
    }

    // ===== STREAMING METHODS FOR LARGE DATASETS =====

    // Stream process journal entries (memory-efficient)
    async streamProcess(processor, query = {}) {
        return await this.db.streamProcess('journal', processor, query);
    }

    // Stream aggregate (memory-efficient)
    async streamAggregate(aggregators, query = {}) {
        return await this.db.streamAggregate('journal', aggregators, query);
    }

    // Get trial balance using streaming (memory-efficient for large datasets)
    async getTrialBalanceStream(asOfDate) {
        const accountBalances = {};
        const filterDate = asOfDate ? new Date(asOfDate) : new Date();

        await this.streamProcess(async (entry) => {
            if (entry.status !== 'Posted') return;
            if (new Date(entry.date) > filterDate) return;

            const lines = entry.details || entry.lines || [];
            lines.forEach(line => {
                const accId = line.accountId || line.accountCode;
                if (!accId) return;

                if (!accountBalances[accId]) {
                    accountBalances[accId] = {
                        accountId: accId,
                        accountCode: line.accountCode,
                        accountName: line.accountName,
                        debit: 0,
                        credit: 0
                    };
                }
                accountBalances[accId].debit += parseFloat(line.debit) || 0;
                accountBalances[accId].credit += parseFloat(line.credit) || 0;
            });
        });

        Object.keys(accountBalances).forEach(accId => {
            const b = accountBalances[accId];
            b.finalBalance = b.debit - b.credit;
        });

        return Object.values(accountBalances);
    }
}

module.exports = new JournalEntry();