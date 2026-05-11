const FileDatabaseManager = require('../file_db_manager');

class Employee {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new employee
    async create(data) {
        return await this.db.create('employees', data);
    }

    // Find all employees
    async find(query = {}) {
        return await this.db.find('employees', query);
    }

    // Find one employee
    async findOne(query) {
        return await this.db.findOne('employees', query);
    }

    // Find by ID
    async findById(id) {
        return await this.db.findById('employees', id);
    }

    // Find and Update by ID
    async findByIdAndUpdate(id, updateData) {
        return await this.db.updateOne('employees', { _id: id }, updateData);
    }

    // Find and Delete by ID
    async findByIdAndDelete(id) {
        return await this.db.deleteOne('employees', { _id: id });
    }

    // Update employee
    async updateOne(query, updateData) {
        return await this.db.updateOne('employees', query, updateData);
    }

    // Update many employees
    async updateMany(query, updateData) {
        return await this.db.updateMany('employees', query, updateData);
    }

    // Delete employee
    async deleteOne(query) {
        return await this.db.deleteOne('employees', query);
    }

    // Delete many
    async deleteMany(query) {
        return await this.db.deleteMany('employees', query);
    }

    // Count employees
    async countDocuments(query = {}) {
        return await this.db.countDocuments('employees', query);
    }
}

module.exports = new Employee();