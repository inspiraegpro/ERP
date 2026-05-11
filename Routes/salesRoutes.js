const express = require('express');
const router = express.Router();
const FileDatabaseManager = require('../file_db_manager');
const salesService = require('../services/salesService');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Car = require('../models/Car');
const { authenticateToken, requireAdmin } = require('../middleware/auth');

const db = new FileDatabaseManager();

const normalizeDimensionToCm = (value) => {
    const numericValue = Number(value) || 0;
    if (!numericValue) return 0;
    return numericValue < 100 ? numericValue * 100 : numericValue;
};

const hydrateSalesInvoice = async (invoice) => {
    const customer = invoice.customer && typeof invoice.customer !== 'object'
        ? await Customer.findOne({ _id: invoice.customer })
        : invoice.customer;

    let hydratedCarModel = invoice.carModel;
    if (hydratedCarModel && typeof hydratedCarModel !== 'object') {
        const car = await Car.findOne({ _id: hydratedCarModel });
        if (car) {
            hydratedCarModel = car;
        }
    }

    const items = await Promise.all((invoice.items || []).map(async (item) => {
        const productId = typeof item.product === 'object' ? item.product._id : item.product;
        const product = productId ? await Product.findOne({ _id: productId }) : null;
        const dimensions = product?.dimensions || {};
        const rawLength = Number(item.lengthCM ?? item.length ?? dimensions.length ?? 0) || 0;
        const rawWidth = Number(item.widthCM ?? item.width ?? dimensions.width ?? 0) || 0;
        const length = normalizeDimensionToCm(rawLength);
        const width = normalizeDimensionToCm(rawWidth);
        const area = Number(item.area ?? (length && width ? (length * width) / 10000 : item.quantity ?? 0)) || 0;

        return {
            ...item,
            product: product || item.product,
            partName: item.partName || product?.name || item.productName || '',
            lengthCM: length,
            widthCM: width,
            area
        };
    }));

    return {
        ...invoice,
        customer: customer || invoice.customer,
        carModel: hydratedCarModel,
        items
    };
};

// Get Next Invoice Number
router.get('/number/next', async (req, res, next) => {
    try {
        const nextNumber = await salesService.generateInvoiceNumber();
        console.log('salesRoutes: number/next requested ->', nextNumber);
        res.json({ nextNumber });
    } catch (error) {
        console.error('Error getting next invoice number:', error);
        res.status(500).json({ error: 'فشل جلب رقم الفاتورة التالي' });
    }
});

// Get Window Film Packages (MUST be before /:id route)
router.get('/window-film-packages', authenticateToken, async (req, res, next) => {
    try {
        const packages = await db.find('windowFilmPackages');
        res.json(packages);
    } catch (error) {
        console.error('Error fetching window film packages:', error);
        res.status(500).json({ error: 'فشل جلب باقات وندو فيلم' });
    }
});

// 1. Get All Sales Invoices
router.get('/', async (req, res, next) => {
    try {
        const invoices = await db.find('salesinvoices');
        // Sort manually since FileDatabaseManager doesn't have sort method
        invoices.sort((a, b) => new Date(b.date || 0) - new Date(a.date || 0));
        const hydrated = await Promise.all(invoices.map(hydrateSalesInvoice));
        res.json(hydrated);
    } catch (error) {
        console.error('Error getting sales invoices:', error);
        res.status(500).json({ error: 'فشل جلب فواتير المبيعات' });
    }
});

// 2. Get Sales Invoice by ID
router.get('/:id', async (req, res, next) => {
    try {
        const invoice = await db.findOne('salesinvoices', { _id: req.params.id });
        if (!invoice) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        const hydrated = await hydrateSalesInvoice(invoice);
        res.json(hydrated);
    } catch (error) {
        console.error('Error getting sales invoice:', error);
        res.status(500).json({ error: 'فشل جلب الفاتورة' });
    }
});

// 3. Create Sales Invoice
router.post('/', async (req, res, next) => {
    try {
        console.log('📥 Creating sales invoice with data:', JSON.stringify(req.body, null, 2));

        // Validation
        if (!req.body.customer) {
            return res.status(400).json({ error: 'العميل مطلوب' });
        }

        if (!req.body.items || req.body.items.length === 0) {
            return res.status(400).json({ error: 'المنتجات مطلوبة' });
        }

        if (req.body.invoiceNumber) {
            const existingInvoice = await db.findOne('salesinvoices', { invoiceNumber: req.body.invoiceNumber });
            if (existingInvoice) {
                return res.status(400).json({ error: 'رقم الفاتورة مكرر، اختر رقمًا آخر' });
            }
        }

        const newInvoice = await salesService.createSalesInvoice(req.body);

        res.status(201).json({
            success: true,
            message: 'تم حفظ الفاتورة والقيود المخزنية والمحاسبية بنجاح',
            invoice: newInvoice
        });
    } catch (error) {
        console.error('❌ Error creating sales invoice:', error);
        res.status(500).json({ error: 'فشل إنشاء فاتورة المبيعات: ' + error.message });
    }
});


// 4. Update Sales Invoice
router.put('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const updateData = {
            ...req.body,
            updatedAt: new Date().toISOString()
        };

        if (updateData.invoiceNumber) {
            const existingInvoice = await db.findOne('salesinvoices', { invoiceNumber: updateData.invoiceNumber });
            if (existingInvoice && existingInvoice._id !== req.params.id) {
                return res.status(400).json({ error: 'رقم الفاتورة مكرر، اختر رقمًا آخر' });
            }
        }

        const updatedInvoice = await db.updateOne('salesinvoices', { _id: req.params.id }, updateData);
        if (!updatedInvoice) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        res.json(updatedInvoice);
    } catch (error) {
        console.error('Error updating sales invoice:', error);
        res.status(500).json({ error: 'فشل تحديث الفاتورة' });
    }
});

// 6. Delete Sales Invoice
router.delete('/:id', authenticateToken, requireAdmin, async (req, res, next) => {
    try {
        const deleted = await db.deleteOne('salesinvoices', { _id: req.params.id });
        if (!deleted) {
            return res.status(404).json({ error: 'الفاتورة غير موجودة' });
        }
        res.json({ message: 'تم حذف الفاتورة بنجاح' });
    } catch (error) {
        console.error('Error deleting sales invoice:', error);
        res.status(500).json({ error: 'فشل حذف الفاتورة' });
    }
});

module.exports = router;
