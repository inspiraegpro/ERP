const FileDatabaseManager = require('../file_db_manager');

class ReissueRequest {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    async create(data) {
        return await this.db.create('reissuerequests', data);
    }

    async find(query = {}) {
        return await this.db.find('reissuerequests', query);
    }

    async findOne(query) {
        return await this.db.findOne('reissuerequests', query);
    }

    async findById(id) {
        return await this.db.findById('reissuerequests', id);
    }

    async updateOne(query, updateData) {
        return await this.db.updateOne('reissuerequests', query, updateData);
    }
}

module.exports = new ReissueRequest();
