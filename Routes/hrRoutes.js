const express = require('express');
const router = express.Router();
const multer = require('multer');
const xlsx = require('xlsx');

// Database using file_db_manager
const FileDatabaseManager = require('../file_db_manager');
const db = new FileDatabaseManager();

// Auth Middlewares
const { authenticateToken } = require('../middleware/auth');

// Role Authorization Middleware
const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Unauthorized' });
        }
        
        const userRole = req.user.role || 'user';
        
        if (userRole === 'admin' || allowedRoles.includes(userRole)) {
            return next();
        }
        
        return res.status(403).json({ message: 'Access denied: Insufficient permissions' });
    };
};

const mutationAuth = [authenticateToken, authorizeRoles('admin', 'hr_manager')];

// Multer setup for Excel imports using memory storage
const upload = multer({ storage: multer.memoryStorage() });

// ==========================================
// 1. Core Functionality (Employees Management)
// ==========================================

// GET /api/hr/employees
router.get('/employees', async (req, res) => {
    try {
        const { activeOnly, technicianOnly } = req.query;
        let employees = await db.find('employees') || [];

        if (activeOnly === 'true') {
            employees = employees.filter(emp => emp.status === 'Active');
        }

        if (technicianOnly === 'true') {
            employees = employees.filter(emp => emp.isTechnician === true);
        }

        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving employees', error: error.message });
    }
});

// GET /api/hr/employees/:id
router.get('/employees/:id', async (req, res) => {
    try {
        const employee = await db.findOne('employees', { _id: req.params.id });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json(employee);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving employee', error: error.message });
    }
});

// POST /api/hr/employees (Unified Create/Update)
router.post('/employees', mutationAuth, async (req, res) => {
    try {
        const data = req.body;
        let employee;

        if (data._id) {
            const { _id, ...updateData } = data;
            employee = await db.updateOne('employees', { _id: _id }, updateData);
            if (!employee) {
                return res.status(404).json({ message: 'Employee not found for update' });
            }
        } else {
            if (!data.status) data.status = 'Active';
            if (!data.code) data.code = 'EMP-' + Date.now();
            employee = await db.create('employees', data);
        }

        res.status(200).json(employee);
    } catch (error) {
        res.status(500).json({ message: 'Error saving employee', error: error.message });
    }
});

// DELETE /api/hr/employees/:id
router.delete('/employees/:id', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const result = await db.deleteOne('employees', { _id: req.params.id });
        if (!result) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json({ message: 'Employee deleted successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Error deleting employee', error: error.message });
    }
});

