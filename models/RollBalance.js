const FileDatabaseManager = require('../file_db_manager');

class RollBalance {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new rollbalance
    async create(data) {
        return await this.db.create('rollbalances', data);
    }

    // Find all rollbalances
    async find(query = {}) {
        return await this.db.find('rollbalances', query);
    }

    // Find one rollbalance
    async findOne(query) {
        return await this.db.findOne('rollbalances', query);
    }

    // Update rollbalance
    async updateOne(query, updateData) {
        return await this.db.updateOne('rollbalances', query, updateData);
    }

    // Delete rollbalance
    async deleteOne(query) {
        return await this.db.deleteOne('rollbalances', query);
    }

    // Count rollbalances
    async countDocuments(query = {}) {
        return await this.db.countDocuments('rollbalances', query);
    }
}

module.exports = new RollBalance();