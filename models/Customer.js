const FileDatabaseManager = require('../file_db_manager');

class Customer {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new customer
    async create(customerData) {
        return await this.db.create('customers', customerData);
    }

    // Find all customers
    async find(query = {}) {
        return await this.db.find('customers', query);
    }

    // Find one customer
    async findOne(query) {
        return await this.db.findOne('customers', query);
    }

    // Find customer by code
    async findByCode(code) {
        return await this.db.findOne('customers', { code });
    }

    // Update customer
    async updateOne(query, updateData) {
        return await this.db.updateOne('customers', query, updateData);
    }

    // Update customer by code
    async updateByCode(code, updateData) {
        return await this.db.updateOne('customers', { code }, updateData);
    }

    // Delete customer
    async deleteOne(query) {
        return await this.db.deleteOne('customers', query);
    }

    // Delete customer by code
    async deleteByCode(code) {
        return await this.db.deleteOne('customers', { code });
    }

    // Count customers
    async countDocuments(query = {}) {
        return await this.db.countDocuments('customers', query);
    }

    // Update customer balance
    async updateBalance(code, amount) {
        return await this.db.updateOne('customers', { code }, { 
            $inc: { currentBalance: amount } 
        });
    }

    // Get customers with outstanding balance
    async getDebtors() {
        const customers = await this.find();
        return customers.filter(c => c.currentBalance < 0);
    }

    // Search customers by name or phone
    async search(searchTerm) {
        const customers = await this.find();
        return customers.filter(c => 
            c.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
            c.phone.includes(searchTerm) ||
            (c.code && c.code.toLowerCase().includes(searchTerm.toLowerCase()))
        );
    }
}

module.exports = new Customer();
