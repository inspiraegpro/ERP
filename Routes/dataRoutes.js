const express = require('express');
const router = express.Router();
// mongoose removed - using local database
const xlsx = require('xlsx');
const multer = require('multer');

const upload = multer({ storage: multer.memoryStorage() });

// Models
const Product = require('../models/Product');
const Supplier = require('../models/Supplier');
const Customer = require('../models/Customer');
const PurchaseInvoice = require('../models/PurchaseInvoice');
const SalesInvoice = require('../models/SalesInvoice');
const Account = require('../models/Account');
const StockTransaction = require('../models/StockTransaction');
const Car = require('../models/Car'); 
const Employee = require('../models/Employee');
const Payroll = require('../models/Payroll');
const TreasuryTransaction = require('../models/TreasuryTransaction');
const JournalEntry = require('../models/JournalEntry');
let ImportShipment; try { ImportShipment = require('../models/ImportShipment'); } catch(e){}

// Services
const inventoryService = require('../services/inventoryService');
const salesService = require('../services/salesService');
const purchaseService = require('../services/purchaseService');
const treasuryService = require('../services/treasuryService');

function getModel(type) {
    const models = {
        'products': Product, 'customers': Customer, 'suppliers': Supplier, 'accounts': Account,
        'purchase_invoices': PurchaseInvoice, 'general_purchases': PurchaseInvoice, 'sales_invoices': SalesInvoice,
        'stock_transactions': StockTransaction, 'cars': Car, 'employees': Employee,
        'payroll': Payroll, 'treasury': TreasuryTransaction, 'journal': JournalEntry
    };
    return models[type];
}

function parseNumber(val) {
    if (val === undefined || val === null || val === '') return 0;
    if (typeof val === 'number') return val;
    if (typeof val === 'string') {
        const clean = val.replace(/,/g, '').replace(/\s/g, '');
        return parseFloat(clean) || 0;
    }
    return 0;
}

function parseExcelDate(dateVal) {
    if (!dateVal) return null;
    if (dateVal instanceof Date) return dateVal;
    if (typeof dateVal === 'string') return new Date(dateVal);
    if (typeof dateVal === 'number') return new Date(Math.round((dateVal - 25569) * 86400 * 1000));
    return new Date(dateVal);
}

