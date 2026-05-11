const Customer = require('../models/Customer');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const SalesInvoice = require('../models/SalesInvoice');

const customerService = {
    // 1. Create Customer
    createCustomer: async (data) => {
        const { accountId, ...otherData } = data;
        if (!accountId) throw new Error("يجب اختيار الحساب المالي");

        const existingAccount = await Account.findById(accountId);
        if (!existingAccount) throw new Error("الحساب المالي غير موجود");

        return await Customer.create({ ...otherData, accountId });
    },

    // 2. Update Customer
    updateCustomer: async (id, data) => {
        const updated = await Customer.updateOne({ _id: id }, data);
        if (!updated) throw new Error("العميل غير موجود");
        return updated;
    },

    // 3. Delete Customer (Safe)
    deleteCustomer: async (id) => {
        const customer = await Customer.findOne({ _id: id });
        if (!customer) throw new Error("العميل غير موجود");

        // Safety Check 1: Sales Invoices
        const allInvoices = await SalesInvoice.find();
        const hasInvoices = allInvoices.some(inv => String(inv.customer) === String(id));
        if (hasInvoices) throw new Error("لا يمكن حذف العميل لوجود فواتير مبيعات مرتبطة به");

        // Safety Check 2: Journal Entries (using contactId)
        const entries = await JournalEntry.find();
        const hasEntries = entries.some(e =>
            (e.details || e.lines || []).some(l => l.contactId && String(l.contactId) === String(id))
        );
        if (hasEntries) throw new Error("لا يمكن حذف العميل لوجود قيود محاسبية مرتبطة به");

        await Customer.deleteOne({ _id: id });
        return { message: "تم الحذف بنجاح" };
    },

    // 4. Get All
    getAllCustomers: async () => {
        const customers = await Customer.find();
        const accounts = await Account.find();

        // Manual Populate
        const result = customers.map(cust => {
            const acc = accounts.find(a => String(a._id) === String(cust.accountId));
            return { ...cust, accountId: acc || cust.accountId };
        });

        // Sort manually
        return result.sort((a, b) => new Date(b.createdAt || 0) - new Date(a.createdAt || 0));
    },

    // 5. Get One
    getCustomerById: async (id) => {
        const customer = await Customer.findOne({ _id: id });
        if (!customer) throw new Error("العميل غير موجود");

        const account = await Account.findById(customer.accountId);
        if (account) customer.accountId = account;

        return customer;
    },

    // 6. Report: Balance Summary (Consolidated logic with reportRoutes)
    getBalanceSummary: async (fromDate, toDate) => {
        const start = fromDate ? new Date(fromDate) : new Date('1970-01-01');
        const end = toDate ? new Date(toDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const customers = await Customer.find();
        const allEntries = await JournalEntry.find();
        const entries = allEntries.filter(e => e.status && e.status.toLowerCase() === 'posted');

        let report = [];

        for (const cust of customers) {
            let open = 0, deb = 0, cred = 0;
            const custIdStr = String(cust._id);

            for (const entry of entries) {
                const d = new Date(entry.date);
                const lines = (entry.details || entry.lines || []).filter(l => l.contactId && String(l.contactId) === custIdStr);

                for (const l of lines) {
                    const dVal = parseFloat(l.debit) || 0;
                    const cVal = parseFloat(l.credit) || 0;
                    const net = dVal - cVal;
                    if (d < start) { open += net; }
                    else if (d <= end) { deb += dVal; cred += cVal; }
                }
            }

            if (open !== 0 || deb !== 0 || cred !== 0) {
                report.push({
                    id: cust._id,
                    code: cust.code || '-',
                    name: cust.name,
                    openingBalance: open,
                    periodDebit: deb,
                    periodCredit: cred,
                    closingBalance: open + (deb - cred)
                });
            }
        }
        return report;
    },

    // 7. Report: Customer Statement
    getCustomerStatement: async (customerId, fromDate, toDate) => {
        if (!customerId) throw new Error("مطلوب ID العميل");

        const customer = await Customer.findOne({ _id: customerId });
        if (!customer) throw new Error("العميل غير موجود");

        const start = fromDate ? new Date(fromDate) : new Date('1970-01-01');
        const end = toDate ? new Date(toDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const allEntries = await JournalEntry.find();
        const entries = allEntries.filter(e => e.status && e.status.toLowerCase() === 'posted')
            .sort((a, b) => new Date(a.date) - new Date(b.date));

        let statement = [];
        let openBal = 0, runBal = 0;
        const custIdStr = String(customer._id);

        for (const entry of entries) {
            const d = new Date(entry.date);
            const lines = (entry.details || entry.lines || []).filter(l => l.contactId && String(l.contactId) === custIdStr);

            for (const line of lines) {
                const dVal = parseFloat(line.debit) || 0;
                const cVal = parseFloat(line.credit) || 0;
                const net = dVal - cVal;
                if (d < start) { openBal += net; }
                else if (d <= end) {
                    runBal += net;
                    statement.push({
                        date: d.toISOString().split('T')[0],
                        ref: entry.referenceNumber || entry.reference,
                        desc: line.description || entry.description,
                        debit: dVal,
                        credit: cVal,
                        balance: openBal + runBal
                    });
                }
            }
        }

        return {
            customerName: customer.name,
            openingBalance: openBal,
            transactions: statement,
            endingBalance: openBal + runBal
        };
    }
};

module.exports = customerService;