// ========== NEW: Batch Delete ==========
router.post('/employees/batch-delete', authenticateToken, authorizeRoles('admin'), async (req, res) => {
    try {
        const { ids } = req.body;
        
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة بالمعرفات (ids) للحذف' });
        }
        
        let deletedCount = 0;
        for (const id of ids) {
            const result = await db.deleteOne('employees', { _id: id });
            if (result) deletedCount++;
        }
        
        res.json({ 
            message: `تم حذف ${deletedCount} موظف بنجاح`,
            deletedCount,
            totalRequested: ids.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error batch deleting employees', error: error.message });
    }
});

// ========== NEW: Quick Status Change ==========
router.patch('/employees/:id/status', mutationAuth, async (req, res) => {
    try {
        const { status, terminationDate, terminationReason } = req.body;
        
        const validStatuses = ['Active', 'Resigned', 'Terminated'];
        if (!validStatuses.includes(status)) {
            return res.status(400).json({ message: 'حالة غير صالحة. القيم المسموحة: Active, Resigned, Terminated' });
        }
        
        const updateData = { status };
        
        if (status === 'Terminated') {
            updateData.terminationDate = terminationDate || new Date().toISOString();
            updateData.terminationReason = terminationReason || 'Not specified';
        } else if (status === 'Resigned') {
            updateData.terminationDate = terminationDate || new Date().toISOString();
            updateData.terminationReason = terminationReason || 'Resignation';
        } else if (status === 'Active') {
            updateData.terminationDate = null;
            updateData.terminationReason = null;
        }
        
        const employee = await db.updateOne('employees', { _id: req.params.id }, updateData);
        
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        
        res.json({ message: `تم تغيير الحالة إلى ${status}`, employee });
    } catch (error) {
        res.status(500).json({ message: 'Error updating employee status', error: error.message });
    }
});

// POST /api/hr/employees/reset-vacations
router.post('/employees/reset-vacations', mutationAuth, async (req, res) => {
    try {
        const employees = await db.find('employees') || [];
        let modifiedCount = 0;
        for (const emp of employees) {
            if (emp.status === 'Active') {
                await db.updateOne('employees', { _id: emp._id }, { vacationBalance: 21 });
                modifiedCount++;
            }
        }
        res.json({ 
            message: 'Vacations reset to 21 successfully for Active employees',
            modifiedCount: modifiedCount
        });
    } catch (error) {
        res.status(500).json({ message: 'Error resetting vacations', error: error.message });
    }
});

// POST /api/hr/employees/:id/terminate
router.post('/employees/:id/terminate', mutationAuth, async (req, res) => {
    try {
        const { reason, terminationDate } = req.body;
        
        const employee = await db.updateOne('employees', { _id: req.params.id }, {
            status: 'Terminated',
            terminationDate: terminationDate || new Date().toISOString(),
            terminationReason: reason || 'Not specified'
        });

        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        res.json({ message: 'Employee terminated successfully', employee });
    } catch (error) {
        res.status(500).json({ message: 'Error terminating employee', error: error.message });
    }
});

// POST /api/hr/employees/:id/increment
router.post('/employees/:id/increment', mutationAuth, async (req, res) => {
    try {
        const { basicSalary, variableSalary, reason, date } = req.body;
        
        const employee = await db.findOne('employees', { _id: req.params.id });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const newHistoryEntry = {
            date: date || new Date().toISOString(),
            previousBasicSalary: employee.basicSalary || 0,
            previousVariableSalary: employee.variableSalary || 0,
            newBasicSalary: basicSalary,
            newVariableSalary: variableSalary,
            reason: reason || 'Salary Increment'
        };

        const salaryHistory = employee.salaryHistory || [];
        salaryHistory.push(newHistoryEntry);

        const updatedEmployee = await db.updateOne('employees', { _id: req.params.id }, {
            basicSalary: basicSalary,
            variableSalary: variableSalary,
            salaryHistory: salaryHistory
        });

        res.json({ message: 'Salary incremented successfully', employee: updatedEmployee });
    } catch (error) {
        res.status(500).json({ message: 'Error incrementing salary', error: error.message });
    }
});

// POST /api/hr/employees/sync-all
router.post('/employees/sync-all', mutationAuth, async (req, res) => {
    try {
        const employees = await db.find('employees') || [];
        let syncedCount = 0;
        
        for (const emp of employees) {
            const basic = Number(emp.basicSalary || 0);
            const variable = Number(emp.variableSalary || 0);
            const trans = Number(emp.transportAllowance || 0);
            const other = Number(emp.otherAllowance || 0);
            const incen = Number(emp.incentives || 0);
            
            const newTotal = basic + variable + trans + other + incen;
            
            if (emp.totalSalary !== newTotal) {
                await db.updateOne('employees', { _id: emp._id }, { totalSalary: newTotal });
                syncedCount++;
            }
        }
        
        res.json({ message: `تم إنعاش بيانات الموظفين بنجاح. تم تحديث ${syncedCount} موظف.` });
    } catch (error) {
        res.status(500).json({ message: 'Error syncing employees', error: error.message });
    }
});

// ========== NEW: Import Confirm (replaces direct import) ==========
router.post('/employees/import-confirm', mutationAuth, async (req, res) => {
    try {
        const { employees: employeesToImport } = req.body;
        
        if (!employeesToImport || !Array.isArray(employeesToImport) || employeesToImport.length === 0) {
            return res.status(400).json({ message: 'لا توجد بيانات صالحة للاستيراد' });
        }
        
        let createdCount = 0;
        let updatedCount = 0;
        
        for (const empData of employeesToImport) {
            // Check if employee exists by code
            const existing = await db.findOne('employees', { code: empData.code });
            
            const employeeObj = {
                code: empData.code || `EMP-${Date.now()}-${Math.floor(Math.random() * 1000)}`,
                name: empData.name || 'بدون اسم',
                department: empData.department || '',
                jobTitle: empData.jobTitle || '',
                basicSalary: Number(empData.basicSalary) || 0,
                variableSalary: Number(empData.variableSalary) || 0,
                transportAllowance: Number(empData.transportAllowance) || 0,
                otherAllowance: Number(empData.otherAllowance) || 0,
                incentives: Number(empData.incentives) || 0,
                hireDate: empData.hireDate ? new Date(empData.hireDate).toISOString() : new Date().toISOString(),
                status: empData.status || 'Active',
                vacationBalance: 21
            };
            
            // Calculate total salary
            employeeObj.totalSalary = employeeObj.basicSalary + employeeObj.variableSalary + 
                                      employeeObj.transportAllowance + employeeObj.otherAllowance + 
                                      employeeObj.incentives;
            
            if (existing) {
                // Update existing
                await db.updateOne('employees', { _id: existing._id }, employeeObj);
                updatedCount++;
            } else {
                // Create new
                await db.create('employees', employeeObj);
                createdCount++;
            }
        }
        
        res.json({ 
            message: `تم استيراد ${createdCount} موظف جديد وتحديث ${updatedCount} موظف`,
            createdCount,
            updatedCount,
            total: employeesToImport.length
        });
    } catch (error) {
        res.status(500).json({ message: 'Error importing employees', error: error.message });
    }
});

// Legacy import endpoint (kept for compatibility, but preview is recommended)
router.post('/employees/import', mutationAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'لم يتم إرفاق أي ملف' });
        }
        
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        let importedCount = 0;
        for (const row of jsonData) {
            const empData = {
                code: row.code || row.Code || row['كود الموظف'] || `EMP-${Date.now()}-${Math.floor(Math.random()*1000)}`,
                name: row.name || row.Name || row['اسم الموظف'] || row.employeeName || 'بدون اسم',
                department: row.department || row.Department || row['القسم'] || '',
                jobTitle: row.jobTitle || row.JobTitle || row['المسمى الوظيفي'] || '',
                basicSalary: Number(row.basicSalary || row.BasicSalary || row['الراتب الأساسي']) || 0,
                variableSalary: Number(row.variableSalary || row.VariableSalary || row['الراتب المتغير']) || 0,
                transportAllowance: Number(row.transportAllowance || row.TransportAllowance || row['بدل انتقال']) || 0,
                otherAllowance: Number(row.otherAllowance || row.OtherAllowance || row['بدلات أخرى']) || 0,
                incentives: Number(row.incentives || row.Incentives || row['حوافز']) || 0,
                status: row.status || row.Status || row['الحالة'] || 'Active',
                hireDate: row.hireDate ? new Date(row.hireDate).toISOString() : new Date().toISOString()
            };
            
            empData.totalSalary = empData.basicSalary + empData.variableSalary + 
                                  empData.transportAllowance + empData.otherAllowance + 
                                  empData.incentives;
            
            const existing = await db.findOne('employees', { code: empData.code });
            if (existing) {
                await db.updateOne('employees', { _id: existing._id }, empData);
            } else {
                await db.create('employees', empData);
            }
            importedCount++;
        }
        
        res.json({ message: `تم استيراد ${importedCount} موظف بنجاح`, importedCount });
    } catch (error) {
        res.status(500).json({ message: 'Error importing employees', error: error.message });
    }
});

