const FileDatabaseManager = require('../file_db_manager');

class Product {
    constructor(data = {}) {
        this._id = data._id || null;
        this.name = data.name || '';
        this.code = data.code || '';
        this.barcode = data.barcode || '';
        this.type = data.type || 'product';
        this.unit = data.unit || 'piece';
        this.category = data.category || '';
        this.description = data.description || '';
        this.pricing = data.pricing || {};
        this.cost = data.cost || {};
        this.accounts = data.accounts || {};
        this.revenueAccountId = data.revenueAccountId || null;
        this.isActive = data.isActive !== false;
        // ربط الخامة بالأكواد المخزنية (p2, c, توزيع... إلخ)
        this.linkedInventoryCodes = data.linkedInventoryCodes || [];
        this.createdAt = data.createdAt || new Date().toISOString();
        this.updatedAt = data.updatedAt || new Date().toISOString();
    }

    // ========== Static Methods for Routes ==========
    static db = null;
    
    static setDb(database) {
        Product.db = database;
    }

    // Create new product
    static async create(productData) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.create('products', productData);
    }

    // Find all products
    static async find(query = {}) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.find('products', query);
    }

    // Find one product
    static async findOne(query) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.findOne('products', query);
    }

    // Find product by ID
    static async findById(id) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.findOne('products', { _id: id });
    }

    // Find product by code
    static async findByCode(code) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.findOne('products', { code });
    }

    // Update product
    static async updateOne(query, updateData) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.updateOne('products', query, updateData);
    }

    // Update product by code
    static async updateByCode(code, updateData) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.updateOne('products', { code }, updateData);
    }

    // Delete product
    static async deleteOne(query) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.deleteOne('products', query);
    }

    // Get linked inventory items
    static async getLinkedInventoryItems(productId) {
        if (!Product.db) throw new Error('Database not initialized');
        const product = await Product.findOne({ _id: productId });
        if (!product || !product.linkedInventoryCodes || product.linkedInventoryCodes.length === 0) {
            return [];
        }
        const allInventory = await Product.db.find('inventory');
        return allInventory.filter(item => product.linkedInventoryCodes.includes(item.code));
    }

    // Update linked inventory codes
    static async updateLinkedInventoryCodes(productId, inventoryCodes) {
        if (!Product.db) throw new Error('Database not initialized');
        return await Product.db.updateOne('products', { _id: productId }, {
            linkedInventoryCodes: inventoryCodes,
            updatedAt: new Date().toISOString()
        });
    }

    // Get low stock products
    static async getLowStock(threshold = 10) {
        if (!Product.db) throw new Error('Database not initialized');
        const products = await Product.find();
        return products.filter(p => (p.currentStock || 0) <= threshold);
    }

    // Search products by name or code
    static async search(searchTerm) {
        if (!Product.db) throw new Error('Database not initialized');
        const products = await Product.find();
        return products.filter(p => 
            (p.name || '').toLowerCase().includes(searchTerm.toLowerCase()) ||
            (p.code || '').toLowerCase().includes(searchTerm.toLowerCase())
        );
    }
}

module.exports = Product;
