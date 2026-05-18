const FileDatabaseManager = require('../file_db_manager');
const JournalEntry = require('../models/JournalEntry');
const glLogic = require('./glLogic');
const financialSettingsService = require('./financialSettingsService');

const db = new FileDatabaseManager();

const roundAmount = (value) => Number((parseFloat(value) || 0).toFixed(2));

function resolveUserId(user) {
    return user?.id || user?._id || user?.username || 'system';
}

function requireAccount(accountId, label) {
    if (!accountId) {
        throw new Error(`الحساب المطلوب غير مضبوط في الإعدادات المالية: ${label}`);
    }
    return accountId;
}

async function findExistingTransaction(collection, transactionId, referenceNumber) {
    if (transactionId) {
        return await db.findById(collection, transactionId);
    }

    if (!referenceNumber) return null;

    const records = await db.find(collection);
    return records.find((record) =>
        record._id === referenceNumber ||
        record.invoiceNumber === referenceNumber ||
        record.referenceNumber === referenceNumber ||
        record.month === referenceNumber
    ) || null;
}

async function findExistingJournals(transactionId, referenceNumber) {
    const entries = await JournalEntry.find({});
    return entries.filter((entry) =>
        (transactionId && entry.transactionId === transactionId) ||
        (referenceNumber && entry.referenceNumber === referenceNumber)
    );
}

async function archiveBeforeMutation({
    transactionType,
    transactionCollection,
    transactionId,
    referenceNumber,
    incomingPayload,
    user,
    action
}) {
    const existingTransaction = await findExistingTransaction(
        transactionCollection,
        transactionId,
        referenceNumber
    );
    const effectiveTransactionId = transactionId || existingTransaction?._id || null;
    const effectiveReferenceNumber = referenceNumber || existingTransaction?.invoiceNumber || existingTransaction?.referenceNumber || existingTransaction?.month || null;
    const existingJournals = await findExistingJournals(effectiveTransactionId, effectiveReferenceNumber);

    return await db.create('audit_logs', {
        auditType: 'ACCOUNTING_SNAPSHOT',
        transactionType,
        transactionCollection,
        transactionId: effectiveTransactionId,
        referenceNumber: effectiveReferenceNumber,
        action: action || 'UPSERT',
        userId: resolveUserId(user),
        timestamp: new Date().toISOString(),
        previousTransaction: existingTransaction,
        previousJournals: existingJournals,
        incomingPayload
    });
}