// ========== NEW: Technician Performance Report ==========
router.get('/technicians/performance', authenticateToken, async (req, res) => {
    try {
        const { from, to, technicianId } = req.query;
        
        // 1. Get all technicians (or specific one)
        let technicians = await db.find('employees', { 
            jobTitle: 'فني', 
            status: 'Active' 
        });
        
        if (technicianId) {
            technicians = technicians.filter(t => t._id === technicianId);
        }
        
        // 2. Get service jobs linked to technicians
        let serviceJobs = await db.find('servicejobs') || [];
        
        // Apply date filter if provided
        if (from && to) {
            const fromDate = new Date(from);
            const toDate = new Date(to);
            toDate.setHours(23, 59, 59);
            serviceJobs = serviceJobs.filter(job => {
                const jobDate = new Date(job.completionDate || job.createdAt);
                return jobDate >= fromDate && jobDate <= toDate;
            });
        }
        
        // 3. Calculate performance metrics per technician based on assigned items
        const performance = technicians.map(tech => {
            // Collect all items assigned to this technician across all jobs
            const techItems = [];
            serviceJobs.forEach(job => {
                if (job.items && Array.isArray(job.items)) {
                    job.items.forEach(item => {
                        if (item.assignedTechnicianId === tech._id || 
                            (item.technicianName && item.technicianName === tech.name)) {
                            techItems.push({
                                ...item,
                                jobId: job._id,
                                jobOrder: job.jobOrder || job.orderNumber,
                                carType: job.carName || job.carModel || '-',
                                invoiceNumber: job.salesInvoiceId || job.jobOrder || '-',
                                jobDate: job.completionDate || job.createdAt
                            });
                        }
                    });
                }
            });
            
            // Calculate metrics from items
            const totalArea = techItems.reduce((sum, item) => sum + (item.area || 0), 0);
            const totalJobs = new Set(techItems.map(item => item.jobId)).size; // Unique jobs
            const totalRatings = techItems.reduce((sum, item) => sum + (item.rating || 0), 0);
            const avgRating = techItems.length > 0 ? (totalRatings / techItems.length).toFixed(1) : 0;
            
            // Count parts/packages and materials
            const partsCount = techItems.filter(item => item.partName && item.partName.trim() !== '').length;
            const materialsCount = techItems.filter(item => item.materialCategory && item.materialCategory.trim() !== '').length;
            
            const totalProfit = techItems.reduce((sum, item) => sum + (item.profit || 0), 0);
            const productivity = totalJobs > 0 ? (totalArea / totalJobs).toFixed(2) : 0;
            
            return {
                technician: {
                    _id: tech._id,
                    code: tech.code,
                    name: tech.name,
                    jobTitle: tech.jobTitle,
                    department: tech.department
                },
                jobCount: totalJobs,
                totalArea: totalArea.toFixed(2),
                avgRating: avgRating,
                partsCount: partsCount,
                materialsCount: materialsCount,
                totalProfit: totalProfit.toFixed(2),
                productivity: parseFloat(productivity),
                items: techItems.map(item => ({
                    jobId: item.jobId,
                    jobOrder: item.jobOrder,
                    carType: item.carType,
                    invoiceNumber: item.invoiceNumber,
                    partName: item.partName || '-',
                    materialCategory: item.materialCategory || '-',
                    area: item.area || 0,
                    rating: item.rating || 0,
                    profit: item.profit || 0,
                    date: item.jobDate
                }))
            };
        });
        
        // Calculate summary totals
        const summary = {
            totalTechnicians: performance.length,
            totalJobs: performance.reduce((sum, t) => sum + t.jobCount, 0),
            totalArea: performance.reduce((sum, t) => sum + parseFloat(t.totalArea), 0).toFixed(2),
            avgOverallRating: (performance.reduce((sum, t) => sum + parseFloat(t.avgRating), 0) / (performance.length || 1)).toFixed(1),
            totalParts: performance.reduce((sum, t) => sum + t.partsCount, 0),
            totalMaterials: performance.reduce((sum, t) => sum + t.materialsCount, 0),
            totalProfit: performance.reduce((sum, t) => sum + parseFloat(t.totalProfit), 0).toFixed(2)
        };
        
        res.json({ performance, summary });
    } catch (error) {
        res.status(500).json({ message: 'Error fetching technician performance', error: error.message });
    }
});

