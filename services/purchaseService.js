const FileDbManager = require('../file_db_manager');
const JournalEntry = require('../models/JournalEntry');
const glLogic = require('./glLogic');

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

    createPurchase: async (data) => {
        try {
            // 1. Validate total balance in data
            data.totalAmount = parseFloat(data.finalTotal || data.totalAmount || 0);
            data.subtotal = parseFloat(data.subtotal || 0);
            data.totalTax = parseFloat(data.totalTax || 0);
            data.totalDiscount = parseFloat(data.totalDiscount || 0);
            data.totalExtraCosts = parseFloat(data.totalExtraCosts || 0);

            // 2. Save Invoice
            const invoice = await db.create('purchaseinvoices', {
                ...data,
                status: data.status || 'Draft',
                createdAt: new Date().toISOString(),
                updatedAt: new Date().toISOString()
            });

            // 3. Generate GL Entry
            try {
                const entryDetails = await glLogic.getPurchaseEntryDetails(invoice);
                const entryNumber = await JournalEntry.generateEntryNumber();
                
                await JournalEntry.createBalancedEntry({
                    entryNumber,
                    date: invoice.date,
                    description: `فاتورة مشتريات رقم ${invoice.invoiceNumber} - مورد: ${invoice.supplierName || ''}`,
                    source: 'Purchase Module',
                    referenceNumber: invoice.invoiceNumber,
                    lines: entryDetails
                });
            } catch (glError) {
                console.error('⚠️ Failed to generate GL Entry for Purchase:', glError.message);
                // We still returned the invoice, but maybe mark it as "Warning: No GL Entry"
            }

            return invoice;
        } catch (error) {
            console.error('Error in createPurchase:', error);
            throw error;
        }
    },

    updatePurchase: async (id, data) => {
        return await db.updateOne('purchaseinvoices', { _id: id }, {
            ...data,
            updatedAt: new Date().toISOString()
        });
    },

    deletePurchase: async (id) => {
        // Warning: Should also delete or reverse GL entry if it was posted
        await db.deleteOne('purchaseinvoices', { _id: id });
    }
};

module.exports = purchaseService;
