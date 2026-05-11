const FileDatabaseManager = require('../file_db_manager');

class SalesInvoice {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    // Create new salesinvoice
    async create(data) {
        return await this.db.create('salesinvoices', data);
    }

    // Find all salesinvoices
    async find(query = {}) {
        return await this.db.find('salesinvoices', query);
    }

    // Find one salesinvoice
    async findOne(query) {
        return await this.db.findOne('salesinvoices', query);
    }

    // Find by ID
    async findById(id) {
        return await this.db.findById('salesinvoices', id);
    }

    // Delete many
    async deleteMany(query) {
        return await this.db.deleteMany('salesinvoices', query);
    }

    // Update salesinvoice
    async updateOne(query, updateData) {
        return await this.db.updateOne('salesinvoices', query, updateData);
    }

    // Delete salesinvoice
    async deleteOne(query) {
        return await this.db.deleteOne('salesinvoices', query);
    }

    // Count salesinvoices
    async countDocuments(query = {}) {
        return await this.db.countDocuments('salesinvoices', query);
    }

    // ===== STREAMING METHODS =====

    // Stream process invoices (memory-efficient for large datasets)
    async streamProcess(processor, query = {}) {
        return await this.db.streamProcess('salesinvoices', processor, query);
    }

    // Stream aggregate (memory-efficient aggregation)
    async streamAggregate(aggregators, query = {}) {
        return await this.db.streamAggregate('salesinvoices', aggregators, query);
    }

    // Update daily summary for fast dashboard loading
    async updateDailySummary(date, data) {
        return await this.db.updateDailySummary(date, data);
    }

    // Get daily summary (instant - no full scan)
    async getDailySummary(date) {
        return await this.db.getDailySummary(date);
    }

    // Get date range summary using streaming
    async getDateRangeSummary(fromDate, toDate) {
        return await this.db.getDateRangeSummary(fromDate, toDate);
    }

    // Add material category to invoice items
    async addMaterialCategories(invoiceId, itemsWithCategories) {
        const invoice = await this.findById(invoiceId);
        if (!invoice) return null;
        
        const updatedItems = invoice.items.map(item => {
            const categoryData = itemsWithCategories.find(c => c.product === item.product);
            return {
                ...item,
                materialCategory: categoryData?.materialCategory || 'general',
                materialType: categoryData?.materialType || ''
            };
        });
        
        return await this.updateOne({ _id: invoiceId }, { items: updatedItems });
    }
}

module.exports = new SalesInvoice();