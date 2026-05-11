const FileDatabaseManager = require('../file_db_manager');

class ImportShipment {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new importshipment
    async create(data) {
        return await this.db.create('importshipments', data);
    }

    // Find all importshipments
    async find(query = {}) {
        return await this.db.find('importshipments', query);
    }

    // Find one importshipment
    async findOne(query) {
        return await this.db.findOne('importshipments', query);
    }

    // Update importshipment
    async updateOne(query, updateData) {
        return await this.db.updateOne('importshipments', query, updateData);
    }

    // Delete importshipment
    async deleteOne(query) {
        return await this.db.deleteOne('importshipments', query);
    }

    // Count importshipments
    async countDocuments(query = {}) {
        return await this.db.countDocuments('importshipments', query);
    }
}

module.exports = new ImportShipment();