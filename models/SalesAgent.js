const FileDatabaseManager = require('../file_db_manager');

class SalesAgent {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    async create(data) {
        return await this.db.create('agents', data);
    }

    async find(query = {}) {
        return await this.db.find('agents', query);
    }

    async findOne(query) {
        return await this.db.findOne('agents', query);
    }

    async findById(id) {
        return await this.db.findById('agents', id);
    }

    async updateOne(query, updateData) {
        return await this.db.updateOne('agents', query, updateData);
    }

    async deleteOne(query) {
        return await this.db.deleteOne('agents', query);
    }

    async countDocuments(query = {}) {
        return await this.db.countDocuments('agents', query);
    }
}

module.exports = new SalesAgent();
