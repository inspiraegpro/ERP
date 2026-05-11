const express = require('express');
const router = express.Router();
const SalesInvoice = require('../models/SalesInvoice');
const StockTransaction = require('../models/StockTransaction');
const Account = require('../models/Account');
const JournalEntry = require('../models/JournalEntry');
const Product = require('../models/Product');

// 1. إحصائيات لوحة التحكم (Dashboard Stats)
router.get('/dashboard-stats', async (req, res) => {
    try {
        // أ) المبيعات (الشهر الحالي)
        const startOfMonth = new Date(new Date().getFullYear(), new Date().getMonth(), 1);
        const sales = await SalesInvoice.aggregate([
            { $match: { date: { $gte: startOfMonth } } },
            { $group: { _id: null, total: { $sum: "$finalTotal" }, count: { $sum: 1 } } }
        ]);

        // ب) رصيد النقدية (الخزن والبنوك)
        // نفترض أن أكواد الخزينة تبدأ بـ 110 أو اسمها يحتوي على "خزينة"
        const treasuries = await Account.find({ 
            $or: [{ code: /^110/ }, { name: /خزنة|بنك/ }] 
        }).select('_id');
        
        const treasuryIds = treasuries.map(t => t._id); // نحولها لمصفوفة IDs

        // تجميع الرصيد من القيود
        // ملاحظة: ندعم details و lines
        const cashEntries = await JournalEntry.find({
            $or: [{ 'details.accountId': { $in: treasuryIds } }, { 'lines.accountId': { $in: treasuryIds } }]
        });
        
        // تحسين: استخدام Set للبحث السريع بدلاً من find داخل الـ Loop
        const treasurySet = new Set(treasuryIds.map(id => id.toString()));
        let cashBalance = 0;
        cashEntries.forEach(entry => {
            const lines = entry.details || entry.lines || [];
            lines.forEach(line => {
                if (treasurySet.has(line.accountId.toString())) {
                    cashBalance += (line.debit - line.credit);
                }
            });
        });

        res.json({
            sales: { total: sales[0]?.total || 0, count: sales[0]?.count || 0 },
            cash: cashBalance,
            // يمكنك إضافة المخزون والعملاء هنا بنفس الطريقة
        });

    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message });
    }
});

// 2. تحليل المبيعات والربحية (Sales Analysis)
router.get('/sales-analysis', async (req, res) => {
    try {
        const { from, to } = req.query;
        const start = from ? new Date(from) : new Date('1970-01-01');
        const end = to ? new Date(to) : new Date(); 
        end.setHours(23, 59, 59, 999);

        // جلب الفواتير
        const invoices = await SalesInvoice.find({ date: { $gte: start, $lte: end } })
            
            ;

        // هنا يمكنك وضع المنطق التفصيلي لحساب ربحية كل عميل
        // سأقوم بعمل تجميع بسيط الآن كمثال:
        const report = invoices.map(inv => ({
            date: inv.date,
            invNum: inv.invoiceNumber,
            customer: inv.customer ? inv.customer.name : 'نقدي',
            total: inv.finalTotal,
            itemsCount: inv.items.length
        }));

        res.json(report);

    } catch(err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
