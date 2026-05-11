const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

// الموديلات
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const JournalEntry = require('../models/JournalEntry');
const Account = require('../models/Account');
const SalaryHistory = require('../models/SalaryHistory');

function parseExcelDate(dateVal) {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal === 'number') return new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return new Date(dateVal);
}

// =================================================================
// 1. الموظفين (CRUD)
// =================================================================

router.get('/employees', async (req, res) => {
    try {
        const { activeOnly, technicianOnly } = req.query;
        let emps = await Employee.find();
        if (activeOnly === 'true') {
            emps = emps.filter(e => e.status === 'Active');
        }
        if (technicianOnly === 'true') {
            emps = emps.filter(emp => {
                const title = String(emp.jobTitle || '').toLowerCase();
                const dept = String(emp.department || '').toLowerCase();
                return title.includes('فني') || dept.includes('فني') || title.includes('technician') || dept.includes('technician');
            });
        }
        res.json(emps);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.get('/employees/:id', async (req, res) => {
    const emp = await Employee.findById(req.params.id);
    if (!emp) return res.status(404).json({ message: "غير موجود" });
    res.json(emp);
});

router.post('/employees', authenticateToken, requireAdmin, async (req, res) => {
    try {
        if (req.body.accountCode) {
            const acc = await Account.findOne({ code: req.body.accountCode });
            if (acc) req.body.accountId = acc._id;
        }
        if (req.body._id) {
            const { _id, ...updateData } = req.body;
            await Employee.findByIdAndUpdate(_id, updateData);
            res.json({ message: 'تم التحديث' });
        } else {
            const existing = await Employee.findOne({ code: req.body.code });
            if (existing) return res.status(400).json({ message: 'الكود مكرر' });
            if (!req.body.code) req.body.code = 'EMP-' + Date.now();
            await Employee.create(req.body);
            res.status(201).json({ message: 'تم الحفظ' });
        }
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.delete('/employees/:id', authenticateToken, requireAdmin, async (req, res) => {
    await Employee.findByIdAndDelete(req.params.id);
    res.json({ message: 'تم الحذف' });
});

router.post('/employees/:id/terminate', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { terminationDate, terminationReason, status } = req.body;
        await Employee.findByIdAndUpdate(req.params.id, {
            status: status || 'Terminated',
            terminationDate: terminationDate,
            terminationReason: terminationReason,
            vacationBalance: 0
        });
        res.json({ message: 'تم إنهاء الخدمة بنجاح' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/employees/:id/increment', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const { newBasic, newVariable, reason } = req.body;
        const emp = await Employee.findById(req.params.id);
        if (!emp) return res.status(404).json({ message: "موظف غير موجود" });

        const oldTotal = emp.totalSalary;
        const updatedFields = {
            basicSalary: newBasic || emp.basicSalary,
            variableSalary: newVariable || emp.variableSalary
        };

        updatedFields.totalSalary = (updatedFields.basicSalary || 0) + (updatedFields.variableSalary || 0) + (emp.transportAllowance || 0) + (emp.otherAllowance || 0) + (emp.incentives || 0);
        updatedFields.insuranceSalary = (updatedFields.basicSalary || 0) + (updatedFields.variableSalary || 0);

        await Employee.findByIdAndUpdate(req.params.id, updatedFields);

        if (SalaryHistory) {
            await SalaryHistory.create({
                employee: req.params.id,
                oldTotal: oldTotal,
                newTotal: updatedFields.totalSalary,
                amount: updatedFields.totalSalary - oldTotal,
                reason: reason || 'زيادة'
            });
        }
        res.json({ message: 'تم تطبيق الزيادة وحفظ السجل ✅' });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/employees/sync-all', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const allEmps = await Employee.find({});
        let count = 0;
        for (const emp of allEmps) {
            let updatedFields = {};
            if (!emp.status) updatedFields.status = 'Active';
            if (emp.vacationBalance === undefined) updatedFields.vacationBalance = 21;

            const currentTotal = (emp.basicSalary || 0) + (emp.variableSalary || 0) + (emp.transportAllowance || 0) + (emp.otherAllowance || 0) + (emp.incentives || 0);
            if (emp.totalSalary !== currentTotal) updatedFields.totalSalary = currentTotal;

            if (Object.keys(updatedFields).length > 0) {
                await Employee.findByIdAndUpdate(emp._id, updatedFields);
            }
            count++;
        }
        res.json({ message: `تم تحديث وإنعاش بيانات ${count} موظف بنجاح ✅` });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

// =================================================================
// 2. الرواتب (Payroll)
// =================================================================

router.post('/payroll', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const data = req.body;

        // 1. تنظيف القديم واسترجاع الأرصدة
        const existingList = await Payroll.find({ month: data.month });
        if (existingList.length > 0) {
            for (const existing of existingList) {
                for (const d of (existing.details || [])) {
                    if (d.annualLeaveDays > 0 && d.employee) {
                        const emp = await Employee.findById(d.employee);
                        if (emp) {
                            await Employee.findByIdAndUpdate(d.employee, {
                                vacationBalance: (emp.vacationBalance || 0) + d.annualLeaveDays
                            });
                        }
                    }
                }
            }
            await Payroll.deleteMany({ month: data.month });
        }

        // 2. تعبئة البيانات وأخذ لقطة للرصيد
        for (let detail of data.details) {
            const emp = await Employee.findById(detail.employee);
            if (emp) {
                detail.employeeName = emp.name;
                detail.employeeCode = emp.code;
                detail.department = emp.department || 'عام';
                detail.jobTitle = emp.jobTitle || 'موظف';
                detail.vacationBalance = emp.vacationBalance;
            }
        }

        const payroll = await Payroll.create(data);

        // 3. خصم الإجازات من الموظف الفعلي
        for (const row of data.details) {
            if (row.annualLeaveDays > 0 && row.employee) {
                const emp = await Employee.findById(row.employee);
                if (emp) {
                    await Employee.findByIdAndUpdate(row.employee, {
                        vacationBalance: (emp.vacationBalance || 0) - row.annualLeaveDays
                    });
                }
            }
        }
        res.status(201).json(payroll);
    } catch (err) { res.status(400).json({ message: err.message }); }
});

router.get('/payroll', async (req, res) => {
    try {
        const { month } = req.query;
        let list = await Payroll.find();
        if (month) {
            list = list.filter(p => p.month === month);
        }

        res.json(list);
    } catch (e) { res.status(500).json({ message: e.message }); }
});

router.get('/payroll/export-template', async (req, res) => {
    try {
        const employees = await Employee.find();
        const activeEmps = employees.filter(emp => emp.status === 'Active');
        const data = activeEmps.map(emp => ({
            'الكود': emp.code, 'الاسم': emp.name, 'غياب_أيام': 0, 'جزاءات_أيام': 0, 'تأخير_أيام': 0, 'مرضي_أيام': 0, 'اعتيادي_أيام': 0, 'سلف_شهرية': 0, 'سلف_مستديمة': 0
        }));
        const worksheet = xlsx.utils.json_to_sheet(data);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Variables");
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        res.setHeader('Content-Disposition', 'attachment; filename=payroll_template.xlsx');
        res.send(buffer);
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/payroll/import-variables', authenticateToken, requireAdmin, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "لم يتم رفع ملف" });
        const { month } = req.body;
        if (!month) return res.status(400).json({ message: "يجب تحديد الشهر" });

        let payroll = await Payroll.findOne({ month: month });
        if (!payroll) return res.status(404).json({ message: "يرجى إنشاء مسير الرواتب أولاً" });

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);

        let updateCount = 0;
        for (const row of jsonData) {
            const empCode = row.code || row['الكود'];
            if (!empCode) continue;
            const detailIndex = payroll.details.findIndex(d => String(d.employeeCode) === String(empCode));
            if (detailIndex !== -1) {
                const detail = payroll.details[detailIndex];
                const dayRate = (detail.totalSalary || 0) / 30;
                if (row['غياب_أيام'] !== undefined) { detail.absenceDays = parseFloat(row['غياب_أيام']) || 0; detail.absenceValue = Math.ceil(detail.absenceDays * dayRate); }
                if (row['جزاءات_أيام'] !== undefined) { detail.penaltyDays = parseFloat(row['جزاءات_أيام']) || 0; detail.penaltyValue = Math.ceil(detail.penaltyDays * dayRate); }
                if (row['تأخير_أيام'] !== undefined) { detail.latenessDays = parseFloat(row['تأخير_أيام']) || 0; detail.latenessValue = Math.ceil(detail.latenessDays * dayRate); }
                if (row['مرضي_أيام'] !== undefined) detail.sickLeaveDays = parseFloat(row['مرضي_أيام']) || 0;
                if (row['اعتيادي_أيام'] !== undefined) detail.annualLeaveDays = parseFloat(row['اعتيادي_أيام']) || 0;
                if (row['سلف_شهرية'] !== undefined) detail.monthlyLoan = parseFloat(row['سلف_شهرية']) || 0;
                if (row['سلف_مستديمة'] !== undefined) detail.permanentLoan = parseFloat(row['سلف_مستديمة']) || 0;

                const totalDed = (detail.absenceValue || 0) + (detail.penaltyValue || 0) + (detail.latenessValue || 0) + (detail.monthlyLoan || 0) + (detail.permanentLoan || 0);
                detail.totalDeductions = totalDed;
                detail.netSalary = (detail.totalSalary || 0) - totalDed;
                payroll.details[detailIndex] = detail;
                updateCount++;
            }
        }
        payroll.totalAmount = payroll.details.reduce((sum, d) => sum + (d.netSalary || 0), 0);
        await Payroll.findByIdAndUpdate(payroll._id, payroll);
        res.json({ message: `تم تحديث ${updateCount} موظف من ملف البصمة ✅` });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/payroll/:id/post', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const payroll = await Payroll.findById(req.params.id);
        if (!payroll) return res.status(404).json({ message: "الكشف غير موجود" });

        const { treasuryAccountId, salaryAccountId, monthlyLoanAccountId, permanentLoanAccountId, penaltiesAccountId, selectedEmployeeIds } = req.body;
        if (!treasuryAccountId || !salaryAccountId) return res.status(400).json({ message: "بيانات الحسابات ناقصة" });

        let employeesToPost = [];
        if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
            employeesToPost = payroll.details.filter(d => selectedEmployeeIds.includes(String(d.employee)) && !d.isPosted);
        } else {
            employeesToPost = payroll.details.filter(d => !d.isPosted);
        }

        if (employeesToPost.length === 0) return res.status(400).json({ message: "تم ترحيل هؤلاء الموظفين مسبقاً!" });

        let totalBasic = 0, totalNet = 0, totalPenalties = 0, totalMonthlyLoans = 0, totalPermanentLoans = 0;
        const departmentsSet = new Set();

        employeesToPost.forEach(d => {
            totalBasic += (d.totalSalary || 0);
            totalMonthlyLoans += (d.monthlyLoan || 0);
            totalPermanentLoans += (d.permanentLoan || 0);
            totalPenalties += (d.absenceValue || 0) + (d.penaltyValue || 0) + (d.latenessValue || 0);
            totalNet += (d.netSalary || 0);
            if (d.department) departmentsSet.add(d.department);
            d.isPosted = true;
        });

        const deptString = Array.from(departmentsSet).join('، ');
        const accSalaryInfo = await Account.findById(salaryAccountId);
        const accTreasuryInfo = await Account.findById(treasuryAccountId);
        const accMonthlyInfo = monthlyLoanAccountId ? await Account.findById(monthlyLoanAccountId) : null;
        const accPermInfo = permanentLoanAccountId ? await Account.findById(permanentLoanAccountId) : null;
        const accPenaltiesInfo = penaltiesAccountId ? await Account.findById(penaltiesAccountId) : null;

        let lines = [];
        lines.push({ accountId: salaryAccountId, accountName: accSalaryInfo.name, debit: totalBasic, credit: 0, description: `رواتب شهر ${payroll.month} (${employeesToPost.length} موظف) - ${deptString}` });

        if (totalMonthlyLoans > 0 && accMonthlyInfo) lines.push({ accountId: monthlyLoanAccountId, accountName: accMonthlyInfo.name, debit: 0, credit: totalMonthlyLoans, description: 'خصم سلف شهرية' });
        if (totalPermanentLoans > 0 && accPermInfo) lines.push({ accountId: permanentLoanAccountId, accountName: accPermInfo.name, debit: 0, credit: totalPermanentLoans, description: 'خصم سلف مستديمة' });
        if (totalPenalties > 0 && accPenaltiesInfo) lines.push({ accountId: penaltiesAccountId, accountName: accPenaltiesInfo.name, debit: 0, credit: totalPenalties, description: 'خصم غياب وجزاءات' });
        lines.push({ accountId: treasuryAccountId, accountName: accTreasuryInfo.name, debit: 0, credit: totalNet, description: `صرف صافي الرواتب - شهر ${payroll.month}` });

        const uniqueRef = `PAY-${payroll.month}-${Date.now()}`;
        await JournalEntry.create({
            date: new Date().toISOString(),
            referenceNumber: uniqueRef,
            description: `قيد رواتب شهر ${payroll.month} (${employeesToPost.length} موظف)`,
            details: lines,
            totalDebit: totalBasic, // Simplified for now
            totalCredit: totalBasic,
            status: 'Posted'
        });

        const allPosted = payroll.details.every(d => d.isPosted);
        payroll.status = allPosted ? 'Posted' : 'Partially Posted';
        await Payroll.findByIdAndUpdate(payroll._id, payroll);
        res.json({ message: `تم ترحيل قيد لـ ${employeesToPost.length} موظف بنجاح ✅` });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.delete('/payroll/:id', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const payroll = await Payroll.findById(req.params.id);
        if (!payroll) return res.status(404).json({ message: "غير موجود" });

        // Manual cleanup of journal entries
        const allEntries = await JournalEntry.find();
        const prefix = `PAY-${payroll.month}`;
        for (const entry of allEntries) {
            if (entry.referenceNumber && entry.referenceNumber.startsWith(prefix)) {
                await JournalEntry.findByIdAndDelete(entry._id);
            }
        }

        await Payroll.findByIdAndDelete(req.params.id);
        res.json({ message: "تم الحذف بنجاح" });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

router.post('/employees/reset-vacations', authenticateToken, requireAdmin, async (req, res) => {
    try {
        const result = await Employee.updateMany({ status: 'Active' }, { vacationBalance: 21 });
        res.json({ message: `تم تجديد رصيد الإجازات لـ ${result.modifiedCount} موظف ليصبح 21 يوم ✅` });
    } catch (err) { res.status(500).json({ message: err.message }); }
});

module.exports = router;
