const Account = require('../models/Account');
const AccountingMapping = require('../models/AccountingMapping');
const FinancialSettings = require('../models/FinancialSettings');
const Product = require('../models/Product');

const glLogic = {
    // Standard chart of accounts codes (Legacy fallback)
    COA: {
        CASH: '11010101',
        BANK: '11010201',
        AR: '110201',
        INVENTORY: '110301',
        VAT_INPUT: '110403',
        AP: '210101',
        VAT_OUTPUT: '210201',
        REVENUE: '4101',
        COGS: '5101',
        DISCOUNT_ALLOWED: '5201'
    },

    /**
     * Get account ID by code
     */
    getAccountId: async (code) => {
        const acc = await Account.findOne({ code: String(code) });
        if (!acc) {
            const message = `الحساب المحاسبي برقم ${code} غير موجود في شجرة الحسابات. يرجى رفع شجرة الحسابات أولا.`;
            console.warn(`GL Logic: ${message}`);
            throw new Error(message);
        }
        return acc._id;
    },

    /**
     * Generate Sales Invoice Entry
     */
    getSalesEntryDetails: async (invoice) => {
        const settings = await FinancialSettings.findOne();
        if (!settings || !settings.defaultRevenueAccountId || !settings.defaultVatOutputAccountId) {
            throw new Error("FATAL_ERROR: Financial mapping is missing. Please configure Financial Settings.");
        }

        const details = [];

        const toNumber = (value) => {
            const parsed = parseFloat(value);
            return Number.isFinite(parsed) ? parsed : 0;
        };

        const subtotal = toNumber(invoice.subtotal);
        const extraCosts = toNumber(invoice.totalExtraCosts);
        const discount = toNumber(invoice.totalDiscount);
        const finalTotal = toNumber(invoice.totalWithVat || invoice.finalTotal || 0);
        const tax = toNumber(invoice.vatAmount || invoice.totalTax || 0);
        const netRevenue = toNumber(invoice.netAmount || 0);
        const wht = toNumber(invoice.whtAmount || 0);
        const receivable = finalTotal - wht;

        // Debit: Accounts Receivable or specific customer account
        details.push({
            accountId: invoice.customerAccount || settings.defaultCustomerAccountId || await glLogic.getAccountId(glLogic.COA.AR),
            debit: receivable,
            credit: 0,
            description: `فاتورة مبيعات رقم ${invoice.invoiceNumber} - ${invoice.customerName || ''}`
        });

        // Credit: Revenue (Distribute by product accounts)
        let revenueGroups = {};
        let defaultRev = settings.defaultRevenueAccountId;

        if (invoice.items && invoice.items.length > 0) {
            const productIds = invoice.items.map(i => typeof i.product === 'object' ? i.product._id : i.product).filter(Boolean);
            const products = await Product.find({ _id: { $in: productIds } });
            const productMap = {};
            products.forEach(p => productMap[String(p._id)] = p);

            let totalItemsValue = 0;
            const itemRatios = [];

            // Load category mappings
            const categoryMappings = await AccountingMapping.find({ mappingType: 'CATEGORY' });

            invoice.items.forEach(item => {
                const pId = typeof item.product === 'object' ? item.product._id : item.product;
                const p = productMap[String(pId)];
                
                let accId = defaultRev;
                if (p && p.accounts && p.accounts.sales) {
                    accId = p.accounts.sales;
                } else if (p && p.revenueAccountId) {
                    accId = p.revenueAccountId;
                } else if (p && p.category) {
                    const rule = categoryMappings.find(r => r.mappedValue === p.category);
                    if (rule && rule.revenueAccount) accId = rule.revenueAccount;
                }

                const itemTotal = toNumber(item.price || 0) * (toNumber(item.quantity) || 1) || toNumber(item.total || 0) || 1; 
                
                totalItemsValue += itemTotal;
                itemRatios.push({
                    accId,
                    value: itemTotal,
                    desc: p ? p.name : (item.partName || 'مبيعات')
                });
            });

            if (totalItemsValue > 0) {
                let distributed = 0;
                for (let i = 0; i < itemRatios.length; i++) {
                    const ir = itemRatios[i];
                    let amt;
                    if (i === itemRatios.length - 1) {
                        amt = Number((netRevenue - distributed).toFixed(2));
                    } else {
                        amt = Number((netRevenue * (ir.value / totalItemsValue)).toFixed(2));
                    }
                    distributed += amt;

                    if (!revenueGroups[ir.accId]) {
                        revenueGroups[ir.accId] = { amount: 0, names: new Set() };
                    }
                    revenueGroups[ir.accId].amount += amt;
                    revenueGroups[ir.accId].names.add(ir.desc);
                }
            } else {
                revenueGroups[defaultRev] = { amount: netRevenue, names: new Set(['إيراد مبيعات']) };
            }
        } else {
            revenueGroups[defaultRev] = { amount: netRevenue, names: new Set(['إيراد مبيعات']) };
        }

        for (const [accId, group] of Object.entries(revenueGroups)) {
            if (group.amount > 0) {
                const descNames = Array.from(group.names).join(' - ');
                details.push({
                    accountId: accId,
                    debit: 0,
                    credit: group.amount,
                    description: `إيراد مبيعات (${descNames}) فاتورة ${invoice.invoiceNumber}`
                });
            }
        }

        // Credit: VAT Output
        if (tax > 0) {
            details.push({
                accountId: settings.defaultVatOutputAccountId,
                debit: 0,
                credit: tax,
                description: `ضريبة مبيعات فاتورة ${invoice.invoiceNumber}`
            });
        }

        // Debit: WHT (if any)
        if (wht > 0) {
            details.push({
                accountId: settings.defaultWhtAccountId || await glLogic.getAccountId('110404'), // Configurable WHT
                debit: wht,
                credit: 0,
                description: `ضريبة أرباح تجارية (خصم منبع) فاتورة ${invoice.invoiceNumber}`
            });
        }

        // Final Validation: Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) !== 0) {
            throw new Error("FATAL_ERROR: Unbalanced Journal Entry");
        }

        if (process.env.NODE_ENV !== 'production') {
            console.log('Sales GL Details:', {
                subtotal, extraCosts, discount, tax, wht, netRevenue, receivable,
                totalDebit, totalCredit, diff: (totalDebit - totalCredit).toFixed(2)
            });
        }

        return details;
    },

    /**
     * Generate COGS Entry (Inventory reduce)
     */
    getCogsEntryDetails: async (invoice, totalCost) => {
        if (!totalCost || totalCost <= 0) return [];

        const settings = await FinancialSettings.findOne();
        if (!settings || !settings.defaultCogsAccountId || !settings.defaultInventoryAccountId) {
            throw new Error("FATAL_ERROR: Financial mapping is missing. Please configure Financial Settings.");
        }

        const details = [];
        
        let cogsGroups = {};
        let invGroups = {};
        let defaultCogs = settings.defaultCogsAccountId;
        let defaultInv = settings.defaultInventoryAccountId;

        if (invoice.items && invoice.items.length > 0) {
            const productIds = invoice.items.map(i => typeof i.product === 'object' ? i.product._id : i.product).filter(Boolean);
            const products = await Product.find({ _id: { $in: productIds } });
            const productMap = {};
            products.forEach(p => productMap[String(p._id)] = p);

            let totalItemsValue = 0;
            const itemRatios = [];

            // Load category mappings
            const categoryMappings = await AccountingMapping.find({ mappingType: 'CATEGORY' });

            invoice.items.forEach(item => {
                const pId = typeof item.product === 'object' ? item.product._id : item.product;
                const p = productMap[String(pId)];
                
                let cogsAccId = defaultCogs;
                let invAccId = defaultInv;

                // Fallback to rules first
                if (p && p.category) {
                    const rule = categoryMappings.find(r => r.mappedValue === p.category);
                    if (rule && rule.cogsAccount) cogsAccId = rule.cogsAccount;
                    if (rule && rule.inventoryAccount) invAccId = rule.inventoryAccount;
                }

                // Override if specific product mapping exists
                if (p && p.accounts && p.accounts.cogs) cogsAccId = p.accounts.cogs;
                if (p && p.accounts && p.accounts.inventory) invAccId = p.accounts.inventory;

                const itemCost = toNumber(item.cost || p?.cost || 1); 
                
                totalItemsValue += itemCost;
                itemRatios.push({
                    cogsAccId, invAccId, value: itemCost, desc: p ? p.name : (item.partName || 'بضاعة')
                });
            });

            if (totalItemsValue > 0) {
                let distributed = 0;
                for (let i = 0; i < itemRatios.length; i++) {
                    const ir = itemRatios[i];
                    let amt;
                    if (i === itemRatios.length - 1) {
                        amt = Number((totalCost - distributed).toFixed(2));
                    } else {
                        amt = Number((totalCost * (ir.value / totalItemsValue)).toFixed(2));
                    }
                    distributed += amt;

                    if (!cogsGroups[ir.cogsAccId]) cogsGroups[ir.cogsAccId] = { amount: 0, names: new Set() };
                    cogsGroups[ir.cogsAccId].amount += amt;
                    cogsGroups[ir.cogsAccId].names.add(ir.desc);

                    if (!invGroups[ir.invAccId]) invGroups[ir.invAccId] = { amount: 0, names: new Set() };
                    invGroups[ir.invAccId].amount += amt;
                    invGroups[ir.invAccId].names.add(ir.desc);
                }
            } else {
                cogsGroups[defaultCogs] = { amount: totalCost, names: new Set(['تكلفة بضاعة مباعة']) };
                invGroups[defaultInv] = { amount: totalCost, names: new Set(['بضاعة']) };
            }
        } else {
            cogsGroups[defaultCogs] = { amount: totalCost, names: new Set(['تكلفة بضاعة مباعة']) };
            invGroups[defaultInv] = { amount: totalCost, names: new Set(['بضاعة']) };
        }

        for (const [accId, group] of Object.entries(cogsGroups)) {
            if (group.amount > 0) {
                details.push({ accountId: accId, debit: group.amount, credit: 0, description: `تكلفة مبيعات (${Array.from(group.names).join(' - ')}) - فاتورة ${invoice.invoiceNumber}` });
            }
        }
        for (const [accId, group] of Object.entries(invGroups)) {
            if (group.amount > 0) {
                details.push({ accountId: accId, debit: 0, credit: group.amount, description: `صرف مخزن (${Array.from(group.names).join(' - ')}) - فاتورة ${invoice.invoiceNumber}` });
            }
        }

        // Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) !== 0) {
            throw new Error("FATAL_ERROR: Unbalanced Journal Entry");
        }

        return details;
    },

    /**
     * Generate Purchase Invoice Entry
     */
    getPurchaseEntryDetails: async (invoice) => {
        const settings = await FinancialSettings.findOne();
        if (!settings || !settings.defaultInventoryAccountId || !settings.defaultVatInputAccountId) {
            throw new Error("FATAL_ERROR: Financial mapping is missing. Please configure Financial Settings.");
        }

        const details = [];

        details.push({
            accountId: settings.defaultInventoryAccountId,
            debit: (invoice.subtotal || 0) + (invoice.totalExtraCosts || 0),
            credit: 0,
            description: `مشتريات مخزنية - فاتورة ${invoice.invoiceNumber}`
        });

        if (invoice.totalTax > 0) {
            details.push({
                accountId: invoice.accVat || settings.defaultVatInputAccountId,
                debit: invoice.totalTax,
                credit: 0,
                description: `ضريبة مدخلات - فاتورة ${invoice.invoiceNumber}`
            });
        }

        details.push({
            accountId: invoice.accSupplier || settings.defaultSupplierAccountId || await glLogic.getAccountId(glLogic.COA.AP),
            debit: 0,
            credit: invoice.totalAmount,
            description: `استحقاق مورد - فاتورة مشتريات ${invoice.invoiceNumber}`
        });

        if (invoice.totalDiscount > 0) {
            details.push({
                accountId: settings.defaultDiscountAccountId || await glLogic.getAccountId('4201'),
                debit: 0,
                credit: invoice.totalDiscount,
                description: `خصم مكتسب فاتورة ${invoice.invoiceNumber}`
            });
        }

        // Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) !== 0) {
            throw new Error("FATAL_ERROR: Unbalanced Journal Entry");
        }

        return details;
    },

    /**
     * Generate Treasury Entry (Receipt/Payment)
     */
    getTreasuryEntryDetails: async (tx) => {
        const settings = await FinancialSettings.findOne();
        if (!settings || !settings.defaultTreasuryAccountId) {
            throw new Error("FATAL_ERROR: Financial mapping is missing. Please configure Financial Settings.");
        }

        const details = [];
        const isReceipt = tx.type === 'Inbound' || tx.type === 'Receipt';

        details.push({
            accountId: tx.treasuryAccount || settings.defaultTreasuryAccountId,
            debit: isReceipt ? tx.amount : 0,
            credit: isReceipt ? 0 : tx.amount,
            description: tx.description || `حركة خزينة - ${tx.serialNumber}`
        });

        details.push({
            accountId: tx.targetAccount || settings.defaultRevenueAccountId, // Assuming Revenue as target default for receipts
            debit: isReceipt ? 0 : tx.amount,
            credit: isReceipt ? tx.amount : 0,
            description: tx.description || `حركة خزينة - ${tx.serialNumber}`
        });

        // Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) !== 0) {
            throw new Error("FATAL_ERROR: Unbalanced Journal Entry");
        }

        return details;
    }
};

module.exports = glLogic;