// POST /api/hr/technicians/batch-add
router.post('/technicians/batch-add', mutationAuth, async (req, res) => {
    try {
        const { employeeIds } = req.body;

        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة بمعرفات الموظفين' });
        }

        let addedCount = 0;
        for (const id of employeeIds) {
            const employee = await db.findOne('employees', { _id: id });
            if (employee && !employee.isTechnician) {
                await db.updateOne('employees', { _id: id }, { isTechnician: true });
                addedCount++;
            }
        }

        res.json({
            message: `تم إضافة ${addedCount} موظف كفنيين بنجاح`,
            addedCount,
            totalRequested: employeeIds.length
        });
    } catch (error) {
        console.error('Batch add technicians error:', error);
        res.status(500).json({ message: 'Error adding technicians', error: error.message });
    }
});

// POST /api/hr/technicians/batch-remove
router.post('/technicians/batch-remove', mutationAuth, async (req, res) => {
    try {
        const { ids } = req.body;

        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة بمعرفات الفنيين' });
        }

        let removedCount = 0;
        for (const id of ids) {
            const employee = await db.findOne('employees', { _id: id });
            if (employee && employee.isTechnician) {
                await db.updateOne('employees', { _id: id }, { isTechnician: false });
                removedCount++;
            }
        }

        res.json({
            message: `تم حذف ${removedCount} فني من قائمة الفنيين بنجاح`,
            removedCount,
            totalRequested: ids.length
        });
    } catch (error) {
        console.error('Batch remove technicians error:', error);
        res.status(500).json({ message: 'Error removing technicians', error: error.message });
    }
});

