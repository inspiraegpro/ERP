const FileDatabaseManager = require('./file_db_manager');
const path = require('path');

async function setupBasicData() {
    console.log('🔄 جاري إعداد البيانات الأساسية...');
    
    const db = new FileDatabaseManager(path.join(__dirname, 'data_storage'));
    
    try {
        // 1. إنشاء حسابات مالية أساسية
        console.log('\n📊 إنشاء الحسابات المالية...');
        const accounts = [
            // الأصول
            { code: '1101', name: 'الصندوق الرئيسي', type: 'asset', isTransactional: true },
            { code: '110201', name: 'عملاء تجاريون (عام)', type: 'asset', isTransactional: true },
            { code: '1201', name: 'المخزون', type: 'asset', isTransactional: true },
            { code: '1301', name: 'معدات ومهمات', type: 'asset', isTransactional: false },
            
            // الخصوم
            { code: '2101', name: 'موردون', type: 'liability', isTransactional: true },
            { code: '2201', name: 'دائنون آخرون', type: 'liability', isTransactional: true },
            
            // حقوق الملكية
            { code: '3101', name: 'رأس المال', type: 'equity', isTransactional: false },
            { code: '3201', name: 'أرباح محتجزة', type: 'equity', isTransactional: false },
            
            // الإيرادات
            { code: '4101', name: 'إيرادات مبيعات', type: 'revenue', isTransactional: true },
            { code: '4201', name: 'إيرادات خدمات', type: 'revenue', isTransactional: true },
            
            // المصروفات
            { code: '5101', name: 'تكلفة بضاعة مباعة', type: 'expense', isTransactional: true },
            { code: '5201', name: 'مصروفات إدارية', type: 'expense', isTransactional: true },
            { code: '5301', name: 'مصروفات بيع وتسويق', type: 'expense', isTransactional: true }
        ];

        for (const account of accounts) {
            await db.create('accounts', account);
        }
        console.log(`✅ تم إنشاء ${accounts.length} حساب مالي`);

        // 2. إنشاء مستخدم أساسي
        console.log('\n👤 إنشاء المستخدم الأساسي...');
        const adminUser = {
            username: 'admin',
            password: 'admin123', // في التطبيق الحقيقي يجب تشفير كلمة المرور
            name: 'مدير النظام',
            email: 'admin@company.com',
            role: 'admin',
            isActive: true,
            createdAt: new Date().toISOString()
        };
        
        await db.create('users', adminUser);
        console.log('✅ تم إنشاء المستخدم admin (كلمة المرور: admin123)');

        // 3. إنشاء مخزن افتراضي
        console.log('\n🏭 إنشاء المخزن الافتراضي...');
        const defaultWarehouse = {
            code: 'WH001',
            name: 'المخزن الرئيسي',
            path: '/warehouse/main',
            manager: 'مدير المخزون',
            status: 'active',
            notes: 'المخزن الرئيسي للشركة',
            createdAt: new Date().toISOString()
        };
        
        await db.create('warehouses', defaultWarehouse);
        console.log('✅ تم إنشاء المخزن الرئيسي');

        // 4. إنشاء قيود افتتاحية
        console.log('\n📝 إنشاء القيود الافتتاحية...');
        const openingEntry = {
            referenceNumber: 'OPEN-001',
            date: new Date().toISOString().split('T')[0],
            description: 'قيود افتتاحية',
            status: 'posted',
            details: [
                {
                    accountId: (await db.find('accounts')).find(a => a.code === '1101')._id,
                    description: 'رصيد افتتاحي للصندوق',
                    debit: 100000,
                    credit: 0
                },
                {
                    accountId: (await db.find('accounts')).find(a => a.code === '3101')._id,
                    description: 'رأس المال',
                    debit: 0,
                    credit: 100000
                }
            ],
            createdAt: new Date().toISOString()
        };
        
        await db.create('journalentries', openingEntry);
        console.log('✅ تم إنشاء القيود الافتتاحية');

        console.log('\n🎉 اكتمل إعداد البيانات الأساسية!');
        console.log('📊 ملخص البيانات المنشأة:');
        console.log(`   • الحسابات المالية: ${accounts.length}`);
        console.log('   • المستخدمون: 1 (admin)');
        console.log('   • المخازن: 1 (رئيسي)');
        console.log('   • القيود الافتتاحية: 1');
        
        console.log('\n🔐 بيانات الدخول:');
        console.log('   • اسم المستخدم: admin');
        console.log('   • كلمة المرور: admin123');
        
        console.log('\n✨ النظام جاهز لبدء إدخال البيانات الفعلية!');
        
    } catch (error) {
        console.error('❌ خطأ في إعداد البيانات الأساسية:', error.message);
    }
}

// تنفيذ عملية الإعداد
setupBasicData().then(() => {
    console.log('\n🚀 يمكنك الآن بدء استخدام النظام!');
    process.exit(0);
}).catch(error => {
    console.error('❌ فشلت العملية:', error);
    process.exit(1);
});
