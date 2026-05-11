const FileDatabaseManager = require('../file_db_manager');

class PurchaseInvoice {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new purchaseinvoice
    async create(data) {
        return await this.db.create('purchaseinvoices', data);
    }

    // Find all purchaseinvoices
    async find(query = {}) {
        return await this.db.find('purchaseinvoices', query);
    }

    // Find one purchaseinvoice
    async findOne(query) {
        return await this.db.findOne('purchaseinvoices', query);
    }

    // Update purchaseinvoice
    async updateOne(query, updateData) {
        return await this.db.updateOne('purchaseinvoices', query, updateData);
    }

    // Delete purchaseinvoice
    async deleteOne(query) {
        return await this.db.deleteOne('purchaseinvoices', query);
    }

    // Count purchaseinvoices
    async countDocuments(query = {}) {
        return await this.db.countDocuments('purchaseinvoices', query);
    }
}

module.exports = new PurchaseInvoice();