// ==========================================
// 2. Payroll & GL Integration
// ==========================================

// GET /api/hr/payroll
router.get('/payroll', async (req, res) => {
    try {
        const { month } = req.query;
        let payrolls = await db.find('payrolls') || [];
        
        if (month) {
            payrolls = payrolls.filter(p => p.month === month);
        }

        res.json(payrolls);
    } catch (error) {
        res.status(500).json({ message: 'Error retrieving payroll records', error: error.message });
    }
});

// POST /api/hr/payroll
router.post('/payroll', mutationAuth, async (req, res) => {
    try {
        const data = req.body;
        let payroll;

        if (data._id) {
            const { _id, ...updateData } = data;
            payroll = await db.updateOne('payrolls', { _id }, updateData);
            if (!payroll) {
                return res.status(404).json({ message: 'Payroll draft not found for update' });
            }
        } else {
            data.status = data.status || 'Draft';
            payroll = await db.create('payrolls', data);
        }

        res.status(200).json(payroll);
    } catch (error) {
        res.status(500).json({ message: 'Error saving payroll draft', error: error.message });
    }
});

// POST /api/hr/payroll/:id/post
router.post('/payroll/:id/post', mutationAuth, async (req, res) => {
    try {
        const { 
            salaryExpenseAccountId, 
            treasuryBankAccountId, 
            loansAccountId, 
            penaltiesAccountId,
            selectedEmployeeIds
        } = req.body;

        const settingsArray = await db.find('financial_settings') || [];
        const settings = settingsArray[0] || {};

        const expenseAcc = salaryExpenseAccountId || req.body['Salary Exp'] || settings.defaultSalariesExpenseAccountId;
        const treasuryAcc = treasuryBankAccountId || req.body['Treasury/Bank'] || settings.defaultTreasuryAccountId;
        const loansAcc = loansAccountId || req.body['Loans'] || settings.defaultAdvancesAccountId;
        const penaltiesAcc = penaltiesAccountId || req.body['Penalties'] || settings.defaultDiscountAccountId;

        if (!expenseAcc || !treasuryAcc) {
            return res.status(400).json({ message: 'يجب ضبط الحسابات المالية (حساب الرواتب وحساب الخزينة) في إعدادات النظام قبل الترحيل.' });
        }

        const payroll = await db.findOne('payrolls', { _id: req.params.id });
        if (!payroll) {
            return res.status(404).json({ message: 'Payroll record not found.' });
        }

        if (payroll.status === 'Posted' && !selectedEmployeeIds) {
            return res.status(400).json({ message: 'تم ترحيل مسير الرواتب هذا مسبقاً بالكامل.' });
        }

        let details = payroll.details || [];
        
        if (selectedEmployeeIds && selectedEmployeeIds.length > 0) {
            details = details.filter(d => selectedEmployeeIds.includes(d.employee) && !d.isPosted);
            if (details.length === 0) {
                return res.status(400).json({ message: 'لم يتم تحديد أي موظفين غير مرحلين.' });
            }
        } else {
            details = details.filter(d => !d.isPosted);
            if (details.length === 0) {
                return res.status(400).json({ message: 'جميع الموظفين في هذا المسير تم ترحيلهم مسبقاً.' });
            }
        }
        
        let totalGross = 0;
        let totalNet = 0;
        let totalLoans = 0;
        let totalPenalties = 0;

        details.forEach(line => {
            const basic = parseFloat(line.basicSalary || line.basic || 0);
            const variable = parseFloat(line.variableSalary || line.variable || 0);
            const penalties = parseFloat(line.penalties || line.penaltyValue || 0);
            const loans = parseFloat(line.loans || line.monthlyLoan || 0) + parseFloat(line.permanentLoan || 0);
            const net = parseFloat(line.netSalary || line.net || 0);
            
            const gross = parseFloat(line.grossSalary || line.totalSalary || (basic + variable));

            totalGross += gross;
            totalPenalties += penalties;
            totalLoans += loans;
            totalNet += net;
        });

        const journalDetails = [
            {
                accountId: expenseAcc,
                accountName: 'مصروف الرواتب',
                debit: totalGross,
                credit: 0,
                description: `إجمالي رواتب شهر ${payroll.month}`
            },
            {
                accountId: treasuryAcc,
                accountName: 'الخزينة / البنك',
                debit: 0,
                credit: totalNet,
                description: `صرف رواتب شهر ${payroll.month}`
            }
        ];

        if (totalLoans > 0 && loansAcc) {
            journalDetails.push({
                accountId: loansAcc,
                accountName: 'سلف وعهد',
                debit: 0,
                credit: totalLoans,
                description: `خصم سلف شهر ${payroll.month}`
            });
        }

        if (totalPenalties > 0 && penaltiesAcc) {
            journalDetails.push({
                accountId: penaltiesAcc,
                accountName: 'جزاءات / إيرادات أخرى',
                debit: 0,
                credit: totalPenalties,
                description: `خصم جزاءات شهر ${payroll.month}`
            });
        }

        const totalDebit = journalDetails.reduce((sum, d) => sum + d.debit, 0);
        const totalCredit = journalDetails.reduce((sum, d) => sum + d.credit, 0);
        
        if (Math.abs(totalDebit - totalCredit) > 0.01) {
            const diff = totalDebit - totalCredit;
            const treasuryLine = journalDetails.find(d => d.credit > 0);
            if (treasuryLine) {
                 treasuryLine.credit += diff;
            } else {
                 return res.status(400).json({ 
                     message: 'Calculated journal entry is unbalanced.',
                     debit: totalDebit,
                     credit: totalCredit
                 });
            }
        }

        const finalTotalDebit = journalDetails.reduce((sum, d) => sum + d.debit, 0);
        const finalTotalCredit = journalDetails.reduce((sum, d) => sum + d.credit, 0);

        const entryData = {
            referenceNumber: `PR-${payroll.month}-${Date.now()}`,
            date: new Date().toISOString(),
            description: `قيد رواتب شهر ${payroll.month}${selectedEmployeeIds ? ' (ترحيل جزئي)' : ''}`,
            source: 'Payroll',
            details: journalDetails,
            totalDebit: finalTotalDebit,
            totalCredit: finalTotalCredit,
            status: 'Posted'
        };

        const newEntry = await db.create('journalentries', entryData);

        payroll.details.forEach(d => {
            if (details.some(processed => processed.employee === d.employee)) {
                d.isPosted = true;
            }
        });

        const allPosted = payroll.details.every(d => d.isPosted);
        if (allPosted) {
            payroll.status = 'Posted';
        }

        await db.updateOne('payrolls', { _id: req.params.id }, payroll);

        res.status(200).json({ 
            message: 'تم ترحيل الرواتب وتوليد القيد المحاسبي بنجاح.', 
            payroll,
            journalEntry: newEntry
        });

    } catch (error) {
        res.status(500).json({ message: 'Error posting payroll', error: error.message });
    }
});

