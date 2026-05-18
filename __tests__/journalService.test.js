const financialSettingsService = require('../services/financialSettingsService');
const journalService = require('../services/journalService');

describe('financialSettingsService.buildCanonicalSettings', () => {
    test('maps legacy defaults into purchase and payroll journal mappings', () => {
        const settings = financialSettingsService.buildCanonicalSettings({
            defaultInventoryAccountId: 'inv-default',
            defaultSupplierAccountId: 'sup-default',
            defaultVatInputAccountId: 'vat-in',
            defaultSalariesExpenseAccountId: 'salary-exp',
            defaultTreasuryAccountId: 'treasury-main',
            defaultAdvancesAccountId: 'adv-main',
            defaultRevenueAccountId: 'rev-main'
        });

        expect(settings.journalMappings.purchase.local.inventoryAccountId).toBe('inv-default');
        expect(settings.journalMappings.purchase.imported.supplierAccountId).toBe('sup-default');
        expect(settings.journalMappings.purchase.local.vatAccountId).toBe('vat-in');
        expect(settings.journalMappings.payroll.salaryExpenseAccountId).toBe('salary-exp');
        expect(settings.journalMappings.payroll.treasuryAccountId).toBe('treasury-main');
        expect(settings.journalMappings.payroll.advancesAccountId).toBe('adv-main');
        expect(settings.journalMappings.payroll.penaltiesAccountId).toBe('rev-main');
    });

    test('keeps explicit imported purchase overrides', () => {
        const settings = financialSettingsService.buildCanonicalSettings({
            defaultInventoryAccountId: 'inv-default',
            defaultSupplierAccountId: 'sup-default',
            journalMappings: {
                purchase: {
                    imported: {
                        inventoryAccountId: 'inv-imported',
                        supplierAccountId: 'sup-overseas'
                    }
                }
            }
        });

        expect(settings.journalMappings.purchase.imported.inventoryAccountId).toBe('inv-imported');
        expect(settings.journalMappings.purchase.imported.supplierAccountId).toBe('sup-overseas');
        expect(settings.journalMappings.purchase.local.inventoryAccountId).toBe('inv-default');
    });
});

describe('journalService.validateBalancedLines', () => {
    test('returns debit and credit totals for balanced entries', () => {
        const totals = journalService.validateBalancedLines([
            { debit: 125.125, credit: 0 },
            { debit: 0, credit: 125.125 }
        ]);

        expect(totals).toEqual({
            totalDebit: 125.13,
            totalCredit: 125.13
        });
    });

    test('throws when totals are not balanced', () => {
        expect(() => journalService.validateBalancedLines([
            { debit: 100, credit: 0 },
            { debit: 0, credit: 99 }
        ])).toThrow('Unbalanced journal entry');
    });
});
