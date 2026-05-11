const FileDatabaseManager = require('./file_db_manager');
const path = require('path');
const fs = require('fs');

async function restoreData() {
    console.log('🔄 جاري استعادة البيانات من النسخة الاحتياطية...');
    
    try {
        // البحث عن أحدث نسخة احتياطية
        const backupDir = path.join(__dirname, 'backup');
        const backups = fs.readdirSync(backupDir)
            .filter(dir => dir.startsWith('data_backup_'))
            .sort()
            .reverse();

        if (backups.length === 0) {
            console.log('❌ لا توجد نسخ احتياطية متاحة');
            return;
        }

        const latestBackup = backups[0];
        const backupPath = path.join(backupDir, latestBackup);
        const dataPath = path.join(__dirname, 'data_storage');

        console.log(`📦 استخدام النسخة الاحتياطية: ${latestBackup}`);

        // حذف البيانات الحالية
        if (fs.existsSync(dataPath)) {
            fs.rmSync(dataPath, { recursive: true, force: true });
        }

        // نسخ البيانات من النسخة الاحتياطية
        fs.cpSync(backupPath, dataPath, { recursive: true });

        console.log('✅ تم استعادة البيانات بنجاح!');
        console.log(`📍 تم الاستعادة من: ${backupPath}`);
        console.log('🔄 أعد تشغيل السيرفر لتفعيل التغييرات');

    } catch (error) {
        console.error('❌ خطأ في استعادة البيانات:', error.message);
    }
}

// تنفيذ عملية الاستعادة
restoreData().then(() => {
    process.exit(0);
}).catch(error => {
    console.error('❌ فشلت العملية:', error);
    process.exit(1);
});