// ==========================================================
// 1. Export
// ==========================================================
router.get('/export/:type', async (req, res) => {
    try {
        const type = req.params.type.trim().toLowerCase();
        console.log(`📂 Export Request for: [${type}]`);
        
        const { from, to } = req.query;
        
        // Handle Import Shipments Template explicitly
        if (type === 'import_shipments') {
            if (req.query.template === 'true') {
                const data = [
                    {
                        shipmentRef: 'SH-2026-001',
                        supplierName: 'Foreign Supplier Ltd',
                        date: new Date().toLocaleDateString('en-CA'),
                        productName: 'PPF Roll Clear',
                        length: 1500, // CM
                        width: 152, // CM
                        quantity: 100,
                        foreignPrice: 50, // Price in Foreign Currency
                        currency: 'USD',
                        exchangeRate: 50,
                        extraCosts: 1000, // Local Currency (Customs, etc.)
                        DebitAccountCode: '110301', // NEW: Custom Debit Account (Inventory/Expense)
                        CreditAccountCode: '210101', // NEW: Custom Credit Account (Supplier/Liability)
                        notes: 'First Shipment'
                    }
                ];
                const ws = xlsx.utils.json_to_sheet(data);
                const wb = xlsx.utils.book_new();
                xlsx.utils.book_append_sheet(wb, ws, "Data");
                const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
                res.setHeader('Content-Disposition', `attachment; filename=${type}.xlsx`);
                return res.send(buffer);
            }
        }

        const Model = getModel(type);
        if (!Model) return res.status(400).json({ message: "Unknown type" });

        let query = {};
        if (from && to && ['sales_invoices','purchase_invoices','general_purchases','stock_transactions','treasury','journal'].includes(type)) {
            const start = new Date(from); const end = new Date(to); end.setHours(23, 59, 59);
            const dateField = type === 'journal' ? 'date' : 'date';
            query = { [dateField]: { $gte: start, $lte: end } };
        }

        let data = [];
        
        // 1. Fetch Data
        if(['customers', 'suppliers', 'employees'].includes(type)) {
            data = await Model.find(query);
        } else if (type === 'products') {
            data = await Model.find(query)
                
                
                
                ;
        } else if (['sales_invoices'].includes(type)) {
             data = await Model.find(query)
                
                
                
                ;
        } else if (['purchase_invoices'].includes(type)) {
             data = await Model.find(query)
                
                
                ;
        } else if (type === 'stock_transactions') {
            data = await Model.find(query);
        } else if (type === 'treasury') {
             data = await Model.find(query);
        } else {
             data = await Model.find(query);
        }

        let formattedData = [];

        // 2. Format Data
        if (type === 'sales_invoices') {
            if (req.query.template === 'true') {
                 formattedData.push({
                     invoiceNumber: 'INV-1001',
                     customerName: 'اسم العميل',
                     CustomerAccountCode: '110201', // NEW
                     car: 'Toyota Corolla 2024',
                     serviceType: 'تغليف كامل',
                     date: new Date().toLocaleDateString('en-CA'),
                     partName: 'كابوت (القطعة)',
                     material: 'PPF (الخامة)',
                     itemType: 'سلعة', 
                     RevenueAccountCode: '4101', // NEW: Override Revenue Account
                     length: 100,
                     width: 150,
                     area: 1.5,
                     unitPrice: 500,
                     extraServices: 100,
                     discount: 50,
                     vat: 14, 
                     wht: 0,
                     netTotal: 0, 
                     notes: 'ملاحظات'
                 });
            } else {
                 for (const inv of data) {
                     const common = {
                         invoiceNumber: inv.invoiceNumber,
                         customerName: inv.customer?.name || '',
                         car: inv.carModel ? `${inv.carModel.brand} ${inv.carModel.model}` : '',
                         serviceType: inv.serviceType || '',
                         date: new Date(inv.date).toLocaleDateString('en-CA'),
                         extraServices: inv.totalExtraCosts || 0,
                         discount: inv.totalDiscount || 0,
                         vat: inv.totalTax || 0,
                         wht: inv.whtAmount || 0,
                         netTotal: inv.finalTotal || 0,
                         notes: inv.notes || ''
                     };

                     if (inv.items && inv.items.length > 0) {
                         for (const item of inv.items) {
                             formattedData.push({
                                 ...common,
                                 partName: item.partName || '',
                                 material: item.product?.name || '',
                                 itemType: item.product?.type === 'Service' ? 'خدمة' : 'سلعة',
                                 length: item.lengthCM || 0,
                                 width: item.widthCM || 0,
                                 area: item.area || 0,
                                 unitPrice: item.price || 0
                             });
                         }
                     } else {
                         formattedData.push(common);
                     }
                 }
            }
        }
        else if (type === 'purchase_invoices') {
              if (req.query.template === 'true') {
                   formattedData.push({
                       invoiceNumber: 'PUR-1001',
                       supplierName: 'اسم المورد',
                       SupplierAccountCode: '210101', // NEW
                       date: new Date().toLocaleDateString('en-CA'),
                       material: 'PPF Roll (الصنف)',
                       itemType: 'سلعة', 
                       ExpenseAccountCode: '210102', // NEW: Override Expense Account (GRNI)
                       VatAccountCode: '110403', // NEW: Override VAT Account
                       quantity: 1, 
                       cost: 1000,
                       extraCosts: 0,
                       discount: 0,
                       vat: 0,
                       wht: 0,
                       totalAmount: 1000,
                       notes: 'ملاحظات'
                   });
              } else {
                 for (const inv of data) {
                     const common = {
                         invoiceNumber: inv.invoiceNumber,
                         supplierName: inv.supplier?.name || '',
                         date: new Date(inv.date).toLocaleDateString('en-CA'),
                         totalAmount: inv.totalAmount || 0,
                         notes: inv.notes || ''
                     };
                     if (inv.items && inv.items.length > 0) {
                         for (const item of inv.items) {
                             // Only export Stock items (Product exists)
                             if (item.product) {
                                 formattedData.push({
                                     ...common,
                                     material: item.product.name || '',
                                     itemType: item.product.type === 'Service' ? 'خدمة' : 'سلعة',
                                     quantity: item.quantity || 0,
                                     cost: item.cost || 0
                                 });
                             }
                         }
                     } else {
                         formattedData.push(common);
                     }
                 }
            }
        }
        else if (type === 'general_purchases') {
            if (req.query.template === 'true') {
                 formattedData.push({
                     invoiceNumber: 'GEN-1001',
                     supplierName: 'مورد خدمات / جهة',
                     SupplierAccountCode: '210101',
                     date: new Date().toLocaleDateString('en-CA'),
                     description: 'صيانة تكييفات (البيان)',
                     ExpenseAccountCode: '5102', // Maintenance Expense
                     amount: 500,
                     notes: 'ملاحظات'
                 });
            } else {
                 // Export existing general purchases
                 // We need to filter purchases that have items WITHOUT product
                 // But current query fetches all. We filter in loop.
                 const allPurchases = await PurchaseInvoice.find(query);
                 
                 for (const inv of allPurchases) {
                     // Check if it has non-product items
                     const generalItems = inv.items.filter(i => !i.product);
                     
                     if (generalItems.length > 0) {
                         for (const item of generalItems) {
                             formattedData.push({
                                 invoiceNumber: inv.invoiceNumber,
                                 supplierName: inv.supplier?.name || '',
                                 date: new Date(inv.date).toLocaleDateString('en-CA'),
                                 description: item.itemName || '',
                                 amount: item.cost || 0,
                                 notes: inv.notes || ''
                             });
                         }
                     }
                 }
            }
        }
        else if (type === 'payroll') { // NEW PAYROLL TEMPLATE
            if (req.query.template === 'true') {
                 formattedData.push({
                     referenceNumber: 'PAY-JAN-2025',
                     date: new Date().toLocaleDateString('en-CA'),
                     employeeName: 'Ahmed Ali',
                     basicSalary: 5000,
                     bonus: 500,
                     deductions: 200,
                     DebitAccountCode: '5103', // Salaries Expense
                     CreditAccountCode: '2103', // Salaries Payable
                     DeductionAccountCode: '4201', // Other Revenues (or Advances)
                     notes: 'Salary Jan'
                 });
            } else {
                 // Export existing payroll? Not implemented yet, just return template structure
                 formattedData = data;
            }
        }
        else if (type === 'customers') {
             if (req.query.template === 'true') {
                 formattedData.push({
                     code: 'CUST-001',
                     name: 'اسم العميل',
                     phone: '01000000000',
                     email: 'client@example.com',
                     address: 'العنوان',
                     nationalId: '12345678901234',
                     AccountCode: '110201' // NEW: Customer Account Code
                 });
             } else {
                 formattedData = data.map(doc => {
                     let row = { ...doc };
                     if (doc.accountId && typeof doc.accountId === 'object') {
                         row.AccountCode = doc.accountId.code;
                         row.accountName = doc.accountId.name;
                         delete row.accountId;
                     }
                     return row;
                 });
             }
        }
        else if (type === 'suppliers') {
             if (req.query.template === 'true') {
                 formattedData.push({
                     code: 'SUP-001',
                     name: 'اسم المورد',
                     phone: '01000000000',
                     email: 'supplier@example.com',
                     address: 'العنوان',
                     taxId: '123-456-789',
                     AccountCode: '210101' // NEW: Supplier Account Code
                 });
             } else {
                 formattedData = data.map(doc => {
                     let row = { ...doc };
                     if (doc.accountId && typeof doc.accountId === 'object') {
                         row.AccountCode = doc.accountId.code;
                         row.accountName = doc.accountId.name;
                         delete row.accountId;
                     }
                     return row;
                 });
             }
        }
        else if (type === 'products') {
            console.log('⚡ Formatting Products...');
            formattedData = data.map(p => ({
                code: p.code,
                name: p.name,
                type: p.type,
                length: p.dimensions?.length || 0,
                width: p.dimensions?.width || 0,
                unit: p.unit,
                currentStock: p.currentStock || 0,
                salePrice: p.pricing?.salePrice || 0,
                purchasePrice: p.pricing?.purchasePrice || 0, // ADDED: purchasePrice
                
                // Extra info
                area: p.dimensions?.area || 0,

                // Accounting (Codes)
                inventoryAccountCode: p.accounting?.inventoryAccount?.code || '',
                salesAccountCode: p.accounting?.salesAccount?.code || '',
                cogsAccountCode: p.accounting?.cogsAccount?.code || ''
            }));
        } 
        else if (type === 'stock_transactions') {
             if (req.query.template === 'true') {
                  formattedData.push({
                      serialNumber: 'STK-001',
                      type: 'Inbound',
                      date: new Date().toLocaleDateString('en-CA'),
                      warehouse: 'المخزن الرئيسي',
                      supplierDoc: 'DOC-123',
                      jobOrder: 'JOB-999',
                      notes: 'ملاحظات',
                      productName: 'اسم الصنف',
                      quantity: 10,
                      unitCost: 100,
                      rollCode: 'R-001',
                      length: 0,
                      width: 0,
                      partName: 'قطعة 1',
                      InventoryAccountCode: '110301', // NEW: Override Inventory Account
                      AccountCode: '2109' // NEW: Offset Account (GRNI for Inbound, COGS for Outbound)
                  });
             } else {
                 for (const doc of data) {
                     const common = {
                         date: new Date(doc.date).toLocaleDateString('en-CA'),
                         serialNumber: doc.serialNumber,
                         type: doc.type,
                         warehouse: doc.warehouse,
                         supplierDoc: doc.supplierDoc,
                         jobOrder: doc.jobOrder,
                         notes: doc.notes
                     };
                     if (doc.items && doc.items.length > 0) {
                         for (const item of doc.items) {
                             formattedData.push({
                                 ...common,
                                 productName: item.product?.name || item.product, 
                                 rollCode: item.rollCode,
                                 quantity: item.quantity || item.consumedArea,
                                 unitCost: item.unitCost,
                                 length: item.customDimensions?.length || item.consumedLength,
                                 width: item.customDimensions?.width || item.consumedWidth,
                                 partName: item.partName || ''
                             });
                         }
                     } else {
                         formattedData.push(common);
                     }
                 }
             }
        } 
        else if (type === 'treasury') {
             if (req.query.template === 'true') {
                 formattedData.push({
                     date: new Date().toLocaleDateString('en-CA'),
                     serialNumber: 'TR-001', 
                     type: 'Inbound', 
                     amount: 1000,
                     treasuryAccount: 'الخزينة الرئيسية', 
                     TreasuryAccountCode: '110101', // NEW: Explicit Treasury Account
                     targetAccount: 'اسم العميل/المورد', 
                     TargetAccountCode: '110201', // NEW: Explicit Target Account
                     description: 'شرح'
                 });
             } else {
                 formattedData = data.map(doc => ({
                     date: new Date(doc.date).toLocaleDateString('en-CA'),
                     serialNumber: doc.serialNumber,
                     type: doc.type,
                     amount: doc.amount,
                     treasuryAccount: doc.treasuryAccount?.name,
                     targetAccount: doc.targetAccount?.name,
                     description: doc.description
                 }));
             }
        }
        else if (type === 'cars') {
             for (const car of data) {
                if (car.parts && car.parts.length > 0) {
                    for (const part of car.parts) {
                        formattedData.push({
                            code: car.code, brand: car.brand, model: car.model, year: car.year,
                            partName: part.name, lengthCM: part.lengthCM, widthCM: part.widthCM, areaCM2: part.areaCM2
                        });
                    }
                } else {
                    formattedData.push({ code: car.code, brand: car.brand, model: car.model, year: car.year });
                }
            }
        } else {
             // Generic Fallback
             console.log('⚠️ Using Generic Fallback for:', type);
             formattedData = data.map(doc => {
                let row = { ...doc };
                if (doc.accountId && typeof doc.accountId === 'object') {
                    row.accountCode = doc.accountId.code;
                    row.accountName = doc.accountId.name;
                    delete row.accountId;
                }
                if (row.date) row.date = new Date(row.date).toLocaleDateString('en-CA');
                delete row._id; delete row.__v; delete row.parts; delete row.items; 
                return row;
            });
        }

        const worksheet = xlsx.utils.json_to_sheet(formattedData);
        const workbook = xlsx.utils.book_new();
        xlsx.utils.book_append_sheet(workbook, worksheet, "Data");
        const buffer = xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        
        res.setHeader('Content-Disposition', `attachment; filename=${type}.xlsx`);
        res.send(buffer);

    } catch (err) { res.status(500).json({ message: "Export Failed: " + err.message }); }
});

