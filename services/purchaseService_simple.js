const FileDbManager = require('../file_db_manager');

const db = new FileDbManager();

const purchaseService = {
    createPurchase: async (data, mode = 'create', oldId = null) => {
        const invoice = await db.create('purchaseinvoices', {
            ...data,
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        });
        return invoice;
    },

    deletePurchase: async (id) => {
        await db.deleteOne('purchaseinvoices', { _id: id });
    }
};

module.exports = purchaseService;