// Payroll import variables (enhanced)
router.post('/payroll/import-variables', mutationAuth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'لم يتم إرفاق أي ملف' });
        }
        
        const { month } = req.body;
        if (!month) {
            return res.status(400).json({ message: 'يجب تحديد الشهر' });
        }
        
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName]);
        
        // Get existing payroll for this month
        let payrolls = await db.find('payrolls') || [];
        let payroll = payrolls.find(p => p.month === month);
        
        if (!payroll) {
            return res.status(404).json({ message: 'لا توجد مسيرة رواتب لهذا الشهر. قم بإنشائها أولاً.' });
        }
        
        // Update variables from Excel
        let updatedCount = 0;
        for (const row of jsonData) {
            const employeeCode = row.code || row.Code || row['كود الموظف'];
            const absenceDays = Number(row.absenceDays || row.AbsenceDays || row['غياب']) || 0;
            const penaltyDays = Number(row.penaltyDays || row.PenaltyDays || row['جزاءات']) || 0;
            const latenessDays = Number(row.latenessDays || row.LatenessDays || row['تأخيرات']) || 0;
            const monthlyLoan = Number(row.monthlyLoan || row.MonthlyLoan || row['سلفة شهرية']) || 0;
            const permanentLoan = Number(row.permanentLoan || row.PermanentLoan || row['سلفة مستديمة']) || 0;
            
            if (employeeCode) {
                const detail = payroll.details.find(d => d.employeeCode === employeeCode);
                if (detail) {
                    detail.absenceDays = absenceDays;
                    detail.penaltyDays = penaltyDays;
                    detail.latenessDays = latenessDays;
                    detail.monthlyLoan = monthlyLoan;
                    detail.permanentLoan = permanentLoan;
                    updatedCount++;
                }
            }
        }
        
        // Recalculate totals
        payroll.totalAmount = payroll.details.reduce((sum, d) => sum + (d.netSalary || 0), 0);
        await db.updateOne('payrolls', { _id: payroll._id }, payroll);
        
        res.json({ 
            message: `تم استيراد المتغيرات بنجاح. تم تحديث ${updatedCount} موظف.`,
            updatedCount 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error importing payroll variables', error: error.message });
    }
});