// ==========================================================
// 1.5 Import Preview / Validation
// ==========================================================
router.post('/preview-import/:type', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const type = String(req.params.type || '').trim().toLowerCase();
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheetName = workbook.SheetNames[0];
        const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[sheetName], { defval: '' });
        const headers = jsonData.length ? Object.keys(jsonData[0]) : [];

        const requiredColumnsMap = {
            sales_invoices: ['invoiceNumber', 'customerName', 'date'],
            purchase_invoices: ['invoiceNumber', 'supplierName', 'date'],
            stock_transactions: ['serialNumber', 'type', 'date', 'warehouse'],
            treasury: ['date', 'type', 'amount'],
            products: ['code', 'name'],
            customers: ['code', 'name'],
            suppliers: ['code', 'name'],
            accounts: ['code', 'name'],
            payroll: ['referenceNumber', 'date', 'employeeName']
        };

        const requiredColumns = requiredColumnsMap[type] || [];
        const missingRequiredColumns = requiredColumns.filter((column) => !headers.includes(column));
        const emptyRows = jsonData.filter((row) =>
            Object.values(row).every((value) => value === '' || value === null || value === undefined)
        ).length;

        res.json({
            success: true,
            type,
            sheetName,
            rowCount: jsonData.length,
            headers,
            requiredColumns,
            missingRequiredColumns,
            emptyRows,
            sampleRows: jsonData.slice(0, 5),
            canImport: jsonData.length > 0 && missingRequiredColumns.length === 0
        });
    } catch (err) {
        res.status(500).json({ message: 'Preview Failed: ' + err.message });
    }
});

