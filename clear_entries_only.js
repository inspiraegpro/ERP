const FileDatabaseManager = require('./file_db_manager');
const path = require('path');

async function clearEntriesOnly() {
    console.log('🧹 جاري مسح الادخالات فقط...');
    console.log('⚠️  سيتم الاحتفاظ بـ: السجرة الحسابات والسيارات والإعدادات\n');
    
    const db = new FileDatabaseManager(path.join(__dirname, 'data_storage'));
    
    try {
        // قائمة الادخالات التي سيتم مسحها فقط
        const entriesToDelete = [
            'salesinvoices',           // فواتير المبيعات
            'purchaseinvoices',        // فواتير الشراء
            'servicejobs',             // طلبات الخدمة
            'stocktransactions',       // حركات المخزون
            'journalentries',          // قيود اليومية
            'treasurytransactions',    // معاملات الخزينة
            'payments',                // المدفوعات
            'reissuerequests',         // طلبات إعادة الإصدار
            'warrantyrequests',        // طلبات الضمان
            'purchaseorders',          // أوامر الشراء
            'rollbalances'             // الأرصدة المقفولة
        ];

        let totalDeleted = 0;

        for (const collection of entriesToDelete) {
            try {
                // الحصول على عدد السجلات
                const data = await db.find(collection);
                const count = Array.isArray(data) ? data.length : 0;
                
                if (count > 0) {
                    // مسح جميع البيانات من هذه المجموعة
                    await db.deleteMany(collection, {});
                    console.log(`✅ تم مسح ${count} سجل من ${collection}`);
                    totalDeleted += count;
                }
            } catch (error) {
                // المجموعة قد لا تكون موجودة، لا مشكلة
                console.log(`ℹ️  ${collection} - لا توجد بيانات`);
            }
        }

        console.log(`\n🎉 اكتمل مسح الادخالات!`);
        console.log(`📊 إجمالي السجلات المحذوفة: ${totalDeleted}`);
        console.log(`\n✨ تم الاحتفاظ بـ:`);
        console.log(`  ✓ السجرة الحسابات (accounts)`);
        console.log(`  ✓ السيارات (cars)`);
        console.log(`  ✓ الموردين (suppliers)`);
        console.log(`  ✓ العملاء (customers)`);
        console.log(`  ✓ الموظفين (employees)`);
        console.log(`  ✓ المنتجات (products)`);
        console.log(`  ✓ الإعدادات (settings)`);
        
        process.exit(0);
        
    } catch (error) {
        console.error('❌ خطأ:', error.message);
        process.exit(1);
    }
}

clearEntriesOnly();
