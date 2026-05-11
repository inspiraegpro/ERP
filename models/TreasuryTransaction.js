const FileDatabaseManager = require('../file_db_manager');

class TreasuryTransaction {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new treasurytransaction
    async create(data) {
        return await this.db.create('treasurytransactions', data);
    }

    // Find all treasurytransactions
    async find(query = {}) {
        return await this.db.find('treasurytransactions', query);
    }

    // Find one treasurytransaction
    async findOne(query) {
        return await this.db.findOne('treasurytransactions', query);
    }

    // Update treasurytransaction
    async updateOne(query, updateData) {
        return await this.db.updateOne('treasurytransactions', query, updateData);
    }

    // Delete treasurytransaction
    async deleteOne(query) {
        return await this.db.deleteOne('treasurytransactions', query);
    }

    // Count treasurytransactions
    async countDocuments(query = {}) {
        return await this.db.countDocuments('treasurytransactions', query);
    }
}

module.exports = new TreasuryTransaction();