const fs = require('fs');
const path = require('path');
const FinancialSettings = require('../models/FinancialSettings');

const SETTINGS_DIR = path.join(__dirname, '..', 'data_storage', 'financial_settings');
const SETTINGS_FILE = path.join(SETTINGS_DIR, 'financial_settings.json');

function ensureSettingsDir() {
    if (!fs.existsSync(SETTINGS_DIR)) {
        fs.mkdirSync(SETTINGS_DIR, { recursive: true });
    }
}

function readJsonFile(filePath) {
    if (!fs.existsSync(filePath)) return null;

    const raw = fs.readFileSync(filePath, 'utf8').trim();
    if (!raw) return null;

    return JSON.parse(raw);
}

function deepMerge(target = {}, source = {}) {
    const result = Array.isArray(target) ? [...target] : { ...target };

    Object.entries(source || {}).forEach(([key, value]) => {
        if (value && typeof value === 'object' && !Array.isArray(value)) {
            result[key] = deepMerge(result[key] || {}, value);
            return;
        }
        result[key] = value;
    });

    return result;
}

function buildCanonicalSettings(raw = {}) {
    const purchaseMappings = raw.journalMappings?.purchase || {};
    const salesMappings = raw.journalMappings?.sales || {};
    const payrollMappings = raw.journalMappings?.payroll || {};

    return {
        ...raw,
        _id: raw._id || 'settings_financial',
        journalMappings: {
            purchase: {
                local: {
                    inventoryAccountId: purchaseMappings.local?.inventoryAccountId || raw.defaultInventoryAccountId || '',
                    supplierAccountId: purchaseMappings.local?.supplierAccountId || raw.defaultSupplierAccountId || '',
                    vatAccountId: purchaseMappings.local?.vatAccountId || raw.defaultVatInputAccountId || ''
                },
                imported: {
                    inventoryAccountId: purchaseMappings.imported?.inventoryAccountId || raw.defaultInventoryAccountId || '',
                    supplierAccountId: purchaseMappings.imported?.supplierAccountId || raw.defaultSupplierAccountId || '',
                    vatAccountId: purchaseMappings.imported?.vatAccountId || raw.defaultVatInputAccountId || ''
                }
            },
            sales: {
                customerAccountId: salesMappings.customerAccountId || raw.defaultCustomerAccountId || '',
                revenueAccountId: salesMappings.revenueAccountId || raw.defaultRevenueAccountId || '',
                vatOutputAccountId: salesMappings.vatOutputAccountId || raw.defaultVatOutputAccountId || '',
                whtAccountId: salesMappings.whtAccountId || raw.defaultWhtAccountId || ''
            },
            payroll: {
                salaryExpenseAccountId: payrollMappings.salaryExpenseAccountId || raw.defaultSalariesExpenseAccountId || '',
                salariesPayableAccountId: payrollMappings.salariesPayableAccountId || raw.defaultSalariesPayableAccountId || '',
                treasuryAccountId: payrollMappings.treasuryAccountId || raw.defaultTreasuryAccountId || '',
                advancesAccountId: payrollMappings.advancesAccountId || raw.defaultAdvancesAccountId || '',
                penaltiesAccountId: payrollMappings.penaltiesAccountId || raw.defaultRevenueAccountId || ''
            }
        },
        createdAt: raw.createdAt || new Date().toISOString(),
        updatedAt: raw.updatedAt || new Date().toISOString()
    };
}

async function persistSettings(settings, updateTimestamp = false) {
    ensureSettingsDir();
    const finalSettings = {
        ...settings,
        updatedAt: updateTimestamp ? new Date().toISOString() : settings.updatedAt || new Date().toISOString()
    };

    fs.writeFileSync(SETTINGS_FILE, JSON.stringify(finalSettings, null, 2));
    await FinancialSettings.save(finalSettings);
    return finalSettings;
}

const financialSettingsService = {
    settingsFilePath: SETTINGS_FILE,

    buildCanonicalSettings,

    /**
     * Fetch the single settings document
     */
    getSettings: async () => {
        const fileSettings = readJsonFile(SETTINGS_FILE);
        const dbSettings = fileSettings || await FinancialSettings.findOne() || {};
        const canonical = buildCanonicalSettings(dbSettings);

        const serializedExisting = JSON.stringify(fileSettings || {});
        const serializedCanonical = JSON.stringify(canonical);
        if (!fileSettings || serializedExisting !== serializedCanonical) {
            await persistSettings(canonical, false);
        }

        return canonical;
    },

    /**
     * Create or update settings while keeping the JSON file in sync.
     */
    updateSettings: async (data) => {
        const existing = await financialSettingsService.getSettings();
        const merged = deepMerge(existing, data || {});
        const canonical = buildCanonicalSettings(merged);
        return await persistSettings(canonical, true);
    }
};

module.exports = financialSettingsService;
