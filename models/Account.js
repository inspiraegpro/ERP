const FileDatabaseManager = require('../file_db_manager');

class Account {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new account
    async create(accountData) {
        return await this.db.create('accounts', accountData);
    }

    // Find all accounts
    async find(query = {}) {
        return await this.db.find('accounts', query);
    }

    // Find one account
    async findOne(query) {
        return await this.db.findOne('accounts', query);
    }

    // Find by ID
    async findById(id) {
        return await this.db.findById('accounts', id);
    }

    // Delete many
    async deleteMany(query) {
        return await this.db.deleteMany('accounts', query);
    }

    // Find account by code
    async findByCode(code) {
        return await this.db.findOne('accounts', { code });
    }

    // Update account
    async updateOne(query, updateData) {
        return await this.db.updateOne('accounts', query, updateData);
    }

    // Update account by code
    async updateByCode(code, updateData) {
        return await this.db.updateOne('accounts', { code }, updateData);
    }

    // Delete account
    async deleteOne(query) {
        return await this.db.deleteOne('accounts', query);
    }

    // Delete account by code
    async deleteByCode(code) {
        return await this.db.deleteOne('accounts', { code });
    }

    // Count accounts
    async countDocuments(query = {}) {
        return await this.db.countDocuments('accounts', query);
    }

    // Validate account code format
    validateCode(code) {
        return typeof code === 'string' && code.length > 0;
    }

    // Get account hierarchy (parent and children)
    async getHierarchy(code) {
        const account = await this.findByCode(code);
        if (!account) return null;

        const children = await this.find({ parentId: code });
        const parent = account.parentId ? await this.findByCode(account.parentId) : null;

        return {
            account,
            parent,
            children
        };
    }
}

module.exports = new Account();