// ==========================================================
// 2. Import (Refactored for Integrity)
// ==========================================================
router.post('/import/:type', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: "No file uploaded" });

        const type = req.params.type.trim();
        const wipeData = req.body.wipeData === 'true'; 
        
        const workbook = xlsx.read(req.file.buffer, { type: 'buffer', cellDates: true });
        const jsonData = xlsx.utils.sheet_to_json(workbook.Sheets[workbook.SheetNames[0]]);
        const Model = getModel(type);
        
        if (!Model) return res.status(400).json({ message: "Unknown Data Type" });

        // Resolve Accounts Map for Master Data
        const allAccounts = await Account.find();
        const accMap = {}; allAccounts.forEach(a => accMap[String(a.code).trim()] = a._id);


        let successCount = 0;
        let errors = [];

        // --------------------------------------------------------
        // A. Transactional Data (Invoices, Stock, Treasury)
        // --------------------------------------------------------
        if (['sales_invoices', 'purchase_invoices', 'general_purchases', 'stock_transactions', 'treasury'].includes(type)) {
            
            // --- Wipe Data Logic ---
            if (wipeData) {
                console.log(`🧹 Wiping Data for ${type}...`);
                if (type === 'purchase_invoices') {
                    await PurchaseInvoice.deleteMany({});
                    await JournalEntry.deleteMany({ referenceNumber: { $regex: /^PUR-/ } });
                } else if (type === 'sales_invoices') {
                    await SalesInvoice.deleteMany({});
                    await JournalEntry.deleteMany({ referenceNumber: { $regex: /^INV-/ } }); // Assuming INV- prefix or regex match
                } else if (type === 'stock_transactions') {
                    await StockTransaction.deleteMany({});
                    // Note: This might leave stock levels incorrect if not recalculated. 
                    // For a full reset, one should ideally reset Product.currentStock too, but that's risky.
                    // Assuming user knows this is a data wipe.
                } else if (type === 'treasury') {
                    await TreasuryTransaction.deleteMany({});
                }
            }

            // Group by Reference Number
            const groups = {};
            for (const row of jsonData) {
                const ref = row.invoiceNumber || row.serialNumber || row.referenceNumber || row.Ref || ('AUTO-' + Math.random());
                if (!groups[ref]) groups[ref] = [];
                groups[ref].push(row);
            }

            for (const ref in groups) {
                const rows = groups[ref];
                const header = rows[0]; // Take header info from first row

                try {
                    // Prepare Common Data
                    const date = parseExcelDate(header.date) || new Date();
                    
                    if (type === 'sales_invoices') {
                        // Resolve Customer
                        let customerId = header.customer;
                        // Try finding by name if not ID
                        if (header.customerName) {
                            const c = await Customer.findOne({ name: header.customerName });
                            if(c) customerId = c._id;
                        }

                        // Resolve Account Code
                        let customerAccountId = null;
                        const accCode = header.AccountCode || header.CustomerAccountCode;
                        if (accCode) {
                            if (!accMap[String(accCode).trim()]) {
                                throw new Error(`Account Code ${accCode} not found in Chart of Accounts`);
                            }
                            customerAccountId = accMap[String(accCode).trim()];
                        }

                        // Resolve Car
                        let carId = null;
                        const carStr = header.car || '';
                        if (carStr) {
                             const cars = await Car.find();
                             // Loose match
                             const match = cars.find(c => carStr.toLowerCase().includes(c.brand.toLowerCase()) || carStr.toLowerCase().includes(c.model.toLowerCase()));
                             if (match) carId = match._id;
                        }

                        const items = [];
                        for (const r of rows) {
                            // Determine type from Excel
                            const rawType = r.itemType || r.type || '';
                            const rawTypeLower = rawType.toLowerCase();
                            
                            let targetType = 'Service'; 
                            if (rawType.includes('إداري') || rawTypeLower.includes('admin')) {
                                targetType = 'Administrative';
                            } else if (rawType.includes('خدمة') || rawTypeLower.includes('service')) {
                                targetType = 'Service';
                            } else if (rawType.includes('سلعة') || rawTypeLower.includes('stock') || rawTypeLower.includes('good')) {
                                targetType = 'Stock';
                            }

                            // Resolve Product
                            let productId = r.product;
                            let p = null;
                            const prodName = r.serviceType || r.material || r.productName;
                            
                            if (prodName) {
                                p = await Product.findOne({ name: prodName });
                                
                                // --- AUTO CREATE PRODUCT IF NOT EXISTS ---
                                if (!p) {
                                    const newCode = 'AUTO-' + Math.floor(1000 + Math.random() * 9000);
                                    p = new Product({
                                        code: newCode,
                                        name: prodName,
                                        type: targetType === 'Stock' ? 'Stock' : 'Service', 
                                        pricing: { salePrice: parseNumber(r.unitPrice) || parseNumber(r.price) || 0 }
                                    });
                                    await p.save();
                                    console.log(`✨ Auto-created Product (Sales): ${prodName} (${newCode})`);
                                }
                                productId = p._id;
                            }
                            
                            // Resolve Revenue Account Override
                            let revenueAccId = null;
                            const revCode = r.RevenueAccountCode || r.AccountCode;
                            if (revCode) {
                                if (accMap[String(revCode).trim()]) {
                                    revenueAccId = accMap[String(revCode).trim()];
                                } else {
                                    throw new Error(`Revenue Account Code ${revCode} not found`);
                                }
                            }
                            
                            if(productId) {
                                // Dimensions
                                const len = parseNumber(r.length) || parseNumber(r.lengthCM) || 0;
                                const width = parseNumber(r.width) || parseNumber(r.widthCM) || 0;
                                const area = parseNumber(r.area) || ((len * width) / 10000) || 0;
                                const price = parseNumber(r.unitPrice) || parseNumber(r.price) || 0;
                                
                                items.push({
                                    product: productId,
                                    partName: r.partName || '',
                                    quantity: parseNumber(r.quantity) || 1,
                                    price: price,
                                    lengthCM: len,
                                    widthCM: width,
                                    area: area,
                                    revenueAccount: revenueAccId, // Pass Override
                                    // Helper for calculation (not in schema)
                                    _lineTotal: price * (area > 0 ? area : (parseNumber(r.quantity)||1)),
                                    _forceType: targetType
                                });
                            }
                        }
                        
                        // Financials
                        const subtotal = items.reduce((sum, i) => sum + i._lineTotal, 0);
                        const extra = parseNumber(header.extraServices) || 0;
                        const discount = parseNumber(header.discount) || 0;
                        const vat = parseNumber(header.vat) || 0;
                        const wht = parseNumber(header.wht) || 0;
                        
                        const payload = {
                            invoiceNumber: ref,
                            date: date,
                            customer: customerId,
                            customerAccount: customerAccountId, // Pass explicit account
                            carModel: carId,
                            serviceType: header.serviceType || 'General',
                            items: items,
                            subtotal: subtotal,
                            totalExtraCosts: extra,
                            totalDiscount: discount,
                            totalTax: vat,
                            whtAmount: wht,
                            finalTotal: (subtotal + extra + vat) - (discount + wht),
                            status: 'Approved',
                            notes: header.notes || header.description || ''
                        };

                        await salesService.createSalesInvoice(payload);
                        successCount++;
                    }
                    else if (type === 'purchase_invoices') {
                        // Resolve Supplier
                        let supplierId = header.supplier;
                        if (header.supplierName) {
                            const s = await Supplier.findOne({ name: header.supplierName });
                            if(s) supplierId = s._id;
                        }

                        // Resolve Account Code
                        let supplierAccountId = accMap['2101']; // Default
                        const accCode = header.AccountCode || header.SupplierAccountCode;
                        if (accCode) {
                            if (!accMap[String(accCode).trim()]) {
                                throw new Error(`Account Code ${accCode} not found in Chart of Accounts`);
                            }
                            supplierAccountId = accMap[String(accCode).trim()];
                        }

                        const items = [];
                        for (const r of rows) {
                            let productId = r.product;
                            let p = null;
                            const prodName = r.material || r.productName; // No ServiceType here usually? Or keep simple.
                            
                            // Determine type from Excel
                            // User wants to specify "Service" or "Stock" in Excel.
                            // If empty, default to Stock (Purchase).
                            const rawType = r.itemType || r.type || '';
                            const rawTypeLower = rawType.toLowerCase();
                            
                            let targetType = 'Stock';
                            if (rawType.includes('إداري') || rawTypeLower.includes('admin') || rawTypeLower.includes('rent') || rawTypeLower.includes('electricity')) {
                                targetType = 'Administrative';
                            } else if (rawType.includes('خدمة') || rawTypeLower.includes('service')) {
                                targetType = 'Service';
                            }

                            if (prodName) {
                                p = await Product.findOne({ name: prodName });
                                
                                if (!p) {
                                    const newCode = 'PUR-AUTO-' + Math.floor(1000 + Math.random() * 9000);
                                    p = new Product({
                                        code: newCode,
                                        name: prodName,
                                        type: targetType, 
                                        pricing: { lastPurchasePrice: parseNumber(r.cost) || 0 }
                                    });
                                    await p.save();
                                }
                                productId = p._id;
                            }
                            
                            if(productId) {
                                // Resolve Expense Account Override
                                let expenseAccId = null;
                                const expCode = r.ExpenseAccountCode || r.ItemAccountCode;
                                
                                if (expCode) {
                                    if (accMap[String(expCode).trim()]) {
                                        expenseAccId = accMap[String(expCode).trim()];
                                    } else {
                                        throw new Error(`Expense Account Code ${expCode} not found`);
                                    }
                                }
                                
                                // Extract Note from Excel 'notes' column
                                const itemNote = r.notes || r.Notes || '';

                                items.push({
                                    product: productId,
                                    quantity: parseNumber(r.quantity) || 1,
                                    cost: parseNumber(r.cost) || 0,
                                    expenseAccount: expenseAccId, // Pass Override
                                    // Pass explicit type override to Purchase Service
                                    _forceType: targetType,
                                    notes: itemNote // Pass note to item
                                });
                            }
                        }
                        
                        // Financials
                        const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
                        const extra = parseNumber(header.extraCosts) || 0;
                        const discount = parseNumber(header.discount) || 0;
                        const vat = parseNumber(header.vat) || 0;
                        const wht = parseNumber(header.wht) || 0;

                        // Resolve VAT Account
                        let vatAccountId = null;
                        if (vat > 0) {
                            // 1. Check for Override in Excel
                            const vatCode = header.VatAccountCode || header.vatAccountCode;
                            if (vatCode && accMap[String(vatCode).trim()]) {
                                vatAccountId = accMap[String(vatCode).trim()];
                            }
                            // 2. Default to 110403 (User Request)
                            else if (accMap['110403']) {
                                vatAccountId = accMap['110403'];
                            }
                            // 3. Fallback
                            else if (accMap['110401']) {
                                vatAccountId = accMap['110401'];
                            }
                        }

                        const payload = {
                            invoiceNumber: ref,
                            date: date,
                            supplier: supplierId,
                            items: items,
                            subtotal: subtotal,
                            totalExtraCosts: extra,
                            totalDiscount: discount,
                            totalTax: vat,
                            accVat: vatAccountId, // Pass VAT Account
                            whtAmount: wht,
                            totalAmount: (subtotal + extra + vat) - (discount + wht),
                            accSupplier: supplierAccountId, // Explicit or Default
                            notes: header.notes || header.description || ''
                        };

                        await purchaseService.createPurchase(payload);
                        successCount++;
                    }
                    else if (type === 'general_purchases') {
                        // Import General/Service Purchases (No Product Creation)
                        let supplierId = header.supplier;
                        if (header.supplierName) {
                            const s = await Supplier.findOne({ name: header.supplierName });
                            if(s) supplierId = s._id;
                        }

                        // Supplier Account
                        let supplierAccountId = accMap['2101']; 
                        const accCode = header.AccountCode || header.SupplierAccountCode;
                        if (accCode && accMap[String(accCode).trim()]) supplierAccountId = accMap[String(accCode).trim()];

                        const items = [];
                        for (const r of rows) {
                            const desc = r.description || r.itemName || r.statement;
                            const amount = parseNumber(r.amount) || parseNumber(r.cost) || 0;
                            
                            // Expense Account
                            let expenseAccId = null;
                            const expCode = r.ExpenseAccountCode || r.AccountCode; // Row level account
                            if (expCode && accMap[String(expCode).trim()]) {
                                expenseAccId = accMap[String(expCode).trim()];
                            } else {
                                throw new Error(`Expense Account Code ${expCode} not found for item: ${desc}`);
                            }

                            items.push({
                                itemName: desc,
                                expenseAccount: expenseAccId,
                                quantity: 1,
                                cost: amount,
                                // No product ID
                            });
                        }

                        const subtotal = items.reduce((sum, i) => sum + i.cost, 0);
                        const vat = parseNumber(header.vat) || 0;

                        const payload = {
                            invoiceNumber: ref,
                            date: date,
                            supplier: supplierId,
                            items: items,
                            subtotal: subtotal,
                            totalTax: vat,
                            accSupplier: supplierAccountId,
                            totalAmount: subtotal + vat,
                            notes: header.notes || ''
                        };

                        await purchaseService.createPurchase(payload);
                        successCount++;
                    }
                    else if (type === 'stock_transactions') {
                        // Resolve Warehouse
                        // Service accepts warehouse name or ID.

                        // Resolve Accounts
                        let inventoryAccountId = null;
                        const invCode = header.InventoryAccountCode || header.inventoryAccountCode; // Removed AccountCode to avoid ambiguity
                        if (invCode) {
                            if (!accMap[String(invCode).trim()]) {
                                throw new Error(`Inventory Account Code ${invCode} not found`);
                            }
                            inventoryAccountId = accMap[String(invCode).trim()];
                        }

                        let secondAccountId = null; // Credit (Inbound) or COGS (Outbound)
                        // Allow 'AccountCode' to be the Offset
                        const secCode = header.CreditAccountCode || header.COGSAccountCode || header.SecondAccountCode || header.AccountCode;
                        if (secCode) {
                            if (!accMap[String(secCode).trim()]) {
                                throw new Error(`Offset Account Code ${secCode} not found`);
                            }
                            secondAccountId = accMap[String(secCode).trim()];
                        }
                        
                        const items = [];
                        for (const r of rows) {
                            let productId = r.product;
                            const prodName = r.productName || r.partName || r.material;
                            
                            if (prodName) {
                                let p = await Product.findOne({ name: prodName });
                                // Auto-create if not found (Stock)
                                if (!p) {
                                    const newCode = 'STK-AUTO-' + Math.floor(1000 + Math.random() * 9000);
                                    p = new Product({
                                        code: newCode,
                                        name: prodName,
                                        type: 'Stock',
                                        pricing: { purchasePrice: parseNumber(r.unitCost) || 0 }
                                    });
                                    await p.save();
                                    console.log(`✨ Auto-created Product (Stock): ${prodName}`);
                                }
                                productId = p._id;
                            }
                            
                            if(productId) {
                                // Determine quantity/area based on type
                                let qty = parseNumber(r.quantity) || parseNumber(r.area) || 0;
                                let len = parseNumber(r.length) || 0;
                                let wid = parseNumber(r.width) || 0;
                                
                                items.push({
                                    product: productId,
                                    rollCode: r.rollCode || ('ROLL-' + Math.random().toString(36).substr(2, 5).toUpperCase()),
                                    quantity: qty,
                                    unitCost: parseNumber(r.unitCost) || 0,
                                    customDimensions: { length: len, width: wid },
                                    
                                    // Outbound specific
                                    consumedArea: qty,
                                    consumedLength: len,
                                    consumedWidth: wid,
                                    partName: r.partName
                                });
                            }
                        }

                        const stockData = {
                            date: date,
                            serialNumber: ref,
                            type: header.type || 'Inbound', 
                            warehouse: header.warehouse || 'Main Warehouse',
                            supplierDoc: header.supplierDoc,
                            jobOrder: header.jobOrder,
                            items: items,
                            notes: header.notes,
                            inventoryAccount: inventoryAccountId,
                            creditAccount: secondAccountId, // Used if Inbound
                            cogsAccount: secondAccountId    // Used if Outbound
                        };
                        
                        if (stockData.type === 'Inbound') {
                            await inventoryService.processInbound(stockData);
                        } else if (stockData.type === 'Outbound') {
                            await inventoryService.processOutbound(stockData);
                        }
                        successCount++;
                    }
                    else if (type === 'treasury') {
                        // Assuming Treasury Transaction
                        // Resolve Accounts
                        let treasuryAccId = null;
                        
                        // 1. Strict Code Check
                        const tCode = header.TreasuryAccountCode || header.treasuryCode;
                        if (tCode) {
                             if (!accMap[String(tCode).trim()]) {
                                 throw new Error(`Treasury Account Code ${tCode} not found in Chart of Accounts`);
                             }
                             treasuryAccId = accMap[String(tCode).trim()];
                        } 
                        // 2. Fallback to Name only if Code not provided
                        else if (header.treasuryAccount) {
                             const found = allAccounts.find(a => a.name === header.treasuryAccount);
                             if(found) treasuryAccId = found._id;
                        }

                        let targetAccId = null;
                        
                        // 1. Strict Code Check
                        const tgCode = header.TargetAccountCode || header.targetCode;
                        if (tgCode) {
                             if (!accMap[String(tgCode).trim()]) {
                                 throw new Error(`Target Account Code ${tgCode} not found in Chart of Accounts`);
                             }
                             targetAccId = accMap[String(tgCode).trim()];
                        }
                        // 2. Fallback to Name only if Code not provided
                        else if (header.targetAccount) {
                             const found = allAccounts.find(a => a.name === header.targetAccount);
                             if(found) targetAccId = found._id;
                        }

                        if (!treasuryAccId) throw new Error("Treasury Account not found (Check Code or Name)");
                        if (!targetAccId) throw new Error("Target Account not found (Check Code or Name)");

                        const transData = {
                            date: date,
                            serialNumber: ref,
                            type: header.type, // 'Inbound' or 'Outbound'
                            amount: header.amount,
                            treasuryAccount: treasuryAccId,
                            targetAccount: targetAccId,
                            description: header.description || 'Imported Transaction'
                        };

                        await treasuryService.createTransaction(transData);
                    }
                    else if (type === 'import_shipments') {
                        // Import Shipments -> Purchase Invoices (Foreign)
                        // Resolve Supplier
                        let supplierId = header.supplier;
                        if (header.supplierName) {
                            const s = await Supplier.findOne({ name: header.supplierName });
                            if(s) supplierId = s._id;
                        }

                        const items = [];
                        const exchangeRate = parseNumber(header.exchangeRate) || 1;

                        for (const r of rows) {
                            let productId = r.product;
                            const prodName = r.productName || r.material;
                            
                            if (prodName) {
                                let p = await Product.findOne({ name: prodName });
                                if (!p) {
                                    const newCode = 'IMP-AUTO-' + Math.floor(1000 + Math.random() * 9000);
                                    p = new Product({
                                        code: newCode,
                                        name: prodName,
                                        type: 'Stock', // Imports are usually Stock
                                        pricing: { lastPurchasePrice: (parseNumber(r.foreignPrice) || 0) * exchangeRate }
                                    });
                                    await p.save();
                                }
                                productId = p._id;
                            }
                            
                            if(productId) {
                                const fPrice = parseNumber(r.foreignPrice) || 0;
                                const localCost = fPrice * exchangeRate;
                                
                                // Resolve Item Accounts
                                let debitAccId = null;
                                const dCode = r.DebitAccountCode || r.ItemAccountCode;
                                if (dCode && accMap[String(dCode).trim()]) debitAccId = accMap[String(dCode).trim()];

                                let creditAccId = null;
                                const cCode = r.CreditAccountCode || r.SupplierAccountCode;
                                if (cCode && accMap[String(cCode).trim()]) creditAccId = accMap[String(cCode).trim()];

                                items.push({
                                    product: productId,
                                    quantity: parseNumber(r.quantity) || 1,
                                    cost: localCost,
                                    expenseAccount: debitAccId, // Override Debit
                                    creditAccount: creditAccId, // Override Credit
                                    _forceType: 'Stock' // Default to Stock for imports
                                });
                            }
                        }
                        
                        // Financials
                        const subtotal = items.reduce((sum, i) => sum + (i.quantity * i.cost), 0);
                        const extra = (parseNumber(header.extraCosts) || 0) * exchangeRate; // Assuming extra costs in foreign too? Or local? Let's assume Local for simplicity or add column.
                        // Actually usually Extra Costs on Import are Customs (Local).
                        // Let's assume header.extraCosts is in LOCAL currency.
                        
                        const discount = (parseNumber(header.discount) || 0); // Local
                        const vat = (parseNumber(header.vat) || 0); // Local

                        const payload = {
                            invoiceNumber: ref, // e.g. SH-2026-001
                            date: date,
                            supplier: supplierId,
                            items: items,
                            subtotal: subtotal,
                            totalExtraCosts: extra,
                            totalDiscount: discount,
                            totalTax: vat,
                            whtAmount: 0, // Usually no WHT on foreign imports in this simple flow
                            totalAmount: (subtotal + extra + vat) - discount,
                            accSupplier: accMap['2101'], // Default Suppliers Control
                            notes: `Import Shipment (Rate: ${exchangeRate}) | ${header.notes || ''}`
                        };

                        await purchaseService.createPurchase(payload);
                        successCount++;
                    }
                    
                    else if (type === 'payroll') {
                        // Payroll Import
                        // Logic:
                        // 1. Employee (if not found, optional create?) -> User said "2025 Data", assumes employees exist or create them.
                        // 2. Journal Entry: 
                        //    Debit: Salary Expense (or user specified Account)
                        //    Credit: Net Salary Payable / Bank / Cash (User specified)
                        
                        // Default Accounts
                        const accSalaries = await Account.findOne({ code: '5103' }); // Salaries Expense
                        const accPayable = await Account.findOne({ code: '2103' });  // Salaries Payable

                        const groups = {};
                        for (const row of jsonData) {
                            const ref = row.month || row.referenceNumber || ('PAY-' + Date.now());
                            if (!groups[ref]) groups[ref] = [];
                            groups[ref].push(row);
                        }

                        for (const ref in groups) {
                            const rows = groups[ref];
                            const header = rows[0];
                            const trxDate = parseExcelDate(header.date) || new Date();
                            
                            let glDetails = [];
                            let totalNet = 0;

                            for (const r of rows) {
                                // 1. Debit Side (Expense)
                                let debitAccId = accSalaries ? accSalaries._id : null;
                                if (r.DebitAccountCode && accMap[String(r.DebitAccountCode).trim()]) {
                                    debitAccId = accMap[String(r.DebitAccountCode).trim()];
                                }

                                // 2. Credit Side (Payment Source)
                                let creditAccId = accPayable ? accPayable._id : null;
                                if (r.CreditAccountCode && accMap[String(r.CreditAccountCode).trim()]) {
                                    creditAccId = accMap[String(r.CreditAccountCode).trim()];
                                }

                                const basic = parseNumber(r.basicSalary) || 0;
                                const bonus = parseNumber(r.bonus) || 0;
                                const deductions = parseNumber(r.deductions) || 0;
                                const net = (basic + bonus) - deductions;
                                const totalDebit = basic + bonus; // Gross

                                if (debitAccId && totalDebit > 0) {
                                    glDetails.push({
                                        accountId: debitAccId,
                                        debit: totalDebit,
                                        credit: 0,
                                        description: `Salary: ${r.employeeName || ''} (Basic+Bonus)`
                                    });
                                }
                                
                                // Handle Deductions (Credit to something? Or reduce expense?)
                                // Usually Deductions are Credit to "Advances" or "Tax" etc.
                                // For simplicity here: Net = Gross - Deductions.
                                // We credit Net to Payable/Bank.
                                // We credit Deductions to "Other Revenues" or "Staff Receivables"??
                                // Let's assume User provides Net and we just Debit Expense = Net (Simple) 
                                // OR User provides Gross and we credit Net + Deductions.
                                
                                // Let's follow user instruction: "Salary Sheet with GL Direction"
                                // If they provide DebitAccount and CreditAccount, we use them.
                                
                                if (creditAccId && net > 0) {
                                    glDetails.push({
                                        accountId: creditAccId,
                                        debit: 0,
                                        credit: net,
                                        description: `Net Salary: ${r.employeeName || ''}`
                                    });
                                }
                                
                                // If deductions exist, where do they go? 
                                // If user didn't specify, we might have imbalance.
                                // Let's assume "DeductionAccountCode" column exists or we warn.
                                if (deductions > 0) {
                                     let dedAccId = null;
                                     if (r.DeductionAccountCode && accMap[String(r.DeductionAccountCode).trim()]) {
                                         dedAccId = accMap[String(r.DeductionAccountCode).trim()];
                                     }
                                     if(dedAccId) {
                                         glDetails.push({
                                            accountId: dedAccId,
                                            debit: 0,
                                            credit: deductions,
                                            description: `Deductions: ${r.employeeName || ''}`
                                         });
                                     }
                                }
                            }

                            // Create Journal Entry
                            if (glDetails.length > 0) {
                                await JournalEntry.create({
                                    date: trxDate,
                                    referenceNumber: ref,
                                    description: `Payroll Import - ${ref}`,
                                    details: glDetails,
                                    status: 'Posted',
                                    totalDebit: glDetails.reduce((s,x)=>s+x.debit,0),
                                    totalCredit: glDetails.reduce((s,x)=>s+x.credit,0)
                                });
                                successCount++;
                            }
                        }
                    }
                    
                    successCount++;
                } catch (err) {
                    console.error(`Error importing ${ref}:`, err.message);
                    errors.push(`Row/Ref ${ref}: ${err.message}`);
                }
            }
        }
        
        // --------------------------------------------------------
        // B. Master Data (Simple Insert)
        // --------------------------------------------------------
        else {
            if (wipeData) await Model.deleteMany({});
            
            for (const row of jsonData) {
                try {
                    const d = { ...row };
                    
                    // Handle Account Mapping (Strict Check with multiple column names)
                    // Try to find the account code value from various possible column headers
                    let codeVal = row.AccountCode || row.accountCode || row['Account Code'] || row['account code'] || row.Code || row.code;
                    
                    // Special case: If 'Code' is used for Supplier Code (SUP-001), don't confuse it with Account Code.
                    // Usually AccountCode is distinct.
                    // Let's stick to specific Account keys to avoid ambiguity.
                    codeVal = row.AccountCode || row.accountCode || row['Account Code'] || row.Account_Code;

                    if (codeVal) {
                        const codeStr = String(codeVal).trim();
                        if (accMap[codeStr]) {
                            d.accountId = accMap[codeStr];
                        } else {
                            throw new Error(`حساب رقم "${codeStr}" غير موجود. تأكد من صحة الرقم أو استورد شجرة الحسابات.`);
                        }
                    } else {
                        // If Supplier/Customer, Account is mandatory
                        if (type === 'suppliers' || type === 'customers') {
                             // Check if we can fallback to a default account?
                             // No, better to force user to provide it or fail, to avoid "Not Linked" issues.
                             throw new Error(`عمود كود الحساب (AccountCode) مفقود أو فارغ للمورد/العميل: ${row.name}`);
                        }
                    }


                    // Handle Specific Logic for Products
                    if (type === 'products') {
                         d.dimensions = {
                             length: Number(row.length) || 0,
                             width: Number(row.width) || 0,
                             area: Number(row.area) || (Number(row.length) * Number(row.width)) || 0
                         };
                         d.pricing = {
                             salePrice: Number(row.salePrice) || 0,
                             purchasePrice: Number(row.purchasePrice) || 0 // ADDED: purchasePrice
                         };
                         d.accounting = {};
                         if(row.inventoryAccountCode && accMap[row.inventoryAccountCode]) d.accounting.inventoryAccount = accMap[row.inventoryAccountCode];
                         if(row.salesAccountCode && accMap[row.salesAccountCode]) d.accounting.salesAccount = accMap[row.salesAccountCode];
                         if(row.cogsAccountCode && accMap[row.cogsAccountCode]) d.accounting.cogsAccount = accMap[row.cogsAccountCode];
                    }

                    // Handle Specific Logic for Cars
                    if (type === 'cars') {
                        // Do nothing here, we handle cars in batch after the loop
                    } 
                    else {
                        // Default fallback upsert
                        const filter = d.code ? { code: d.code } : (d._id ? { _id: d._id } : d);
                        // Avoid empty filter
                        if (Object.keys(filter).length > 0) {
                           await Model.findOneAndUpdate(filter, d, { upsert: true });
                        }
                    }
                    successCount++;
                } catch (err) {
                    errors.push(`Row ${JSON.stringify(row).substring(0, 50)}... : ${err.message}`);
                }
            }

            // --------------------------------------------------------
            // C. Special Batch Handling for Cars (Merged Rows)
            // --------------------------------------------------------
            if (type === 'cars') {
                const carGroups = {};
                
                for (const row of jsonData) {
                    const code = row.code ? String(row.code).trim() : null;
                    if (!code) continue;

                    if (!carGroups[code]) {
                        carGroups[code] = {
                            code: code,
                            brand: row.brand,
                            model: row.model,
                            year: row.year,
                            parts: []
                        };
                    }

                    // Add part if exists
                    if (row.partName) {
                        carGroups[code].parts.push({
                            name: row.partName,
                            lengthCM: Number(row.lengthCM) || 0,
                            widthCM: Number(row.widthCM) || 0,
                            areaCM2: Number(row.areaCM2) || ((Number(row.lengthCM)||0) * (Number(row.widthCM)||0))
                        });
                    }
                }

                for (const code in carGroups) {
                    const carData = carGroups[code];
                    await Car.findOneAndUpdate({ code: code }, carData, { upsert: true });
                    successCount++;
                }
            }
        }

        res.json({ message: `✅ Imported ${successCount} entries successfully.`, errors: errors });

    } catch (err) { res.status(500).json({ message: "Import Error: " + err.message }); }
});