router.get('/payroll/export-template', (req, res) => {
    // Create template Excel file
    const template = [
        { 'code': 'EMP001', 'absenceDays': 0, 'penaltyDays': 0, 'latenessDays': 0, 'monthlyLoan': 0, 'permanentLoan': 0 },
        { 'code': 'EMP002', 'absenceDays': 0, 'penaltyDays': 0, 'latenessDays': 0, 'monthlyLoan': 0, 'permanentLoan': 0 }
    ];
    
    const ws = xlsx.utils.json_to_sheet(template);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, 'Variables');
    
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    
    res.setHeader('Content-Disposition', 'attachment; filename="payroll_template.xlsx"');
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});



// ========== NEW: Technician Management ==========
router.post('/technicians/batch-add', authenticateToken, authorizeRoles('admin', 'hr_manager'), async (req, res) => {
    try {
        const { employeeIds } = req.body;
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة بمعرفات الموظفين' });
        }

        let updatedCount = 0;
        for (const id of employeeIds) {
            const result = await db.updateOne('employees', { _id: id }, { isTechnician: true });
            if (result) updatedCount++;
        }

        res.json({ 
            message: `تم تحويل ${updatedCount} موظف إلى فني بنجاح`,
            updatedCount 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error batch adding technicians', error: error.message });
    }
});

router.post('/technicians/batch-remove', authenticateToken, authorizeRoles('admin', 'hr_manager'), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة بمعرفات الفنيين' });
        }

        let updatedCount = 0;
        for (const id of ids) {
            const result = await db.updateOne('employees', { _id: id }, { isTechnician: false });
            if (result) updatedCount++;
        }

        res.json({ 
            message: `تم إلغاء صفة الفني من ${updatedCount} موظف`,
            updatedCount 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error batch removing technicians', error: error.message });
    }
});

