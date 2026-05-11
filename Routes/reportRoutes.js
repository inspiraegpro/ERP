const express = require('express');
const router = express.Router();
const { authenticateToken: auth } = require('../middleware/auth');

const JournalEntry = require('../models/JournalEntry');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const SalesInvoice = require('../models/SalesInvoice');
const Account = require('../models/Account');
const Product = require('../models/Product');
const RollBalance = require('../models/RollBalance');
const Car = require('../models/Car');
const FileDatabaseManager = require('../file_db_manager');

const db = new FileDatabaseManager();

// ====================================================================
// BASIC REPORTS ENDPOINTS - Using File Database Manager
// ====================================================================

// 1. Sales Report
router.get('/sales', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let invoices = await db.find('salesinvoices');
        
        if (startDate && endDate) {
            invoices = invoices.filter(inv => {
                const date = new Date(inv.date || inv.createdAt);
                return date >= new Date(startDate) && date <= new Date(endDate);
            });
        }
        
        const summary = {
            totalInvoices: invoices.length,
            totalAmount: invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || parseFloat(inv.totalAmount) || 0), 0),
            totalPaid: invoices.reduce((sum, inv) => sum + (parseFloat(inv.paid) || parseFloat(inv.paidAmount) || 0), 0),
            totalRemaining: invoices.reduce((sum, inv) => sum + (parseFloat(inv.remaining) || 0), 0)
        };
        
        res.json({ summary, sales: invoices });
    } catch (e) { 
        console.error('Sales report error:', e);
        res.status(500).json({ message: e.message }); 
    }
});

// 2. Purchases Report
router.get('/purchases', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let invoices = await db.find('purchaseinvoices');
        
        if (startDate && endDate) {
            invoices = invoices.filter(inv => {
                const date = new Date(inv.date || inv.createdAt);
                return date >= new Date(startDate) && date <= new Date(endDate);
            });
        }
        
        const summary = {
            totalInvoices: invoices.length,
            totalAmount: invoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || parseFloat(inv.totalAmount) || 0), 0),
            totalPaid: invoices.reduce((sum, inv) => sum + (parseFloat(inv.paid) || parseFloat(inv.paidAmount) || 0), 0),
            totalRemaining: invoices.reduce((sum, inv) => sum + (parseFloat(inv.remaining) || 0), 0)
        };
        
        res.json({ summary, purchases: invoices });
    } catch (e) { 
        console.error('Purchases report error:', e);
        res.status(500).json({ message: e.message }); 
    }
});

// 3. Stock Report
router.get('/stock', async (req, res) => {
    try {
        const transactions = await db.find('stocktransactions');
        const products = await db.find('products');
        
        const summary = {
            totalTransactions: transactions.length,
            totalInbound: transactions.filter(t => t.type === 'Inbound' || t.type === 'inbound').reduce((sum, t) => sum + (parseFloat(t.totalAmount) || 0), 0),
            totalOutbound: transactions.filter(t => t.type === 'Outbound' || t.type === 'outbound').reduce((sum, t) => sum + (parseFloat(t.totalAmount) || 0), 0),
            totalProducts: products.length
        };
        
        res.json({ summary, transactions });
    } catch (e) { 
        console.error('Stock report error:', e);
        res.status(500).json({ message: e.message }); 
    }
});

// 4. Customers Report
router.get('/customers', async (req, res) => {
    try {
        const customers = await db.find('customers');
        const invoices = await db.find('salesinvoices');
        
        const customerData = customers.map(cust => {
            const custInvoices = invoices.filter(inv => inv.customer === cust._id || inv.customerId === cust._id);
            const totalSales = custInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
            return { ...cust, totalSales, invoiceCount: custInvoices.length };
        });
        
        const summary = {
            totalCustomers: customers.length,
            totalSales: customerData.reduce((sum, c) => sum + c.totalSales, 0),
            activeCustomers: customerData.filter(c => c.totalSales > 0).length
        };
        
        res.json({ summary, customers: customerData });
    } catch (e) { 
        console.error('Customers report error:', e);
        res.status(500).json({ message: e.message }); 
    }
});

