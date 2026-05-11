const FileDatabaseManager = require('../file_db_manager');

class SalaryHistory {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new salaryhistory
    async create(data) {
        return await this.db.create('salaryhistorys', data);
    }

    // Find all salaryhistorys
    async find(query = {}) {
        return await this.db.find('salaryhistorys', query);
    }

    // Find one salaryhistory
    async findOne(query) {
        return await this.db.findOne('salaryhistorys', query);
    }

    // Update salaryhistory
    async updateOne(query, updateData) {
        return await this.db.updateOne('salaryhistorys', query, updateData);
    }

    // Delete salaryhistory
    async deleteOne(query) {
        return await this.db.deleteOne('salaryhistorys', query);
    }

    // Count salaryhistorys
    async countDocuments(query = {}) {
        return await this.db.countDocuments('salaryhistorys', query);
    }
}

module.exports = new SalaryHistory();