function validateBalancedLines(lines) {
    const totalDebit = roundAmount(lines.reduce((sum, line) => sum + (line.debit || 0), 0));
    const totalCredit = roundAmount(lines.reduce((sum, line) => sum + (line.credit || 0), 0));

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Unbalanced journal entry: Debit ${totalDebit} != Credit ${totalCredit}`);
    }

    return { totalDebit, totalCredit };
}

async function buildPurchaseLines(invoice) {
    const settings = await financialSettingsService.getSettings();
    const purchaseType = String(invoice.invoiceType || 'local').toLowerCase() === 'imported'
        ? 'imported'
        : 'local';
    const purchaseSettings = settings.journalMappings?.purchase?.[purchaseType] || {};

    const inventoryAccountId = requireAccount(
        purchaseSettings.inventoryAccountId || settings.defaultInventoryAccountId,
        purchaseType === 'imported' ? 'Imported Goods Inventory' : 'Local Inventory'
    );
    const supplierAccountId = requireAccount(
        purchaseSettings.supplierAccountId || settings.defaultSupplierAccountId,
        purchaseType === 'imported' ? 'Overseas Supplier' : 'Local Supplier'
    );
    const vatAccountId = purchaseSettings.vatAccountId || settings.defaultVatInputAccountId || '';
    const discountAccountId = settings.defaultDiscountAccountId || await glLogic.getAccountId('4201');

    const inventoryDebit = roundAmount((invoice.subtotal || 0) + (invoice.totalExtraCosts || 0));
    const vatDebit = roundAmount(invoice.totalTax || 0);
    const discountCredit = roundAmount(invoice.totalDiscount || 0);
    const supplierCredit = roundAmount(invoice.totalAmount || invoice.finalTotal || 0);

    const lines = [
        {
            accountId: inventoryAccountId,
            debit: inventoryDebit,
            credit: 0,
            description: `مشتريات ${purchaseType === 'imported' ? 'مستوردة' : 'محلية'} - فاتورة ${invoice.invoiceNumber || invoice._id || ''}`.trim()
        },
        {
            accountId: supplierAccountId,
            debit: 0,
            credit: supplierCredit,
            description: `استحقاق مورد - فاتورة مشتريات ${invoice.invoiceNumber || invoice._id || ''}`.trim()
        }
    ];

    if (vatDebit > 0) {
        lines.splice(1, 0, {
            accountId: requireAccount(vatAccountId, 'Purchase VAT'),
            debit: vatDebit,
            credit: 0,
            description: `ضريبة مشتريات - فاتورة ${invoice.invoiceNumber || invoice._id || ''}`.trim()
        });
    }

    if (discountCredit > 0) {
        lines.push({
            accountId: discountAccountId,
            debit: 0,
            credit: discountCredit,
            description: `خصم مكتسب - فاتورة ${invoice.invoiceNumber || invoice._id || ''}`.trim()
        });
    }

    return lines;
}

async function buildSalesLines(invoice) {
    const settings = await financialSettingsService.getSettings();
    const enrichedInvoice = {
        ...invoice,
        customerAccount: invoice.customerAccount || settings.journalMappings?.sales?.customerAccountId || settings.defaultCustomerAccountId,
        vatOutputAccountId: settings.journalMappings?.sales?.vatOutputAccountId || settings.defaultVatOutputAccountId,
        revenueAccountId: settings.journalMappings?.sales?.revenueAccountId || settings.defaultRevenueAccountId
    };

    return await glLogic.getSalesEntryDetails(enrichedInvoice);
}

function getPayrollTargetDetails(payroll, selectedEmployeeIds = []) {
    const selectedSet = new Set((selectedEmployeeIds || []).filter(Boolean).map(String));
    if (selectedSet.size === 0) {
        return payroll.details || [];
    }

    return (payroll.details || []).filter((line) => selectedSet.has(String(line.employee)));
}

async function buildPayrollLines(payroll, selectedEmployeeIds = []) {
    const settings = await financialSettingsService.getSettings();
    const payrollSettings = settings.journalMappings?.payroll || {};

    const details = getPayrollTargetDetails(payroll, selectedEmployeeIds);
    if (!details.length) {
        throw new Error('لا توجد تفاصيل رواتب مطابقة للموظفين المحددين.');
    }

    let totalGross = 0;
    let totalNet = 0;
    let totalLoans = 0;
    let totalPenalties = 0;

    details.forEach((line) => {
        const gross = roundAmount(line.grossSalary || line.totalSalary || ((line.basicSalary || line.basic || 0) + (line.variableSalary || line.variable || 0)));
        const net = roundAmount(line.netSalary || line.net || 0);
        const monthlyLoan = roundAmount(line.monthlyLoan || 0);
        const permanentLoan = roundAmount(line.permanentLoan || 0);
        const penalties = roundAmount(line.penalties || line.penaltyValue || 0);

        totalGross += gross;
        totalNet += net;
        totalLoans += monthlyLoan + permanentLoan;
        totalPenalties += penalties;
    });

    const lines = [
        {
            accountId: requireAccount(payrollSettings.salaryExpenseAccountId, 'Payroll Salary Expense'),
            accountName: 'Salary Expense',
            debit: roundAmount(totalGross),
            credit: 0,
            description: `Gross Salaries for ${payroll.month}`
        },
        {
            accountId: requireAccount(payrollSettings.treasuryAccountId, 'Payroll Treasury'),
            accountName: 'Treasury / Bank',
            debit: 0,
            credit: roundAmount(totalNet),
            description: `Net Salaries paid for ${payroll.month}`
        }
    ];

    if (roundAmount(totalLoans) > 0) {
        lines.push({
            accountId: requireAccount(payrollSettings.advancesAccountId, 'Payroll Advances / Loans'),
            accountName: 'Loans Receivable',
            debit: 0,
            credit: roundAmount(totalLoans),
            description: `Loans deducted for ${payroll.month}`
        });
    }

    if (roundAmount(totalPenalties) > 0) {
        lines.push({
            accountId: requireAccount(payrollSettings.penaltiesAccountId, 'Payroll Penalties'),
            accountName: 'Penalties / Other Income',
            debit: 0,
            credit: roundAmount(totalPenalties),
            description: `Penalties deducted for ${payroll.month}`
        });
    }

    return lines;
}

async function replaceJournalEntry({
    transactionType,
    transactionId,
    referenceNumber,
    journalType,
    source,
    description,
    date,
    details,
    user
}) {
    const existingJournals = await findExistingJournals(transactionId, referenceNumber);
    for (const entry of existingJournals) {
        await JournalEntry.deleteOne({ _id: entry._id });
    }

    const normalizedDetails = details.map((line) => ({
        accountId: line.accountId,
        accountName: line.accountName || '',
        debit: roundAmount(line.debit),
        credit: roundAmount(line.credit),
        description: line.description || ''
    }));
    const totals = validateBalancedLines(normalizedDetails);

    return await JournalEntry.create({
        entryNumber: await JournalEntry.generateEntryNumber(),
        transactionType,
        transactionId,
        referenceNumber,
        journalType,
        source,
        description,
        date: date || new Date().toISOString(),
        status: 'Posted',
        createdBy: resolveUserId(user),
        totalDebit: totals.totalDebit,
        totalCredit: totals.totalCredit,
        details: normalizedDetails
    });
}

async function syncPurchaseJournal(invoice, user) {
    const lines = await buildPurchaseLines(invoice);
    return await replaceJournalEntry({
        transactionType: String(invoice.invoiceType || 'local').toLowerCase() === 'imported'
            ? 'PURCHASE_IMPORTED'
            : 'PURCHASE_LOCAL',
        transactionId: invoice._id,
        referenceNumber: invoice.invoiceNumber || invoice._id,
        journalType: 'Purchase',
        source: 'Accounting Engine',
        description: `فاتورة مشتريات رقم ${invoice.invoiceNumber || invoice._id || ''}`.trim(),
        date: invoice.date,
        details: lines,
        user
    });
}

async function syncSalesJournal(invoice, user) {
    const lines = await buildSalesLines(invoice);
    return await replaceJournalEntry({
        transactionType: 'SALES_INVOICE',
        transactionId: invoice._id,
        referenceNumber: invoice.invoiceNumber || invoice._id,
        journalType: 'Sales',
        source: 'Accounting Engine',
        description: `فاتورة مبيعات رقم ${invoice.invoiceNumber || invoice._id || ''}`.trim(),
        date: invoice.date,
        details: lines,
        user
    });
}

async function syncPayrollJournal(payroll, selectedEmployeeIds, user) {
    const lines = await buildPayrollLines(payroll, selectedEmployeeIds);
    return await replaceJournalEntry({
        transactionType: 'PAYROLL_POSTING',
        transactionId: payroll._id,
        referenceNumber: `PR-${payroll.month}`,
        journalType: 'Payroll',
        source: 'Accounting Engine',
        description: `Payroll Posting for ${payroll.month}`,
        date: new Date().toISOString(),
        details: lines,
        user
    });
}

module.exports = {
    archiveBeforeMutation,
    buildPurchaseLines,
    buildSalesLines,
    buildPayrollLines,
    validateBalancedLines,
    syncPurchaseJournal,
    syncSalesJournal,
    syncPayrollJournal
};
