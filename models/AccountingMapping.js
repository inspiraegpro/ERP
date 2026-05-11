const FileDatabaseManager = require('../file_db_manager');

class AccountingMapping {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    async create(data) {
        return await this.db.create('accounting_mappings', data);
    }

    async find(query = {}) {
        return await this.db.find('accounting_mappings', query);
    }

    async findOne(query) {
        return await this.db.findOne('accounting_mappings', query);
    }

    async findById(id) {
        return await this.db.findById('accounting_mappings', id);
    }

    async updateOne(query, updateData) {
        return await this.db.updateOne('accounting_mappings', query, updateData);
    }

    async deleteOne(query) {
        return await this.db.deleteOne('accounting_mappings', query);
    }
}

module.exports = new AccountingMapping();
