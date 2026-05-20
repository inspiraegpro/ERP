const FileDatabaseManager = require('../file_db_manager');

class WarrantyRequest {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    async create(data) {
        return await this.db.create('warrantyrequests', data);
    }

    async find(query = {}) {
        return await this.db.find('warrantyrequests', query);
    }

    async findOne(query) {
        return await this.db.findOne('warrantyrequests', query);
    }

    async findById(id) {
        return await this.db.findById('warrantyrequests', id);
    }

    async updateOne(query, updateData) {
        return await this.db.updateOne('warrantyrequests', query, updateData);
    }
}

module.exports = new WarrantyRequest();