// ==========================================================
// 3. Delete Range (Admin Utility)
// ==========================================================
router.post('/delete-range', async (req, res) => {
    try {
        const { type, fromDate, toDate } = req.body;
        if (!type || !fromDate || !toDate) return res.status(400).json({ message: "Missing parameters" });

        const start = new Date(fromDate);
        const end = new Date(toDate);
        end.setHours(23, 59, 59, 999);

        let deletedCount = 0;

        if (type === 'stock') {
            const txs = await StockTransaction.find({ date: { $gte: start, $lte: end } });
            const inventoryService = require('../services/inventoryService');
            for (const t of txs) { await inventoryService.deleteTransaction(t._id); }
            deletedCount = txs.length;
        }
        else if (type === 'purchases') {
            const invs = await PurchaseInvoice.find({ date: { $gte: start, $lte: end } });
            for(const inv of invs) await purchaseService.deletePurchase(inv._id);
            deletedCount = invs.length;
        }
        else if (type === 'sales') {
            const invs = await SalesInvoice.find({ date: { $gte: start, $lte: end } });
            for(const inv of invs) await salesService.deleteInvoice(inv._id);
            deletedCount = invs.length;
        }
        else if (type === 'treasury') {
            const txs = await TreasuryTransaction.find({ date: { $gte: start, $lte: end } });
            for(const t of txs) await treasuryService.deleteTransaction(t._id);
            deletedCount = txs.length;
        }

        res.json({ message: `Deleted ${deletedCount} records.` });

    } catch (e) {
        console.error(e);
        res.status(500).json({ message: e.message });
    }
});