router.post('/employees/:id/set-technician', authenticateToken, authorizeRoles('admin', 'hr_manager'), async (req, res) => {
    try {
        const employee = await db.updateOne('employees', { _id: req.params.id }, { isTechnician: true });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json({ message: 'تم تحويل الموظف إلى فني بنجاح', employee });
    } catch (error) {
        res.status(500).json({ message: 'Error setting technician', error: error.message });
    }
});

router.post('/employees/:id/unset-technician', authenticateToken, authorizeRoles('admin', 'hr_manager'), async (req, res) => {
    try {
        const employee = await db.updateOne('employees', { _id: req.params.id }, { isTechnician: false });
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }
        res.json({ message: 'تم إلغاء صفة الفني من الموظف', employee });
    } catch (error) {
        res.status(500).json({ message: 'Error unsetting technician', error: error.message });
    }
});
// ========== Technician Management ==========
router.post('/technicians/batch-add', authenticateToken, authorizeRoles('admin', 'hr_manager'), async (req, res) => {
    try {
        const { employeeIds } = req.body;
        if (!employeeIds || !Array.isArray(employeeIds) || employeeIds.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة بمعرفات الموظفين' });
        }
        
        let updatedCount = 0;
        for (const id of employeeIds) {
            const result = await db.updateOne('employees', { _id: id }, { isTechnician: true });
            if (result) updatedCount++;
        }
        
        res.json({ 
            message: `تم تحويل ${updatedCount} موظف إلى فني بنجاح`,
            updatedCount 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error batch adding technicians', error: error.message });
    }
});

router.post('/technicians/batch-remove', authenticateToken, authorizeRoles('admin', 'hr_manager'), async (req, res) => {
    try {
        const { ids } = req.body;
        if (!ids || !Array.isArray(ids) || ids.length === 0) {
            return res.status(400).json({ message: 'يجب إرسال قائمة بمعرفات الفنيين' });
        }
        
        let updatedCount = 0;
        for (const id of ids) {
            const result = await db.updateOne('employees', { _id: id }, { isTechnician: false });
            if (result) updatedCount++;
        }
        
        res.json({ 
            message: `تم إلغاء صفة الفني من ${updatedCount} موظف`,
            updatedCount 
        });
    } catch (error) {
        res.status(500).json({ message: 'Error batch removing technicians', error: error.message });
    }
});

module.exports = router;