// 5. Suppliers Report
router.get('/suppliers', async (req, res) => {
    try {
        const suppliers = await db.find('suppliers');
        const invoices = await db.find('purchaseinvoices');
        
        const supplierData = suppliers.map(supp => {
            const suppInvoices = invoices.filter(inv => inv.supplier === supp._id || inv.supplierId === supp._id);
            const totalPurchases = suppInvoices.reduce((sum, inv) => sum + (parseFloat(inv.total) || 0), 0);
            return { ...supp, totalPurchases, invoiceCount: suppInvoices.length };
        });
        
        const summary = {
            totalSuppliers: suppliers.length,
            totalPurchases: supplierData.reduce((sum, s) => sum + s.totalPurchases, 0),
            activeSuppliers: supplierData.filter(s => s.totalPurchases > 0).length
        };
        
        res.json({ summary, suppliers: supplierData });
    } catch (e) { 
        console.error('Suppliers report error:', e);
        res.status(500).json({ message: e.message }); 
    }
});

// 6. Treasury Report
router.get('/treasury', async (req, res) => {
    try {
        const { startDate, endDate } = req.query;
        let transactions = await db.find('treasurytransactions');
        
        if (startDate && endDate) {
            transactions = transactions.filter(trx => {
                const date = new Date(trx.date || trx.createdAt);
                return date >= new Date(startDate) && date <= new Date(endDate);
            });
        }
        
        const summary = {
            totalTransactions: transactions.length,
            totalIncome: transactions.filter(t => t.type === 'income').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
            totalExpense: transactions.filter(t => t.type === 'expense').reduce((sum, t) => sum + (parseFloat(t.amount) || 0), 0),
            netBalance: transactions.reduce((sum, t) => sum + (t.type === 'income' ? (parseFloat(t.amount) || 0) : -(parseFloat(t.amount) || 0)), 0)
        };
        
        res.json({ summary, transactions });
    } catch (e) { 
        console.error('Treasury report error:', e);
        res.status(500).json({ message: e.message }); 
    }
});

