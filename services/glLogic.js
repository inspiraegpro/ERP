const Account = require('../models/Account');
const AccountingMapping = require('../models/AccountingMapping');
const FinancialSettings = require('../models/FinancialSettings');
const Product = require('../models/Product');

// Helper function to convert to number
const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

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
            throw new Error("Please define the Revenue Account and VAT Account in Financial Settings first.");
        }

        const details = [];

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

            for (const item of invoice.items) {
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

                // Calculate item total based on available fields
                let itemTotal = 0;
                if (item.total && item.total > 0) {
                    itemTotal = toNumber(item.total);
                } else if (item.price && item.quantity) {
                    itemTotal = toNumber(item.price) * toNumber(item.quantity);
                } else {
                    itemTotal = toNumber(item.price || 0) * (toNumber(item.quantity) || 1);
                }
                
                // Ensure minimum value to avoid division by zero
                if (itemTotal <= 0) itemTotal = 1;
                
                totalItemsValue += itemTotal;
                itemRatios.push({
                    accId,
                    value: itemTotal,
                    desc: p ? p.name : (item.partName || 'مبيعات')
                });
            }

            if (totalItemsValue > 0 && netRevenue > 0) {
                let distributed = 0;
                for (let i = 0; i < itemRatios.length; i++) {
                    const ir = itemRatios[i];
                    let amt;
                    if (i === itemRatios.length - 1) {
                        amt = Number((netRevenue - distributed).toFixed(2));
                    } else {
                        amt = Number((netRevenue * (ir.value / totalItemsValue)).toFixed(2));
                    }
                    if (amt < 0) amt = 0;
                    distributed += amt;

                    if (amt > 0) {
                        if (!revenueGroups[ir.accId]) {
                            revenueGroups[ir.accId] = { amount: 0, names: new Set() };
                        }
                        revenueGroups[ir.accId].amount += amt;
                        revenueGroups[ir.accId].names.add(ir.desc);
                    }
                }
            } else {
                revenueGroups[defaultRev] = { amount: netRevenue, names: new Set(['إيراد مبيعات']) };
            }
        } else {
            revenueGroups[defaultRev] = { amount: netRevenue, names: new Set(['إيراد مبيعات']) };
        }

        // Ensure total credit from revenue groups matches netRevenue
        let totalRevenueCredited = 0;
        for (const [accId, group] of Object.entries(revenueGroups)) {
            if (group.amount > 0) {
                const descNames = Array.from(group.names).join(' - ');
                details.push({
                    accountId: accId,
                    debit: 0,
                    credit: group.amount,
                    description: `إيراد مبيعات (${descNames}) فاتورة ${invoice.invoiceNumber}`
                });
                totalRevenueCredited += group.amount;
            }
        }

        // Adjust for any rounding differences
        const roundingDiff = netRevenue - totalRevenueCredited;
        if (Math.abs(roundingDiff) > 0.01 && Object.keys(revenueGroups).length > 0) {
            const firstRevenueAcc = Object.keys(revenueGroups)[0];
            const lastEntry = details.find(d => d.accountId === firstRevenueAcc && d.credit > 0);
            if (lastEntry) {
                lastEntry.credit = Number((lastEntry.credit + roundingDiff).toFixed(2));
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
            let whtAccountId = settings.defaultWhtAccountId;
            if (!whtAccountId) {
                try {
                    whtAccountId = await glLogic.getAccountId('110404');
                } catch (err) {
                    whtAccountId = await glLogic.getAccountId('210201');
                }
            }
            details.push({
                accountId: whtAccountId,
                debit: wht,
                credit: 0,
                description: `ضريبة أرباح تجارية (خصم منبع) فاتورة ${invoice.invoiceNumber}`
            });
        }

        // Final Validation: Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            console.error(`Unbalanced Entry - Debit: ${totalDebit}, Credit: ${totalCredit}, Diff: ${totalDebit - totalCredit}`);
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
            throw new Error("Please define the Inventory Account and COGS Account in Financial Settings first.");
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

            let totalItemsCost = 0;
            const itemRatios = [];

            // Load category mappings
            const categoryMappings = await AccountingMapping.find({ mappingType: 'CATEGORY' });

            for (const item of invoice.items) {
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

                // Get item cost - priority: item.cost > product.cost > fallback
                let itemCost = toNumber(item.cost);
                if (itemCost <= 0 && p && p.cost) {
                    itemCost = toNumber(p.cost);
                }
                if (itemCost <= 0) {
                    itemCost = 1; // Minimum fallback
                }
                
                totalItemsCost += itemCost;
                itemRatios.push({
                    cogsAccId, 
                    invAccId, 
                    value: itemCost, 
                    desc: p ? p.name : (item.partName || 'بضاعة')
                });
            }

            if (totalItemsCost > 0 && totalCost > 0) {
                let distributed = 0;
                for (let i = 0; i < itemRatios.length; i++) {
                    const ir = itemRatios[i];
                    let amt;
                    if (i === itemRatios.length - 1) {
                        amt = Number((totalCost - distributed).toFixed(2));
                    } else {
                        amt = Number((totalCost * (ir.value / totalItemsCost)).toFixed(2));
                    }
                    if (amt < 0) amt = 0;
                    distributed += amt;

                    if (amt > 0) {
                        if (!cogsGroups[ir.cogsAccId]) cogsGroups[ir.cogsAccId] = { amount: 0, names: new Set() };
                        cogsGroups[ir.cogsAccId].amount += amt;
                        cogsGroups[ir.cogsAccId].names.add(ir.desc);

                        if (!invGroups[ir.invAccId]) invGroups[ir.invAccId] = { amount: 0, names: new Set() };
                        invGroups[ir.invAccId].amount += amt;
                        invGroups[ir.invAccId].names.add(ir.desc);
                    }
                }
            } else {
                cogsGroups[defaultCogs] = { amount: totalCost, names: new Set(['تكلفة بضاعة مباعة']) };
                invGroups[defaultInv] = { amount: totalCost, names: new Set(['بضاعة']) };
            }
        } else {
            cogsGroups[defaultCogs] = { amount: totalCost, names: new Set(['تكلفة بضاعة مباعة']) };
            invGroups[defaultInv] = { amount: totalCost, names: new Set(['بضاعة']) };
        }

        // Add COGS debit entries
        for (const [accId, group] of Object.entries(cogsGroups)) {
            if (group.amount > 0) {
                details.push({ 
                    accountId: accId, 
                    debit: group.amount, 
                    credit: 0, 
                    description: `تكلفة مبيعات (${Array.from(group.names).join(' - ')}) - فاتورة ${invoice.invoiceNumber}` 
                });
            }
        }
        
        // Add Inventory credit entries
        for (const [accId, group] of Object.entries(invGroups)) {
            if (group.amount > 0) {
                details.push({ 
                    accountId: accId, 
                    debit: 0, 
                    credit: group.amount, 
                    description: `صرف مخزن (${Array.from(group.names).join(' - ')}) - فاتورة ${invoice.invoiceNumber}` 
                });
            }
        }

        // Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            console.error(`COGS Unbalanced - Debit: ${totalDebit}, Credit: ${totalCredit}`);
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
            throw new Error("Please define the Inventory Account and VAT Input Account in Financial Settings first.");
        }

        const details = [];

        const subtotal = toNumber(invoice.subtotal);
        const extraCosts = toNumber(invoice.totalExtraCosts);
        const totalTax = toNumber(invoice.totalTax);
        const totalDiscount = toNumber(invoice.totalDiscount);
        const totalAmount = toNumber(invoice.totalAmount);

        // Debit: Inventory (net of discount)
        const inventoryAmount = (subtotal + extraCosts) - totalDiscount;
        if (inventoryAmount > 0) {
            details.push({
                accountId: settings.defaultInventoryAccountId,
                debit: inventoryAmount,
                credit: 0,
                description: `مشتريات مخزنية - فاتورة ${invoice.invoiceNumber}`
            });
        }

        // Debit: VAT Input
        if (totalTax > 0) {
            details.push({
                accountId: invoice.accVat || settings.defaultVatInputAccountId,
                debit: totalTax,
                credit: 0,
                description: `ضريبة مدخلات - فاتورة ${invoice.invoiceNumber}`
            });
        }

        // Credit: Accounts Payable (total amount including tax)
        if (totalAmount > 0) {
            details.push({
                accountId: invoice.accSupplier || settings.defaultSupplierAccountId || await glLogic.getAccountId(glLogic.COA.AP),
                debit: 0,
                credit: totalAmount,
                description: `استحقاق مورد - فاتورة مشتريات ${invoice.invoiceNumber}`
            });
        }

        // Credit: Discount Earned (if discount exists)
        if (totalDiscount > 0) {
            let discountAccountId = settings.defaultDiscountAccountId;
            if (!discountAccountId) {
                try {
                    discountAccountId = await glLogic.getAccountId('4201');
                } catch (err) {
                    discountAccountId = await glLogic.getAccountId('5301');
                }
            }
            details.push({
                accountId: discountAccountId,
                debit: 0,
                credit: totalDiscount,
                description: `خصم مكتسب فاتورة ${invoice.invoiceNumber}`
            });
        }

        // Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            console.error(`Purchase Unbalanced - Debit: ${totalDebit}, Credit: ${totalCredit}`);
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
        const amount = toNumber(tx.amount);
        const isReceipt = tx.type === 'Inbound' || tx.type === 'Receipt';

        if (isReceipt) {
            // Receipt: Debit Treasury, Credit Revenue/Account
            details.push({
                accountId: tx.treasuryAccount || settings.defaultTreasuryAccountId,
                debit: amount,
                credit: 0,
                description: tx.description || `إيصال قبض - ${tx.serialNumber || tx.receiptNumber || ''}`
            });

            details.push({
                accountId: tx.targetAccount || settings.defaultRevenueAccountId,
                debit: 0,
                credit: amount,
                description: tx.description || `إيصال قبض - ${tx.serialNumber || tx.receiptNumber || ''}`
            });
        } else {
            // Payment: Credit Treasury, Debit Expense/Account
            details.push({
                accountId: tx.treasuryAccount || settings.defaultTreasuryAccountId,
                debit: 0,
                credit: amount,
                description: tx.description || `إيصال صرف - ${tx.serialNumber || tx.receiptNumber || ''}`
            });

            details.push({
                accountId: tx.targetAccount || settings.defaultExpenseAccountId || await glLogic.getAccountId('6101'),
                debit: amount,
                credit: 0,
                description: tx.description || `إيصال صرف - ${tx.serialNumber || tx.receiptNumber || ''}`
            });
        }

        // Balance Check
        const totalDebit = Number(details.reduce((sum, line) => sum + (line.debit || 0), 0).toFixed(2));
        const totalCredit = Number(details.reduce((sum, line) => sum + (line.credit || 0), 0).toFixed(2));
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            console.error(`Treasury Unbalanced - Debit: ${totalDebit}, Credit: ${totalCredit}`);
            throw new Error("FATAL_ERROR: Unbalanced Journal Entry");
        }

        return details;
    }
};

module.exports = glLogic;