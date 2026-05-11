const FileDatabaseManager = require('../file_db_manager');

class Payroll {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new payroll
    async create(data) {
        return await this.db.create('payrolls', data);
    }

    // Find all payrolls
    async find(query = {}) {
        return await this.db.find('payrolls', query);
    }

    // Find one payroll
    async findOne(query) {
        return await this.db.findOne('payrolls', query);
    }

    // Update payroll
    async updateOne(query, updateData) {
        return await this.db.updateOne('payrolls', query, updateData);
    }

    // Delete payroll
    async deleteOne(query) {
        return await this.db.deleteOne('payrolls', query);
    }

    // Count payrolls
    async countDocuments(query = {}) {
        return await this.db.countDocuments('payrolls', query);
    }
}

module.exports = new Payroll();