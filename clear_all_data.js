const FileDatabaseManager = require('./file_db_manager');
const path = require('path');

async function clearAllData() {
    console.log('🔄 جاري مسح جميع البيانات...');
    
    const db = new FileDatabaseManager(path.join(__dirname, 'data_storage'));
    
    try {
        // قائمة جميع المجموعات التي سيتم مسحها
        const collections = [
            'accounts',
            'customers', 
            'suppliers',
            'products',
            'stocktransactions',
            'rollbalances',
            'salesinvoices',
            'purchaseinvoices',
            'treasurytransactions',
            'journalentries',
            'servicejobs',
            'users'
        ];

        let totalDeleted = 0;

        for (const collection of collections) {
            try {
                // الحصول على جميع البيانات
                const data = await db.find(collection);
                const count = Array.isArray(data) ? data.length : 0;
                
                if (count > 0) {
                    // مسح جميع البيانات
                    await db.deleteMany(collection, {});
                    console.log(`✅ تم مسح ${count} سجل من مجموعة ${collection}`);
                    totalDeleted += count;
                } else {
                    console.log(`ℹ️  مجموعة ${collection} فارغة بالفعل`);
                }
            } catch (error) {
                console.log(`⚠️  خطأ في مسح مجموعة ${collection}: ${error.message}`);
            }
        }

        console.log(`\n🎉 اكتمل مسح البيانات!`);
        console.log(`📊 إجمالي السجلات المحذوفة: ${totalDeleted}`);
        console.log(`📍 النسخة الاحتياطية موجودة في: backup/data_backup_2026-04-14_17-14-41/`);
        
    } catch (error) {
        console.error('❌ خطأ في عملية المسح:', error.message);
    }
}

// تنفيذ عملية المسح
clearAllData().then(() => {
    console.log('\n✨ النظام جاهز لإدخال البيانات الجديدة!');
    process.exit(0);
}).catch(error => {
    console.error('❌ فشلت العملية:', error);
    process.exit(1);
});
