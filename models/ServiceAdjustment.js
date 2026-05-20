const FileDatabaseManager = require('../file_db_manager');

class ServiceAdjustment {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    async create(data) {
        return await this.db.create('serviceadjustments', data);
    }

    async find(query = {}) {
        return await this.db.find('serviceadjustments', query);
    }

    async findOne(query) {
        return await this.db.findOne('serviceadjustments', query);
    }

    async findById(id) {
        return await this.db.findById('serviceadjustments', id);
    }

    async updateOne(query, updateData) {
        return await this.db.updateOne('serviceadjustments', query, updateData);
    }
}

module.exports = new ServiceAdjustment();
