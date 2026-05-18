const FileDbManager = require('../file_db_manager');
const journalService = require('./journalService');

const db = new FileDbManager();

const purchaseService = {
    getAllPurchases: async () => {
        return await db.find('purchaseinvoices');
    },

    getPurchaseById: async (id) => {
        return await db.findById('purchaseinvoices', id);
    },

    findPurchaseByNumber: async (number) => {
        const purchases = await db.find('purchaseinvoices');
        return purchases.find(p => p.invoiceNumber === number || p.invoiceId === number);
    },

    getNextInvoiceNumber: async () => {
        const purchases = await db.find('purchaseinvoices');
        const max = (purchases || []).reduce((m, p) => {
            const num = parseInt(p.invoiceNumber) || 0;
            return num > m ? num : m;
        }, 0);
        return max + 1;
    },

    createPurchase: async (data, user) => {
        try {
            // Normalize numeric values before persisting or posting.
            data.totalAmount = parseFloat(data.finalTotal || data.totalAmount || 0);
            data.subtotal = parseFloat(data.subtotal || 0);
            data.totalTax = parseFloat(data.totalTax || 0);
            data.totalDiscount = parseFloat(data.totalDiscount || 0);
            data.totalExtraCosts = parseFloat(data.totalExtraCosts || 0);

            await journalService.archiveBeforeMutation({
                transactionType: String(data.invoiceType || 'local').toLowerCase() === 'imported'
                    ? 'PURCHASE_IMPORTED'
                    : 'PURCHASE_LOCAL',
                transactionCollection: 'purchaseinvoices',
                referenceNumber: data.invoiceNumber,
                incomingPayload: data,
                user,
                action: 'CREATE'
            });

            const invoice = await db.create('purchaseinvoices', {
                ...data,
                status: data.status || 'Draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            try {
                await journalService.syncPurchaseJournal(invoice, user);
            } catch (glError) {
                console.error('⚠️ Failed to generate GL Entry for Purchase:', glError.message);
            }

            return invoice;
        } catch (error) {
            console.error('Error in createPurchase:', error);
            throw error;
        }
    },

    updatePurchase: async (id, data, user) => {
        data.totalAmount = parseFloat(data.finalTotal || data.totalAmount || 0);
        data.subtotal = parseFloat(data.subtotal || 0);
        data.totalTax = parseFloat(data.totalTax || 0);
        data.totalDiscount = parseFloat(data.totalDiscount || 0);
        data.totalExtraCosts = parseFloat(data.totalExtraCosts || 0);

        await journalService.archiveBeforeMutation({
            transactionType: String(data.invoiceType || 'local').toLowerCase() === 'imported'
                ? 'PURCHASE_IMPORTED'
                : 'PURCHASE_LOCAL',
            transactionCollection: 'purchaseinvoices',
            transactionId: id,
            referenceNumber: data.invoiceNumber,
            incomingPayload: data,
            user,
            action: 'UPDATE'
        });

        const updatedPurchase = await db.updateOne('purchaseinvoices', { _id: id }, {
            ...data,
            updatedAt: new Date().toISOString()
        });

        if (updatedPurchase) {
            await journalService.syncPurchaseJournal(updatedPurchase, user);
        }

        return updatedPurchase;
    },

    deletePurchase: async (id) => {
        // Warning: Should also delete or reverse GL entry if it was posted
        await db.deleteOne('purchaseinvoices', { _id: id });
    }
};

module.exports = purchaseService;
