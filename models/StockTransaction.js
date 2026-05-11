const FileDatabaseManager = require('../file_db_manager');

class StockTransaction {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new stocktransaction
    async create(data) {
        return await this.db.create('stocktransactions', data);
    }

    // Find all stocktransactions
    async find(query = {}) {
        return await this.db.find('stocktransactions', query);
    }

    // Find one stocktransaction
    async findOne(query) {
        return await this.db.findOne('stocktransactions', query);
    }

    // Find by id
    async findById(id) {
        return await this.db.findById('stocktransactions', id);
    }

    // Update stocktransaction
    async updateOne(query, updateData) {
        return await this.db.updateOne('stocktransactions', query, updateData);
    }

    // Delete stocktransaction
    async deleteOne(query) {
        return await this.db.deleteOne('stocktransactions', query);
    }

    // Count stocktransactions
    async countDocuments(query = {}) {
        return await this.db.countDocuments('stocktransactions', query);
    }

    // Select specific code for an item (Warehouse level)
    async selectCode(transactionId, productId, codeData) {
        const transaction = await this.findById(transactionId);
        if (!transaction) return null;
        
        const updatedItems = transaction.items.map(item => {
            if (item.product === productId) {
                return {
                    ...item,
                    selectedCode: codeData.code,
                    selectedCodeType: codeData.type,
                    selectedCodeSource: codeData.source,
                    codeSelectionDate: new Date().toISOString()
                };
            }
            return item;
        });
        
        return await this.updateOne({ _id: transactionId }, { items: updatedItems });
    }

    // Validate code selection matches material selected by Operations Manager
    async validateCodeSelection(transactionId) {
        const transaction = await this.findById(transactionId);
        if (!transaction) return { valid: false, error: 'Transaction not found' };
        
        // Get Service Job
        const ServiceJob = require('./ServiceJob');
        const job = await ServiceJob.findById(transaction.jobOrderId);
        if (!job) return { valid: false, error: 'Job not found' };
        
        const errors = [];
        
        transaction.items.forEach((item, index) => {
            if (!item.selectedCode) {
                errors.push(`Item ${index + 1}: Code not selected`);
                return;
            }
            
            const jobItem = job.items.find(i => i.product === item.product);
            if (!jobItem) return;
            
            // Validate code matches selected material
            if (jobItem.selectedMaterial && item.selectedCode !== jobItem.selectedMaterial) {
                errors.push(`Item ${index + 1}: Code mismatch. Job selected material ${jobItem.selectedMaterial}, warehouse selected ${item.selectedCode}`);
            }
            
            // Validate code type matches
            if (jobItem.selectedMaterialType && item.selectedCodeType !== jobItem.selectedMaterialType) {
                errors.push(`Item ${index + 1}: Code type mismatch. Job selected ${jobItem.selectedMaterialType}, warehouse selected ${item.selectedCodeType}`);
            }
        });
        
        return {
            valid: errors.length === 0,
            errors
        };
    }
}

module.exports = new StockTransaction();