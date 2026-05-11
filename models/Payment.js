const FileDatabaseManager = require('../file_db_manager');

class Payment {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new payment
    async create(data) {
        return await this.db.create('payments', data);
    }

    // Find all payments
    async find(query = {}) {
        return await this.db.find('payments', query);
    }

    // Find one payment
    async findOne(query) {
        return await this.db.findOne('payments', query);
    }

    // Update payment
    async updateOne(query, updateData) {
        return await this.db.updateOne('payments', query, updateData);
    }

    // Delete payment
    async deleteOne(query) {
        return await this.db.deleteOne('payments', query);
    }

    // Count payments
    async countDocuments(query = {}) {
        return await this.db.countDocuments('payments', query);
    }
}

module.exports = new Payment();