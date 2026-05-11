const FileDatabaseManager = require('../file_db_manager');

class Supplier {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new supplier
    async create(supplierData) {
        return await this.db.create('suppliers', supplierData);
    }

    // Find all suppliers
    async find(query = {}) {
        return await this.db.find('suppliers', query);
    }

    // Find one supplier
    async findOne(query) {
        return await this.db.findOne('suppliers', query);
    }

    // Find supplier by code
    async findByCode(code) {
        return await this.db.findOne('suppliers', { code });
    }

    // Update supplier
    async updateOne(query, updateData) {
        return await this.db.updateOne('suppliers', query, updateData);
    }

    // Update supplier by code
    async updateByCode(code, updateData) {
        return await this.db.updateOne('suppliers', { code }, updateData);
    }

    // Delete supplier
    async deleteOne(query) {
        return await this.db.deleteOne('suppliers', query);
    }

    // Delete supplier by code
    async deleteByCode(code) {
        return await this.db.deleteOne('suppliers', { code });
    }

    // Count suppliers
    async countDocuments(query = {}) {
        return await this.db.countDocuments('suppliers', query);
    }

    // Search suppliers by name or phone
    async search(searchTerm) {
        const suppliers = await this.find();
        return suppliers.filter(s => 
            s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            s.phone.includes(searchTerm) ||
            (s.code && s.code.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
}

module.exports = new Supplier();
