const express = require('express');
const router = express.Router();
const accountService = require('../services/accountService');
const Account = require('../models/Account');

// 1. Create Account
router.post('/', async (req, res, next) => {
    try {
        const newAccount = await accountService.createAccount(req.body);
        res.status(201).json(newAccount);
    } catch (err) { next(err); }
});

// 2. Get All (Tree)
router.get('/', async (req, res, next) => {
    try {
        const accounts = await accountService.getAccountTree();
        res.json(accounts);
    } catch (err) { next(err); }
});

// 3. Update Account
router.patch('/:id', async (req, res, next) => {
    try {
        const updatedAccount = await accountService.updateAccount(req.params.id, req.body);
        res.json(updatedAccount);
    } catch (err) { next(err); }
});

router.put('/:id', async (req, res, next) => {
    try {
        const updatedAccount = await accountService.updateAccount(req.params.id, req.body);
        res.json(updatedAccount);
    } catch (err) { next(err); }
});

// 4. Delete Account (Now Secure)
router.delete('/:id', async (req, res, next) => {
    try {
        const result = await accountService.deleteAccount(req.params.id);
        res.json(result);
    } catch (err) { next(err); }
});

// 5. Seed Standard Tree (Keep logic or move to service? Keep here for now as it's admin utility)
router.post('/seed-standard-tree', async (req, res, next) => {
    try {
        // Warning: This is dangerous in production.
        // Should likely be protected or removed in prod.
        // For audit, we leave it but maybe add a check.
        
        // Clear all existing accounts
        const accounts = await Account.find();
        for (const account of accounts) {
            await Account.deleteOne({ _id: account._id });
        } 

        const standardTree = [
            { code: '1', name: 'الأصول', type: 'Asset', nature: 'Debit', isTransactional: false },
            { code: '11', name: 'أصول متداولة', type: 'Asset', nature: 'Debit', parentId: '1', isTransactional: false },
            { code: '1101', name: 'النقدية وما في حكمها', type: 'Asset', nature: 'Debit', parentId: '11', isTransactional: false },
            { code: '110101', name: 'النقدية بالخزينة', type: 'Asset', nature: 'Debit', parentId: '1101', isTransactional: false },
            { code: '11010101', name: 'الخزينة الرئيسية', type: 'Asset', nature: 'Debit', parentId: '110101', isTransactional: true },
            { code: '11010102', name: 'الخزينة الفرعية (الكاشير)', type: 'Asset', nature: 'Debit', parentId: '110101', isTransactional: true },
            { code: '110102', name: 'النقدية بالبنوك', type: 'Asset', nature: 'Debit', parentId: '1101', isTransactional: false },
            { code: '11010201', name: 'بنك الإسكندرية', type: 'Asset', nature: 'Debit', parentId: '110102', isTransactional: true },
            { code: '11010202', name: 'بنك CIB', type: 'Asset', nature: 'Debit', parentId: '110102', isTransactional: true },
            { code: '11010203', name: 'بنك QNB', type: 'Asset', nature: 'Debit', parentId: '110102', isTransactional: true },
            { code: '11010204', name: 'بنك عوده', type: 'Asset', nature: 'Debit', parentId: '110102', isTransactional: true },
            { code: '11010205', name: 'بنك الإسكندرية', type: 'Asset', nature: 'Debit', parentId: '110102', isTransactional: true },
            { code: '110103', name: 'العهد النقدية', type: 'Asset', nature: 'Debit', parentId: '1101', isTransactional: true },
            { code: '1102', name: 'العملاء والمدينون', type: 'Asset', nature: 'Debit', parentId: '11', isTransactional: false },
            { code: '110201', name: 'عملاء تجاريون (عام)', type: 'Asset', nature: 'Debit', parentId: '1102', isTransactional: true },
            { code: '1103', name: 'المخزون', type: 'Asset', nature: 'Debit', parentId: '11', isTransactional: false },
            { code: '110301', name: 'مخزن الخامات الرئيسي', type: 'Asset', nature: 'Debit', parentId: '1103', isTransactional: true },
            { code: '110302', name: 'مخزن الرولات', type: 'Asset', nature: 'Debit', parentId: '1103', isTransactional: true },
            { code: '110303', name: 'مخزن لوازم التشغيل', type: 'Asset', nature: 'Debit', parentId: '1103', isTransactional: true },
            { code: '1104', name: 'أرصدة مدينة أخرى', type: 'Asset', nature: 'Debit', parentId: '11', isTransactional: false },
            { code: '110401', name: 'سلف عاملين', type: 'Asset', nature: 'Debit', parentId: '1104', isTransactional: true },
            { code: '110402', name: 'قروض عاملين (مستديمة)', type: 'Asset', nature: 'Debit', parentId: '1104', isTransactional: true },
            { code: '110403', name: 'ضريبة القيمة المضافة (مشتريات)', type: 'Asset', nature: 'Debit', parentId: '1104', isTransactional: true },
            { code: '110404', name: 'ضريبة خصم من المنبع (مدينة)', type: 'Asset', nature: 'Debit', parentId: '1104', isTransactional: true },
            { code: '110405', name: 'مصروفات مقدمة', type: 'Asset', nature: 'Debit', parentId: '1104', isTransactional: true },
            { code: '12', name: 'أصول غير متداولة', type: 'Asset', nature: 'Debit', parentId: '1', isTransactional: false },
            { code: '1201', name: 'الأصول الثابتة (التكلفة)', type: 'Asset', nature: 'Debit', parentId: '12', isTransactional: false },
            { code: '120101', name: 'أراضي ومباني', type: 'Asset', nature: 'Debit', parentId: '1201', isTransactional: true },
            { code: '120102', name: 'الآلات والمعدات', type: 'Asset', nature: 'Debit', parentId: '1201', isTransactional: true },
            { code: '120103', name: 'أثاث ومفروشات', type: 'Asset', nature: 'Debit', parentId: '1201', isTransactional: true },
            { code: '120104', name: 'أجهزة حاسب آلي و الكترونيات', type: 'Asset', nature: 'Debit', parentId: '1201', isTransactional: true },
            { code: '120105', name: 'سيارات ووسائل نقل', type: 'Asset', nature: 'Debit', parentId: '1201', isTransactional: true },
            { code: '1203', name: 'مشروعات تحت التنفيذ', type: 'Asset', nature: 'Debit', parentId: '12', isTransactional: true },
            { code: '1202', name: 'مجمع الإهلاك', type: 'Asset', nature: 'Credit', parentId: '12', isTransactional: false },
            { code: '120201', name: 'مجمع إهلاك المباني', type: 'Asset', nature: 'Credit', parentId: '1202', isTransactional: true },
            { code: '120202', name: 'مجمع إهلاك الآلات', type: 'Asset', nature: 'Credit', parentId: '1202', isTransactional: true },
            { code: '120203', name: 'مجمع إهلاك الأثاث', type: 'Asset', nature: 'Credit', parentId: '1202', isTransactional: true },
            { code: '120204', name: 'مجمع إهلاك السيارات', type: 'Asset', nature: 'Credit', parentId: '1202', isTransactional: true },
            { code: '2', name: 'الالتزامات', type: 'Liability', nature: 'Credit', isTransactional: false },
            { code: '21', name: 'التزامات متداولة', type: 'Liability', nature: 'Credit', parentId: '2', isTransactional: false },
            { code: '2101', name: 'الموردين والدائنون', type: 'Liability', nature: 'Credit', parentId: '21', isTransactional: false },
            { code: '210101', name: 'موردين تجاريون (عام)', type: 'Liability', nature: 'Credit', parentId: '2101', isTransactional: true },
            { code: '210102', name: 'مشتريات- وسيط استلام (GRNI)', type: 'Liability', nature: 'Credit', parentId: '2101', isTransactional: true },
            { code: '2102', name: 'أرصدة دائنة أخرى', type: 'Liability', nature: 'Credit', parentId: '21', isTransactional: false },
            { code: '210201', name: 'ضريبة القيمة المضافة (مبيعات)', type: 'Liability', nature: 'Credit', parentId: '2102', isTransactional: true },
            { code: '210202', name: 'ضريبة خصم من المنبع (دائنة)', type: 'Liability', nature: 'Credit', parentId: '2102', isTransactional: true },
            { code: '210203', name: 'مصروفات مستحقة', type: 'Liability', nature: 'Credit', parentId: '2102', isTransactional: true },
            { code: '210204', name: 'رواتب مستحقة', type: 'Liability', nature: 'Credit', parentId: '2102', isTransactional: true },
            { code: '22', name: 'التزامات غير متداولة', type: 'Liability', nature: 'Credit', parentId: '2', isTransactional: false },
            { code: '2201', name: 'قروض طويلة الاجل ( بنوك)', type: 'Liability', nature: 'Credit', parentId: '22', isTransactional: true },
            { code: '3', name: 'حقوق الملكية', type: 'Equity', nature: 'Credit', isTransactional: false },
            { code: '31', name: 'رأس المال', type: 'Equity', nature: 'Credit', parentId: '3', isTransactional: true },
            { code: '32', name: 'الأرباح المرحلة (المبقاة)', type: 'Equity', nature: 'Credit', parentId: '3', isTransactional: true },
            { code: '33', name: 'جاري الشركاء', type: 'Equity', nature: 'Credit', parentId: '3', isTransactional: false },
            { code: '3301', name: 'م/ وليد', type: 'Equity', nature: 'Credit', parentId: '33', isTransactional: true },
            { code: '3302', name: 'م /نور', type: 'Equity', nature: 'Credit', parentId: '33', isTransactional: true },
            { code: '34', name: 'صافي ربح العام', type: 'Equity', nature: 'Credit', parentId: '3', isTransactional: true },
            { code: '4', name: 'الإيرادات', type: 'Revenue', nature: 'Credit', isTransactional: false },
            { code: '41', name: 'إيرادات التشغيل', type: 'Revenue', nature: 'Credit', parentId: '4', isTransactional: false },
            { code: '4101', name: 'إيرادات المبيعات والخدمات', type: 'Revenue', nature: 'Credit', parentId: '41', isTransactional: false },
            { code: '410101', name: 'إيرادات PPF', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '410102', name: 'إيرادات Matt', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '410103', name: 'إيرادات Plexi', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '410104', name: 'إيرادات W F', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '410105', name: 'إيرادات Vinyl', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '410106', name: 'إيرادات خدمات أخرى', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '410107', name: 'إيرادات خدمات نشاط', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '410108', name: 'إيرادات تركيب', type: 'Revenue', nature: 'Credit', parentId: '4101', isTransactional: true },
            { code: '42', name: 'إيرادات أخرى غير تشغيلية', type: 'Revenue', nature: 'Credit', parentId: '4', isTransactional: false },
            { code: '4201', name: 'خصم مكتسب', type: 'Revenue', nature: 'Credit', parentId: '42', isTransactional: true },
            { code: '4202', name: 'أرباح رأسمالية', type: 'Revenue', nature: 'Credit', parentId: '42', isTransactional: true },
            { code: '4203', name: 'خصومات وجزاءات موظفين', type: 'Revenue', nature: 'Credit', parentId: '42', isTransactional: true },
            { code: '5', name: 'المصاريف', type: 'Expense', nature: 'Debit', isTransactional: false },
            { code: '51', name: 'تكلفة النشاط (Cost of Sales)', type: 'Expense', nature: 'Debit', parentId: '5', isTransactional: false },
            { code: '5101', name: 'تكلفة البضاعة المباعة', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '5102', name: 'تكلفة PPF', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '5103', name: 'تكلفة Matt', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '5104', name: 'تكلفة Plexi', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '5105', name: 'تكلفة W F', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '5106', name: 'تكلفة Vinyl', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '5107', name: 'تكلفة خامات اكسسوارات', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '5109', name: 'تكلفة بضاعة أخرى (شحن/نقل)', type: 'Expense', nature: 'Debit', parentId: '51', isTransactional: true },
            { code: '52', name: 'مصاريف تشغيلية وإدارية', type: 'Expense', nature: 'Debit', parentId: '5', isTransactional: false },
            { code: '5201', name: 'خصم مسموح به', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5202', name: 'رواتب وأجور تشغيلية', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5203', name: 'إيجار', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5204', name: 'كهرباء ومياه', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5205', name: 'دعاية وإعلان وتسويق', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5206', name: 'ضيافة واستقبال', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5207', name: 'أدوات مكتبية ومطبوعات', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5208', name: 'صيانة وإصلاحات', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5209', name: 'مصاريف بنكية', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5210', name: 'رسوم حكومية وتراخيص', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5211', name: 'اتصالات وإنترنت', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5212', name: 'مصاريف إهلاك', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5213', name: 'فروق تقريب (كسور)', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '5214', name: 'حساب عمولات التدبير والوساطة', type: 'Expense', nature: 'Debit', parentId: '52', isTransactional: true },
            { code: '53', name: 'م ادارية و عمومية', type: 'Expense', nature: 'Debit', parentId: '5', isTransactional: false },
            { code: '5301', name: 'ايجار', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5302', name: 'أدوات مكتبية ومطبوعات', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5303', name: 'اتصالات وإنترنت', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5304', name: 'رسوم', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5305', name: 'صيانة وإصلاحات', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5306', name: 'نظافة', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5307', name: 'رواتب وأجور إدارية', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5308', name: 'مطبوعات', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5309', name: 'قطع غيار', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5310', name: 'اتعاب', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5311', name: 'تامين', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5312', name: 'كهرباء ومياه', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5313', name: 'صيانة وإصلاحات', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5314', name: 'مصاريف بنكية', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5315', name: 'رسوم حكومية وتراخيص', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '5316', name: 'فروق تقريب (كسور)', type: 'Expense', nature: 'Debit', parentId: '53', isTransactional: true },
            { code: '54', name: 'دعاية وإعلان وتسويق', type: 'Expense', nature: 'Debit', parentId: '5', isTransactional: true }
        ];

        // Insert standard accounts
        for (const account of standardTree) {
            await Account.create(account);
        }
        res.json({ message: "تم إنشاء الشجرة القياسية ✅" });

    } catch (err) { next(err); }
});

module.exports = router;