// ====================================================================
// 1. ميزان مراجعة الموردين (ملخص الأرصدة)
// ====================================================================
router.get('/suppliers-balance-summary', async (req, res) => {
    try {
        const { fromDate, toDate } = req.query;
        const start = fromDate ? new Date(fromDate) : new Date('1970-01-01');
        const end = toDate ? new Date(toDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const suppliers = await Supplier.find();
        const allEntries = await JournalEntry.find();
        const entries = allEntries.filter(e => e.status && e.status.toLowerCase() === 'posted');

        let report = [];

        for (const sup of suppliers) {
            let open = 0, deb = 0, cred = 0;
            const supId = sup._id.toString();

            for (const entry of entries) {
                const d = new Date(entry.date);
                const lines = (entry.details || entry.lines || []).filter(l =>
                    l.contactId && l.contactId.toString() === supId
                );

                for (const l of lines) {
                    const net = (parseFloat(l.credit) || 0) - (parseFloat(l.debit) || 0);
                    if (d < start) {
                        open += net;
                    } else if (d <= end) {
                        deb += (parseFloat(l.debit) || 0);
                        cred += (parseFloat(l.credit) || 0);
                    }
                }
            }

            if (open !== 0 || deb !== 0 || cred !== 0) {
                report.push({
                    id: sup._id,
                    code: sup.code || '-',
                    name: sup.name,
                    openingBalance: open,
                    periodDebit: deb,
                    periodCredit: cred,
                    closingBalance: open + (cred - deb)
                });
            }
        }
        res.json(report);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ====================================================================
// 2. كشف حساب مورد (Supplier Statement)
// ====================================================================
router.get('/supplier-statement', async (req, res) => {
    try {
        const { supplierId, supplierName, fromDate, toDate } = req.query;

        let targetId = supplierId;
        if (!targetId && supplierName) {
            const suppliers = await Supplier.find();
            const s = suppliers.find(sup => sup.name && sup.name.toLowerCase().includes(supplierName.toLowerCase()));
            if (s) targetId = s._id.toString();
        }

        if (!targetId) return res.status(400).json({ message: "مطلوب ID المورد أو اسمه" });

        const supplier = await Supplier.findOne({ _id: targetId });
        if (!supplier) return res.status(404).json({ message: "المورد غير موجود" });

        const start = fromDate ? new Date(fromDate) : new Date('1970-01-01');
        const end = toDate ? new Date(toDate) : new Date();
        end.setHours(23, 59, 59, 999);

        const rawEntries = await JournalEntry.find();
        const entries = rawEntries.filter(e =>
            (e.status && e.status.toLowerCase() === 'posted') &&
            (e.details || e.lines || []).some(l => l.contactId && String(l.contactId) === String(targetId))
        );

        let statement = [];
        let openBal = 0, runBal = 0;

        for (const entry of entries) {
            const d = new Date(entry.date);
            const lines = (entry.details || entry.lines || []).filter(l =>
                l.contactId && l.contactId.toString() === targetId
            );

            for (const line of lines) {
                const net = (parseFloat(line.credit) || 0) - (parseFloat(line.debit) || 0);
                if (d < start) openBal += net;
                else if (d <= end) {
                    runBal += net;
                    statement.push({
                        date: d.toISOString().split('T')[0],
                        ref: entry.referenceNumber,
                        desc: line.description || entry.description,
                        debit: parseFloat(line.debit) || 0,
                        credit: parseFloat(line.credit) || 0,
                        balance: openBal + runBal
                    });
                }
            }
        }
        res.json({
            supplierName: supplier.name,
            openingBalance: openBal,
            transactions: statement,
            endingBalance: openBal + runBal
        });

    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ====================================================================
// 3. إحصائيات لوحة التحكم (Dashboard Stats)
// ====================================================================
router.get('/dashboard-stats', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const allInvoices = await SalesInvoice.find();
        const monthlyInvoices = (allInvoices || []).filter(inv => new Date(inv.date) >= startOfMonth);
        const salesTotal = monthlyInvoices.reduce((sum, inv) => sum + (parseFloat(inv.finalTotal) || 0), 0);
        const salesCount = monthlyInvoices.length;

        const accounts = await Account.find();
        const treasuryAccounts = accounts.filter(a =>
            (a.code && a.code.startsWith('110')) ||
            (a.name && (a.name.includes('خزنة') || a.name.includes('بنك')))
        );
        const treasuryIds = treasuryAccounts.map(t => t._id.toString());

        const allEntries = await JournalEntry.find();
        const entries = allEntries.filter(e => e.status && e.status.toLowerCase() === 'posted');
        let cashBalance = 0;

        entries.forEach(entry => {
            const lines = entry.details || entry.lines || [];
            lines.forEach(line => {
                if (line.accountId && treasuryIds.includes(line.accountId.toString())) {
                    cashBalance += ((parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0));
                }
            });
        });

        const rolls = await RollBalance.find() || [];
        const stockValue = rolls.reduce((sum, roll) => {
            const area = parseFloat(roll.remainingArea) || 0;
            const cost = parseFloat(roll.unitCost) || 0;
            if (area > 0) return sum + (area * cost);
            return sum;
        }, 0);

        let receivables = 0;
        let payables = 0;

        entries.forEach(entry => {
            const lines = entry.details || entry.lines || [];
            lines.forEach(line => {
                if (line.contactModel === 'Customer') {
                    receivables += ((parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0));
                } else if (line.contactModel === 'Supplier') {
                    payables += ((parseFloat(line.credit) || 0) - (parseFloat(line.debit) || 0));
                }
            });
        });

        res.json({
            sales: { total: salesTotal, count: salesCount },
            cash: cashBalance,
            stock: stockValue,
            receivables: receivables,
            payables: payables
        });

    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

// ====================================================================
// 4. تحليل المبيعات والربحية (Sales Analysis)
// ====================================================================
router.get('/sales-analysis', async (req, res) => {
    try {
        const { type, from, to } = req.query;
        const start = from ? new Date(from) : new Date('1970-01-01');
        const end = to ? new Date(to) : new Date();
        end.setHours(23, 59, 59, 999);

        const allInvoices = await SalesInvoice.find();
        const invoices = allInvoices.filter(inv => {
            const d = new Date(inv.date);
            return d >= start && d <= end;
        });

        let report = [];

        if (type === 'customer') {
            const map = {};

            for (const inv of invoices) {
                const custId = inv.customer ? (inv.customer._id || inv.customer).toString() : 'cash';
                const custName = inv.customer ? (inv.customer.name || 'عميل') : 'عميل نقدي';

                if (!map[custId]) {
                    map[custId] = {
                        name: custName,
                        count: 0,
                        pieces: 0,
                        area: 0,
                        revenue: 0,
                        cost: 0,
                        profit: 0,
                        details: []
                    };
                }

                let invArea = 0;
                let invCost = 0;
                let invRevenue = parseFloat(inv.finalTotal) || 0;

                (inv.items || []).forEach(item => {
                    invArea += (parseFloat(item.area) || 0);
                    invCost += (parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 1);
                });

                map[custId].count++;
                map[custId].pieces += (inv.items || []).length;
                map[custId].area += invArea;
                map[custId].revenue += invRevenue;
                map[custId].cost += invCost;

                map[custId].details.push({
                    date: inv.date,
                    invNum: inv.invoiceNumber,
                    area: invArea,
                    revenue: invRevenue
                });
            }

            report = Object.values(map).map(c => ({
                ...c,
                profit: c.revenue - c.cost,
                margin: c.revenue ? Math.round(((c.revenue - c.cost) / c.revenue) * 100) : 0
            }));

        } else { // product
            const map = {};

            for (const inv of invoices) {
                (inv.items || []).forEach(item => {
                    const prodId = item.product ? (item.product._id || item.product).toString() : 'unknown';
                    const prodName = item.productName || 'منتج';

                    if (!map[prodId]) {
                        map[prodId] = {
                            name: prodName,
                            qty: 0,
                            revenue: 0,
                            cost: 0,
                            profit: 0
                        };
                    }

                    const itemRev = parseFloat(item.lineTotal) || 0;
                    const itemCost = (parseFloat(item.cost) || 0) * (parseFloat(item.quantity) || 1);

                    map[prodId].qty += (parseFloat(item.quantity) || 0);
                    map[prodId].revenue += itemRev;
                    map[prodId].cost += itemCost;
                });
            }

            report = Object.values(map).map(p => ({
                ...p,
                profit: p.revenue - p.cost,
                margin: p.revenue ? Math.round(((p.revenue - p.cost) / p.revenue) * 100) : 0
            }));
        }

        res.json(report);

    } catch (err) { res.status(500).json({ message: err.message }); }
});

// ====================================================================
// 5. ميزان المراجعة (Trial Balance)
// ====================================================================
router.get('/trial-balance', async (req, res) => {
    try {
        const { from, to, level } = req.query;
        const start = from ? new Date(from) : new Date('1970-01-01');
        const end = to ? new Date(to) : new Date();
        end.setHours(23, 59, 59);

        const accounts = await db.find('accounts');
        const allEntries = await db.find('journalentries');
        const entries = allEntries.filter(e => e.status && e.status.toLowerCase() === 'posted');

        const filteredEntries = entries.filter(e => e.date && new Date(e.date) <= end);

        let rawReport = [];

        for (const acc of accounts) {
            let openDr = 0, openCr = 0;
            let periodDr = 0, periodCr = 0;

            for (const entry of filteredEntries) {
                const d = new Date(entry.date);
                const lines = entry.details || entry.lines || [];

                for (const line of lines) {
                    if (line.accountId && line.accountId.toString() === acc._id.toString()) {
                        const dr = parseFloat(line.debit) || 0;
                        const cr = parseFloat(line.credit) || 0;

                        if (d < start) {
                            openDr += dr;
                            openCr += cr;
                        } else {
                            periodDr += dr;
                            periodCr += cr;
                        }
                    }
                }
            }

            const netOpen = openDr - openCr;
            const finalOpenDr = netOpen > 0 ? netOpen : 0;
            const finalOpenCr = netOpen < 0 ? Math.abs(netOpen) : 0;

            const netClose = (openDr + periodDr) - (openCr + periodCr);
            const finalCloseDr = netClose > 0 ? netClose : 0;
            const finalCloseCr = netClose < 0 ? Math.abs(netClose) : 0;

            if (finalOpenDr !== 0 || finalOpenCr !== 0 || periodDr !== 0 || periodCr !== 0 || finalCloseDr !== 0 || finalCloseCr !== 0) {
                rawReport.push({
                    _id: acc._id,
                    code: acc.code,
                    name: acc.name,
                    openDebit: finalOpenDr,
                    openCredit: finalOpenCr,
                    periodDebit: periodDr,
                    periodCredit: periodCr,
                    closeDebit: finalCloseDr,
                    closeCredit: finalCloseCr,
                    hasActivity: (periodDr > 0 || periodCr > 0),
                    hasBalance: (finalCloseDr > 0 || finalCloseCr > 0)
                });
            }
        }

        let finalReport = [];
        if (level === 'main') {
            const parents = accounts.filter(a => !a.isTransactional || (a.code && a.code.length <= 4));
            for (const p of parents) {
                const children = rawReport.filter(r => r.code && r.code.startsWith(p.code));
                if (children.length === 0) continue;

                const agg = children.reduce((acc, curr) => ({
                    openDebit: acc.openDebit + curr.openDebit,
                    openCredit: acc.openCredit + curr.openCredit,
                    periodDebit: acc.periodDebit + curr.periodDebit,
                    periodCredit: acc.periodCredit + curr.periodCredit,
                    closeDebit: acc.closeDebit + curr.closeDebit,
                    closeCredit: acc.closeCredit + curr.closeCredit
                }), { openDebit: 0, openCredit: 0, periodDebit: 0, periodCredit: 0, closeDebit: 0, closeCredit: 0 });

                finalReport.push({ code: p.code, name: p.name, ...agg });
            }
            finalReport.sort((a, b) => a.code.localeCompare(b.code));
        } else {
            finalReport = rawReport.sort((a, b) => a.code.localeCompare(b.code));
        }
        res.json(finalReport);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ====================================================================
// 6. دفتر الأستاذ التحليلي (General Ledger)
// ====================================================================
router.get('/general-ledger', async (req, res) => {
    try {
        const { accountId, from, to } = req.query;
        if (!accountId) return res.status(400).json({ message: "Account ID Required" });

        const start = from ? new Date(from) : new Date('1970-01-01');
        const end = to ? new Date(to) : new Date();
        end.setHours(23, 59, 59);

        const accounts = await db.find('accounts');
        const account = accounts.find(a => a._id === accountId);
        if (!account) return res.status(404).json({ message: "Account not found" });

        const allEntriesRaw = await db.find('journalentries');
        const entries = allEntriesRaw.filter(e =>
            (e.status && e.status.toLowerCase() === 'posted') &&
            (e.details || e.lines || []).some(l => l.accountId && String(l.accountId) === String(accountId))
        );

        let statement = [];
        let openingBalance = 0;
        let runningBalance = 0;

        for (const entry of entries) {
            const d = new Date(entry.date);
            const lines = (entry.details || entry.lines || []).filter(l => l.accountId && l.accountId.toString() === accountId);
            for (const line of lines) {
                const net = (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0);
                if (d < start) {
                    openingBalance += net;
                } else if (d <= end) {
                    statement.push({
                        date: d.toISOString().split('T')[0],
                        ref: entry.referenceNumber,
                        desc: line.description || entry.description,
                        debit: parseFloat(line.debit) || 0,
                        credit: parseFloat(line.credit) || 0
                    });
                }
            }
        }

        runningBalance = openingBalance;
        statement.sort((a, b) => new Date(a.date) - new Date(b.date));
        statement = statement.map(s => {
            runningBalance += (s.debit - s.credit);
            return { ...s, balance: runningBalance };
        });

        res.json({
            accountCode: account.code,
            accountName: account.name,
            openingBalance,
            transactions: statement,
            endingBalance: runningBalance
        });

    } catch (e) { res.status(500).json({ message: e.message }); }
});

// ====================================================================
// 7. القوائم المالية (BS, IS)
// ====================================================================
router.get('/financial-statement', async (req, res) => {
    try {
        const { type, date, from, to } = req.query;
        const asOf = date ? new Date(date) : new Date();
        asOf.setHours(23, 59, 59);

        if (type === 'balance_sheet') {
            const allAccounts = await db.find('accounts');
            const accounts = allAccounts.filter(a => a.code && /^[123]/.test(String(a.code)));
            const rawEntries = await db.find('journalentries');
            const entries = rawEntries.filter(e => (e.status && e.status.toLowerCase() === 'posted') && e.date && new Date(e.date) <= asOf);

            let report = { assets: [], liabilities: [], equity: [], totalAssets: 0, totalLiabilities: 0, totalEquity: 0 };

            for (const acc of accounts) {
                let bal = 0;
                for (const ent of entries) {
                    const lines = ent.details || ent.lines || [];
                    for (const l of lines) {
                        if (l.accountId && l.accountId.toString() === acc._id.toString()) {
                            bal += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
                        }
                    }
                }

                if (Math.abs(bal) > 0.01) {
                    const item = { code: acc.code, name: acc.name, balance: bal };
                    if (acc.code.startsWith('1')) { report.assets.push(item); report.totalAssets += bal; }
                    else if (acc.code.startsWith('2')) { report.liabilities.push({ ...item, balance: -bal }); report.totalLiabilities += -bal; }
                    else if (acc.code.startsWith('3')) { report.equity.push({ ...item, balance: -bal }); report.totalEquity += -bal; }
                }
            }
            res.json(report);

        } else if (type === 'income_statement') {
            const start = from ? new Date(from) : new Date(new Date().getFullYear(), 0, 1);
            const end = to ? new Date(to) : new Date();
            end.setHours(23, 59, 59);

            const allAccounts = await db.find('accounts');
            const accounts = allAccounts.filter(a => a.code && /^[45]/.test(String(a.code)));
            const rawEntries = await db.find('journalentries');
            const entries = rawEntries.filter(e => {
                const d = e.date ? new Date(e.date) : null;
                return (e.status && e.status.toLowerCase() === 'posted') && d && d >= start && d <= end;
            });

            let report = { revenues: [], expenses: [], totalRevenue: 0, totalExpense: 0, netIncome: 0 };

            for (const acc of accounts) {
                let bal = 0;
                for (const ent of entries) {
                    const lines = ent.details || ent.lines || [];
                    for (const l of lines) {
                        if (l.accountId && l.accountId.toString() === acc._id.toString()) {
                            bal += (parseFloat(l.debit) || 0) - (parseFloat(l.credit) || 0);
                        }
                    }
                }

                if (Math.abs(bal) > 0.01) {
                    if (acc.code.startsWith('4')) {
                        const val = -bal;
                        report.revenues.push({ code: acc.code, name: acc.name, amount: val });
                        report.totalRevenue += val;
                    } else {
                        report.expenses.push({ code: acc.code, name: acc.name, amount: bal });
                        report.totalExpense += bal;
                    }
                }
            }
            report.netIncome = report.totalRevenue - report.totalExpense;
            res.json(report);
        } else {
            res.status(400).json({ message: "Invalid type" });
        }
    } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/stock-current', async (req, res) => {
    try {
        const rolls = await RollBalance.find() || [];
        const activeRolls = rolls.filter(r => (parseFloat(r.remainingArea) || 0) > 0);

        const summary = {};
        activeRolls.forEach(r => {
            const pid = r.product ? (r.product._id || r.product).toString() : 'unknown';
            if (!summary[pid]) summary[pid] = { qty: 0, val: 0, name: r.productName || 'منتج' };
            summary[pid].qty += parseFloat(r.remainingArea) || 0;
            summary[pid].val += (parseFloat(r.remainingArea) || 0) * (parseFloat(r.unitCost) || 0);
        });

        const result = Object.entries(summary).map(([pid, data]) => ({
            _id: pid,
            name: data.name,
            qty: data.qty,
            avgCost: data.qty > 0 ? (data.val / data.qty) : 0
        }));
        res.json(result);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/dashboard-executive', async (req, res) => {
    try {
        const now = new Date();
        const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

        const invoices = await SalesInvoice.find();
        const monthlyInvoices = (invoices || []).filter(inv => new Date(inv.date) >= startOfMonth);
        const salesTotal = monthlyInvoices.reduce((sum, inv) => sum + (parseFloat(inv.finalTotal) || 0), 0);
        const salesCount = monthlyInvoices.length;

        const products = await Product.find();
        const totalProducts = (products || []).length;

        const accounts = await Account.find();
        const treasuryAccounts = accounts.filter(a =>
            (a.code && String(a.code).startsWith('110')) ||
            (a.name && (
                String(a.name).includes('خزنة') ||
                String(a.name).includes('بنك') ||
                String(a.name).includes('Ø®Ø²Ù†Ø©') ||
                String(a.name).includes('Ø¨Ù†Ùƒ')
            ))
        );
        const treasuryIds = treasuryAccounts.map(account => String(account._id));

        const journalEntries = await JournalEntry.find();
        const postedEntries = (journalEntries || []).filter(entry =>
            entry.status && String(entry.status).toLowerCase() === 'posted'
        );

        let cashBalance = 0;
        let receivables = 0;
        let payables = 0;

        postedEntries.forEach(entry => {
            const lines = entry.details || entry.lines || [];
            lines.forEach(line => {
                if (line.accountId && treasuryIds.includes(String(line.accountId))) {
                    cashBalance += (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0);
                }

                if (line.contactModel === 'Customer') {
                    receivables += (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0);
                }

                if (line.contactModel === 'Supplier') {
                    payables += (parseFloat(line.credit) || 0) - (parseFloat(line.debit) || 0);
                }
            });
        });

        const rolls = await RollBalance.find() || [];
        const activeRolls = rolls.filter(roll => (parseFloat(roll.remainingArea) || 0) > 0);
        const stockValue = activeRolls.reduce((sum, roll) => {
            const area = parseFloat(roll.remainingArea) || 0;
            const cost = parseFloat(roll.unitCost) || 0;
            return sum + (area * cost);
        }, 0);

        const lowStockProducts = (products || []).filter(product => {
            const currentStock = parseFloat(product.currentStock) || 0;
            return currentStock > 0 && currentStock <= 5;
        }).length;

        const outOfStockProducts = (products || []).filter(product => {
            const currentStock = parseFloat(product.currentStock) || 0;
            return currentStock <= 0;
        }).length;

        const users = await db.find('users');
        const auditLogs = await db.find('audit_logs');
        const activeWindowStart = new Date(now.getTime() - (15 * 60 * 1000));
        const activeUsers = new Set(
            (auditLogs || [])
                .filter(log => log.timestamp && new Date(log.timestamp) >= activeWindowStart)
                .map(log => log.user?.username || log.ip)
                .filter(Boolean)
        ).size;

        res.json({
            sales: { total: salesTotal, count: salesCount },
            cash: cashBalance,
            stock: stockValue,
            receivables,
            payables,
            balances: {
                total: cashBalance + stockValue + receivables - payables,
                treasuryAccounts: treasuryAccounts.length
            },
            inventory: {
                totalProducts,
                activeRolls: activeRolls.length,
                healthyProducts: Math.max(totalProducts - lowStockProducts - outOfStockProducts, 0),
                lowStockProducts,
                outOfStockProducts
            },
            admin: {
                stockCost: stockValue,
                totalUsers: (users || []).length,
                activeUsers
            }
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

router.get('/cfo-dashboard', async (req, res) => {
    try {
        const now = new Date();
        const from = req.query.from ? new Date(req.query.from) : new Date(now.getFullYear(), now.getMonth(), 1);
        const to = req.query.to ? new Date(req.query.to) : now;
        to.setHours(23, 59, 59, 999);

        // Use file_db_manager instead of Mongoose models
        const invoices = await db.find('salesinvoices');
        const filteredInvoices = invoices.filter(inv => {
            const invoiceDate = inv.date ? new Date(inv.date) : null;
            return invoiceDate && invoiceDate >= from && invoiceDate <= to;
        });

        const stockRows = await db.find('rollbalances') || [];
        const activeRolls = stockRows.filter(roll => (parseFloat(roll.remainingArea) || 0) > 0);
        const stockValue = activeRolls.reduce((sum, roll) => {
            const remainingArea = parseFloat(roll.remainingArea) || 0;
            const unitCost = parseFloat(roll.unitCost) || 0;
            return sum + (remainingArea * unitCost);
        }, 0);

        const journalEntries = await db.find('journalentries');
        const filteredEntries = journalEntries.filter(entry => {
            const entryDate = entry.date ? new Date(entry.date) : null;
            return entry.status && String(entry.status).toLowerCase() === 'posted' && entryDate && entryDate >= from && entryDate <= to;
        });

        const accounts = await db.find('accounts');
        const treasuryAccounts = accounts.filter(account =>
            (account.code && String(account.code).startsWith('110')) ||
            (account.name && (
                String(account.name).includes('خزنة') ||
                String(account.name).includes('بنك') ||
                String(account.name).includes('Ø®Ø²Ù†Ø©') ||
                String(account.name).includes('Ø¨Ù†Ùƒ')
            ))
        );
        const treasuryIds = new Set(treasuryAccounts.map(account => String(account._id)));

        let cashPosition = 0;
        filteredEntries.forEach(entry => {
            (entry.details || entry.lines || []).forEach(line => {
                if (line.accountId && treasuryIds.has(String(line.accountId))) {
                    cashPosition += (parseFloat(line.debit) || 0) - (parseFloat(line.credit) || 0);
                }
            });
        });

        const productMap = {};
        let totalRevenue = 0;
        let totalCost = 0;

        filteredInvoices.forEach(invoice => {
            const invoiceRevenue = parseFloat(invoice.finalTotal || invoice.totalAmount || 0) || 0;
            totalRevenue += invoiceRevenue;

            (invoice.items || []).forEach(item => {
                const productId = String(item.product?._id || item.product || 'unknown');
                const productName = item.product?.name || item.productName || item.partName || 'منتج';
                const quantity = parseFloat(item.quantity || item.area || 0) || 0;
                const lineRevenue = parseFloat(item.lineTotal || item.price || 0) || 0;
                const unitCost = parseFloat(item.cost || item.unitCost || 0) || 0;
                const lineCost = quantity && unitCost ? quantity * unitCost : unitCost;
                totalCost += lineCost;

                if (!productMap[productId]) {
                    productMap[productId] = {
                        label: productName,
                        revenue: 0,
                        cost: 0,
                        quantity: 0
                    };
                }

                productMap[productId].revenue += lineRevenue;
                productMap[productId].cost += lineCost;
                productMap[productId].quantity += quantity;
            });
        });

        const profitability = Object.values(productMap)
            .map(item => ({
                label: item.label,
                revenue: item.revenue,
                cost: item.cost,
                profit: item.revenue - item.cost
            }))
            .sort((a, b) => b.profit - a.profit)
            .slice(0, 6);

        const stockSummary = {};
        activeRolls.forEach(roll => {
            const productKey = String(roll.product?._id || roll.product || roll.productCode || 'unknown');
            const productName = roll.productName || roll.product?.name || 'منتج';
            const remainingArea = parseFloat(roll.remainingArea) || 0;

            if (!stockSummary[productKey]) {
                stockSummary[productKey] = {
                    label: productName,
                    quantity: 0
                };
            }

            stockSummary[productKey].quantity += remainingArea;
        });

        const turnover = Object.values(stockSummary)
            .map(item => {
                const productProfitability = profitability.find(row => row.label === item.label);
                const revenue = productProfitability?.revenue || 0;
                return {
                    label: item.label,
                    stock: item.quantity,
                    turnover: item.quantity > 0 ? revenue / item.quantity : 0
                };
            })
            .sort((a, b) => b.turnover - a.turnover)
            .slice(0, 6);

        const monthlyBuckets = {};
        filteredInvoices.forEach(invoice => {
            const invoiceDate = new Date(invoice.date);
            const monthKey = `${invoiceDate.getFullYear()}-${String(invoiceDate.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyBuckets[monthKey]) {
                monthlyBuckets[monthKey] = { inflow: 0, outflow: 0 };
            }
            monthlyBuckets[monthKey].inflow += parseFloat(invoice.finalTotal || invoice.totalAmount || 0) || 0;
        });

        filteredEntries.forEach(entry => {
            const entryDate = new Date(entry.date);
            const monthKey = `${entryDate.getFullYear()}-${String(entryDate.getMonth() + 1).padStart(2, '0')}`;
            if (!monthlyBuckets[monthKey]) {
                monthlyBuckets[monthKey] = { inflow: 0, outflow: 0 };
            }

            (entry.details || entry.lines || []).forEach(line => {
                if (line.accountId && treasuryIds.has(String(line.accountId))) {
                    monthlyBuckets[monthKey].outflow += parseFloat(line.credit || 0) || 0;
                }
            });
        });

        const cashFlow = Object.entries(monthlyBuckets)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(([month, values]) => ({
                label: month,
                inflow: values.inflow,
                outflow: values.outflow,
                net: values.inflow - values.outflow
            }));

        res.json({
            period: {
                from: from.toISOString().split('T')[0],
                to: to.toISOString().split('T')[0]
            },
            kpis: {
                totalRevenue,
                totalCost,
                grossProfit: totalRevenue - totalCost,
                stockValue,
                cashPosition,
                averageInvoice: filteredInvoices.length ? totalRevenue / filteredInvoices.length : 0
            },
            charts: {
                profitability,
                turnover,
                cashFlow
            }
        });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

// تاريخ حركة المنتج (لكارت الصنف)
router.get('/product-history/:productId', auth, async (req, res) => {
    try {
        const { productId } = req.params;
        const movements = [];
        
        // 1. جلب أذون الصرف المنفذة لهذا المنتج
        const transactions = await db.find('stocktransactions');
        (transactions || []).forEach(trx => {
            if (trx.type === 'Outbound') {
                const item = (trx.items || []).find(i => String(i.product) === productId);
                if (item) {
                    movements.push({
                        date: trx.date,
                        type: 'OUT',
                        ref: trx.serialNumber,
                        memo: trx.customerName || 'صرف لأمر شغل',
                        qty: -Number(item.consumedArea || 0)
                    });
                }
            }
            if (trx.type === 'Inbound') {
                const item = (trx.items || []).find(i => String(i.product) === productId);
                if (item) {
                    movements.push({
                        date: trx.date,
                        type: 'IN',
                        ref: trx.serialNumber,
                        memo: trx.supplierName || 'استلام مخزني',
                        qty: Number(item.area || 0)
                    });
                }
            }
        });
        
        res.json(movements.sort((a,b) => new Date(b.date) - new Date(a.date)));
    } catch (error) {
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
