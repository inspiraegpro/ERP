const express = require('express');
const router = express.Router();
const treasuryService = require('../services/treasuryService');
const SalesInvoice = require('../models/SalesInvoice');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const TreasuryTransaction = require('../models/TreasuryTransaction');

// POST: Make Payment (Mapped to TreasuryTransaction)
router.post('/', async (req, res, next) => {
    try {
        const { amount, type, invoiceId, invoiceType, treasuryAccount, note, date } = req.body;

        let targetAccountId;

        if (invoiceType === 'Sales') {
            const inv = await SalesInvoice.findOne({ _id: invoiceId });
            if (!inv) throw new Error("Invoice not found");

            // Look for customer account in the invoice data
            if (inv.customerAccount) {
                targetAccountId = inv.customerAccount;
            } else if (inv.customer && inv.customer.accountId) {
                targetAccountId = inv.customer.accountId;
            } else {
                throw new Error("Customer does not have a linked Account.");
            }
        } else if (invoiceType === 'Purchase') {
            const inv = await PurchaseInvoice.findOne({ _id: invoiceId });
            if (!inv) throw new Error("Invoice not found");

            if (inv.supplierAccount) {
                targetAccountId = inv.supplierAccount;
            } else if (inv.supplier && inv.supplier.accountId) {
                targetAccountId = inv.supplier.accountId;
            } else {
                throw new Error("Supplier does not have a linked Account.");
            }
        }

        const transData = {
            type: type, // 'Inbound' or 'Outbound'
            amount: Number(amount),
            treasuryAccount: treasuryAccount,
            targetAccount: targetAccountId,
            invoiceId: invoiceId,
            invoiceType: invoiceType,
            description: note || `Payment for ${invoiceType} Invoice`,
            date: date || new Date().toISOString()
        };

        const result = await treasuryService.createTreasuryTransaction(transData);
        res.status(201).json({ message: "Payment processed successfully", transaction: result });

    } catch (err) {
        next(err);
    }
});

// GET: Payments (Retrieve from TreasuryTransaction where invoiceId is set)
router.get('/', async (req, res, next) => {
    try {
        const allTransactions = await TreasuryTransaction.find();
        const payments = allTransactions.filter(t => t.invoiceId);
        res.json(payments);
    } catch (err) { next(err); }
});

module.exports = router;
