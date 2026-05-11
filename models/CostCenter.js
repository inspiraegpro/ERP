const FileDatabaseManager = require('../file_db_manager');

class CostCenter {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new costcenter
    async create(data) {
        return await this.db.create('costcenters', data);
    }

    // Find all costcenters
    async find(query = {}) {
        return await this.db.find('costcenters', query);
    }

    // Find one costcenter
    async findOne(query) {
        return await this.db.findOne('costcenters', query);
    }

    // Update costcenter
    async updateOne(query, updateData) {
        return await this.db.updateOne('costcenters', query, updateData);
    }

    // Delete costcenter
    async deleteOne(query) {
        return await this.db.deleteOne('costcenters', query);
    }

    // Count costcenters
    async countDocuments(query = {}) {
        return await this.db.countDocuments('costcenters', query);
    }
}

module.exports = new CostCenter();