// ==========================================================
// 4. Nuke Everything (Danger Zone)
// ==========================================================
router.delete('/nuke-everything', async (req, res) => {
    try {
        await JournalEntry.deleteMany({});
        await PurchaseInvoice.deleteMany({});
        await SalesInvoice.deleteMany({});
        await StockTransaction.deleteMany({});
        await TreasuryTransaction.deleteMany({});
        const RollBalance = require('../models/RollBalance');
        await RollBalance.deleteMany({});
        if(ImportShipment) await ImportShipment.deleteMany({});
        
        // Reset Stock
        await Product.updateMany({}, { $set: { currentStock: 0, "pricing.lastPurchasePrice": 0 } });

        res.json({ message: "System Nuked Successfully" });
    } catch (e) {
        res.status(500).json({ message: e.message });
    }
});

module.exports = router;

// =================================================================================================
// 4. IMPORT SHIPMENT TEMPLATE & IMPORT
// =================================================================================================

// Template
router.get('/template-import-shipment', (req, res) => {
    const data = [
                    {
                        shipmentRef: 'SH-2026-001',
                        supplierName: 'Foreign Supplier Ltd',
                        date: new Date().toLocaleDateString('en-CA'),
                        productName: 'PPF Roll Clear',
                        length: 1500, // CM
                        width: 152, // CM
                        quantity: 100,
                        foreignPrice: 50, // Price in Foreign Currency
                        currency: 'USD',
                        exchangeRate: 50,
                        extraCosts: 1000, // Local Currency (Customs, etc.)
                        DebitAccountCode: '110301', // كود الحساب المدين (مخزون/مصروف)
                        CreditAccountCode: '210101', // كود الحساب الدائن (مورد/جمارك)
                        notes: 'First Shipment'
                    }
                ];

    const ws = xlsx.utils.json_to_sheet(data);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, ws, "ImportShipments");

    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });
    res.setHeader('Content-Disposition', 'attachment; filename=ImportShipment_Template.xlsx');
    res.type('application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.send(buffer);
});

