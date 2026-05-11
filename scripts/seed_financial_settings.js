const Account = require('../models/Account');
const FinancialSettings = require('../models/FinancialSettings');
const FileDatabaseManager = require('../file_db_manager');

/**
 * Migration Script: Seed Financial Settings from Legacy Account Names
 */
async function seedFinancialSettings() {
    console.log('🚀 Starting Financial Settings Seeding...');
    
    // Ensure database is initialized for models
    const db = new FileDatabaseManager();
    const Product = require('../models/Product');
    Product.setDb(db);
    // Account handles its own db initialization in constructor
    
    try {
        const accounts = await Account.find();
        console.log(`📊 Found ${accounts.length} accounts.`);

        const findId = (names, codes = []) => {
            const acc = accounts.find(a => 
                names.includes(a.name) || 
                codes.includes(a.code)
            );
            return acc ? acc._id : null;
        };

        const settingsData = {
            defaultRevenueAccountId: findId(['إيرادات مبيعات', 'الربح من المبيعات', 'إيرادات المبيعات'], ['4101']),
            defaultCogsAccountId: findId(['تكلفة بضاعة مباعة', 'تكلفة المبيعات'], ['5101']),
            defaultInventoryAccountId: findId(['المخزون', 'مخزون الخامات', 'مخزون بضاعة'], ['1201', '110301']),
            defaultVatOutputAccountId: findId(['ضريبة القيمة المضافة - مخرجات', 'ضريبة مبيعات', 'ضريبة القيمة المضافة'], ['210201']),
            defaultVatInputAccountId: findId(['ضريبة القيمة المضافة - مدخلات', 'ضريبة مشتريات'], ['110403']),
            defaultDiscountAccountId: findId(['الخصم المسموح به', 'خصومات مبيعات'], ['5201']),
            defaultTreasuryAccountId: findId(['الصندوق الرئيسي', 'الخزينة الرئيسية', 'الخزينة', 'Cash'], ['1101', '11010101'])
        };

        console.log('⚙️ Mapping identified:', settingsData);

        const result = await FinancialSettings.save(settingsData);
        console.log('✅ Financial Settings Seeded successfully:', result);
        process.exit(0);
    } catch (err) {
        console.error('❌ Seeding failed:', err.message);
        process.exit(1);
    }
}

seedFinancialSettings();
