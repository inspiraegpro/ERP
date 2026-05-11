const FileDatabaseManager = require('../file_db_manager');

class Warehouse {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new warehouse
    async create(warehouseData) {
        return await this.db.create('warehouses', warehouseData);
    }

    // Find all warehouses
    async find(query = {}) {
        return await this.db.find('warehouses', query);
    }

    // Find one warehouse
    async findOne(query) {
        return await this.db.findOne('warehouses', query);
    }

    // Find by code
    async findByCode(code) {
        return await this.db.findOne('warehouses', { code });
    }

    // Update warehouse
    async updateOne(query, updateData) {
        return await this.db.updateOne('warehouses', query, updateData);
    }

    // Update warehouse by code
    async updateByCode(code, updateData) {
        return await this.db.updateOne('warehouses', { code }, updateData);
    }

    // Delete warehouse
    async deleteOne(query) {
        return await this.db.deleteOne('warehouses', query);
    }

    // Delete warehouse by code
    async deleteByCode(code) {
        return await this.db.deleteOne('warehouses', { code });
    }

    // Count warehouses
    async countDocuments(query = {}) {
        return await this.db.countDocuments('warehouses', query);
    }

    // Get active warehouses
    async getActiveWarehouses() {
        return await this.db.find('warehouses', { isActive: true });
    }

    // Get transactional warehouses (for transfers)
    async getTransactionalWarehouses() {
        return await this.db.find('warehouses', { 
            isActive: true, 
            isTransactional: true 
        });
    }

    // Validate warehouse code
    validateCode(code) {
        return typeof code === 'string' && code.length > 0;
    }

    // Check if warehouse exists
    async exists(code) {
        const warehouse = await this.findByCode(code);
        return warehouse !== null;
    }

    // Get warehouse balance
    async getWarehouseBalance(warehouseCode) {
        const StockTransaction = require('./StockTransaction');
        const transactions = await StockTransaction.find({ 
            warehouse: warehouseCode 
        });

        let balance = 0;
        transactions.forEach(transaction => {
            switch (transaction.type) {
                case 'Opening':
                case 'Purchase':
                case 'Transfer In':
                    balance += transaction.quantity;
                    break;
                case 'Sales':
                case 'Transfer Out':
                case 'Adjustment Out':
                    balance -= transaction.quantity;
                    break;
            }
        });

        return balance;
    }

    // Get warehouse products
    async getWarehouseProducts(warehouseCode) {
        const StockTransaction = require('./StockTransaction');
        const transactions = await StockTransaction.find({ 
            warehouse: warehouseCode 
        });

        const products = {};
        transactions.forEach(transaction => {
            if (!products[transaction.productCode]) {
                products[transaction.productCode] = {
                    productCode: transaction.productCode,
                    productName: transaction.productName,
                    quantity: 0,
                    unit: transaction.unit
                };
            }

            switch (transaction.type) {
                case 'Opening':
                case 'Purchase':
                case 'Transfer In':
                    products[transaction.productCode].quantity += transaction.quantity;
                    break;
                case 'Sales':
                case 'Transfer Out':
                case 'Adjustment Out':
                    products[transaction.productCode].quantity -= transaction.quantity;
                    break;
            }
        });

        return Object.values(products).filter(p => p.quantity > 0);
    }
}

module.exports = new Warehouse();