// Import
router.post('/import-import-shipment', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

        const wb = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const data = xlsx.utils.sheet_to_json(sheet);

        if (!data || data.length === 0) return res.status(400).json({ message: 'Empty file' });

        // Group by Shipment Ref
        const shipments = {};
        for (const row of data) {
            const ref = row.shipmentRef || row.ShipmentRef || 'AUTO-' + Date.now();
            if (!shipments[ref]) {
                shipments[ref] = {
                    ref: ref,
                    supplierName: row.supplierName || row.SupplierName || 'Unknown Supplier',
                    date: row.date || row.Date || new Date(),
                    items: [],
                    notes: row.notes || row.Notes || '',
                    extraCosts: parseNumber(row.extraCosts || row.ExtraCosts) || 0,
                    exchangeRate: parseNumber(row.exchangeRate || row.ExchangeRate) || 1
                };
            }
            shipments[ref].items.push(row);
        }

        let importedCount = 0;
        const ImportShipment = require('../models/ImportShipment');
        const Supplier = require('../models/Supplier');
        const Product = require('../models/Product');
        const Account = require('../models/Account');

        // Default Accounts for Supplier
        const accSupplier = await Account.findOne({ code: '2101' }); 

        for (const ref in shipments) {
            const shipData = shipments[ref];
            
            // 1. Supplier
            let supplier = await Supplier.findOne({ name: shipData.supplierName });
            if (!supplier) {
                supplier = new Supplier({
                    name: shipData.supplierName,
                    type: 'Foreign', // Default to Foreign for Import Shipment
                    accountId: accSupplier ? accSupplier._id : null
                });
                await supplier.save();
            }

            // 2. Items
            const items = [];
            const exchangeRate = shipData.exchangeRate;

            for (const row of shipData.items) {
                const prodName = row.productName || row.material || row.Product;
                if (!prodName) continue;

                let product = await Product.findOne({ name: prodName });
                if (!product) {
                    const newCode = 'IMP-PROD-' + Math.floor(1000 + Math.random() * 9000);
                    product = new Product({
                        code: newCode,
                        name: prodName,
                        type: 'Stock',
                        dimensions: {
                            length: parseNumber(row.length || row.Length) || 0,
                            width: parseNumber(row.width || row.Width) || 0,
                            area: (parseNumber(row.length || row.Length) || 0) * (parseNumber(row.width || row.Width) || 0)
                        },
                        pricing: { lastPurchasePrice: (parseNumber(row.foreignPrice) || 0) * exchangeRate }
                    });
                    await product.save();
                } else {
                    // Update dimensions if missing
                    if (!product.dimensions || product.dimensions.length === 0) {
                        product.dimensions = {
                            length: parseNumber(row.length || row.Length) || 0,
                            width: parseNumber(row.width || row.Width) || 0,
                            area: (parseNumber(row.length || row.Length) || 0) * (parseNumber(row.width || row.Width) || 0)
                        };
                        await product.save();
                    }
                }

                const qty = parseNumber(row.quantity) || 0;
                const fPrice = parseNumber(row.foreignPrice) || 0;

                items.push({
                    product: product._id,
                    quantity: qty,
                    unitForeignPrice: fPrice,
                    totalForeign: qty * fPrice,
                    unitLandedCost: 0 // Will be calculated in UI or on Post
                });
            }
            
            // Create Import Shipment (Draft)
            const newShipment = new ImportShipment({
                shipmentRef: ref,
                supplier: supplier._id,
                arrivalDate: parseExcelDate(shipData.date),
                exchangeRate: exchangeRate,
                items: items,
                costLines: shipData.extraCosts > 0 ? [{
                    description: 'Import Extra Costs',
                    amount: shipData.extraCosts,
                    isVat: false
                }] : [],
                status: 'Draft'
            });

            await newShipment.save();
            importedCount++;
        }

        res.json({ message: `✅ Imported ${importedCount} shipments as Drafts. Please review and post in Import Shipment screen.` });

    } catch (error) {
        console.error("Import Error:", error);
        res.status(500).json({ message: error.message });
    }
});
