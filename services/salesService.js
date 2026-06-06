const SalesInvoice = require('../models/SalesInvoice');
const Customer = require('../models/Customer');
const Car = require('../models/Car');
const ServiceJob = require('../models/ServiceJob');
const Product = require('../models/Product');
const FileDatabaseManager = require('../file_db_manager');
const journalService = require('./journalService');
const pricingService = require('./pricingService');

const db = new FileDatabaseManager();

const toNumber = (value) => {
    const parsed = parseFloat(value);
    return Number.isFinite(parsed) ? parsed : 0;
};

async function generateInvoiceNumber() {
    try {
        const count = await SalesInvoice.countDocuments();
        return `INV-${String(count + 1).padStart(5, '0')}`;
    } catch (error) {
        return `INV-${Date.now()}`;
    }
}

async function createSalesInvoice(data, user) {
    const calculated = await pricingService.calculateInvoice(data);

    const totalWithVat = calculated.finalTotal;
    const netAmount = calculated.netAmount;
    const vatAmount = calculated.vat;
    const agentCommission = calculated.agentCommission;

    const normalizedInvoice = {
        invoiceNumber:   data.invoiceNumber || await generateInvoiceNumber(),
        customer:        data.customer,
        customerName:    data.customerName || data.customer?.name,
        carModel:        data.carModel,
        items:           calculated.items || data.items || [],
        subtotal:        calculated.subtotal,
        totalExtraCosts: calculated.totalExtraCosts,
        totalDiscount:   calculated.totalDiscount,
        totalTax:        vatAmount,
        whtAmount:       calculated.wht,
        netAmount:       netAmount,
        totalAmount:     totalWithVat,
        vat:             vatAmount,
        discount:        calculated.totalDiscount,
        finalAmount:     totalWithVat,
        finalTotal:      totalWithVat,
        paymentMethod:   data.paymentMethod || 'Cash',
        salesPersonId:   data.salesPerson   || data.salesPersonId,
        salesPersonName: data.salesPersonName,
        commissionRate:  toNumber(data.commissionRate),
        commissionType:  data.commissionType  || 'percentage',
        commissionValue: toNumber(data.commissionValue),
        agentCommission: agentCommission,
        serviceType:     data.serviceType || '',
        vehicleType:     data.vehicleType  || '',
        vehicleModel:    data.vehicleModel || '',
        vehiclePlate:    data.vehiclePlate || '',
        vehicleColor:    data.vehicleColor || '',
        date:            data.date || new Date().toISOString(),
        status:          'active',
        glStatus:        'pending',
        glErrorMessage:  null,
        createdAt:       new Date().toISOString()
    };

    await journalService.archiveBeforeMutation({
        transactionType: 'SALES_INVOICE',
        transactionCollection: 'salesinvoices',
        referenceNumber: normalizedInvoice.invoiceNumber,
        incomingPayload: normalizedInvoice,
        user,
        action: 'CREATE'
    });

    const invoice = await SalesInvoice.create(normalizedInvoice);
    if (!invoice) throw new Error('Failed to create sales invoice');

    let glStatus = 'synced';
    let glErrorMessage = null;
    try {
        await journalService.syncSalesJournal({
            ...invoice,
            subtotal:        calculated.subtotal,
            totalExtraCosts: calculated.totalExtraCosts,
            totalDiscount:   calculated.totalDiscount,
            totalWithVat:    totalWithVat,
            finalTotal:      totalWithVat,
            vatAmount:       vatAmount,
            netAmount:       netAmount,
            whtAmount:       calculated.wht,
            customerName:    invoice.customerName || ''
        }, user);
    } catch (glError) {
        glStatus = 'pending_manual_entry';
        glErrorMessage = glError.message;
    }

    await SalesInvoice.updateOne({ _id: invoice._id }, { glStatus, glErrorMessage });

    try {
        const invoiceDate = normalizedInvoice.date?.split('T')[0] || new Date().toISOString().split('T')[0];
        const categories = { PPF: 0, 'Window Film': 0, Polish: 0, Other: 0 };
        (normalizedInvoice.items || []).forEach(item => {
            const category = item.category || item.materialCategory || 'Other';
            const itemRevenue = (item.price || 0) * (item.quantity || 1);
            if (category.includes('PPF') || category.includes('Paint')) categories.PPF += itemRevenue;
            else if (category.includes('Window') || category.includes('Tint')) categories['Window Film'] += itemRevenue;
            else if (category.includes('Polish') || category.includes('Ceramic')) categories.Polish += itemRevenue;
            else categories.Other += itemRevenue;
        });
        await SalesInvoice.updateDailySummary(invoiceDate, {
            invoiceCount: 1, totalRevenue: totalWithVat, totalNet: netAmount, totalTax: vatAmount,
            categories, agent: normalizedInvoice.salesPersonName || 'غير محدد', commission: agentCommission
        });
    } catch (summaryError) {
        console.error('Daily summary error:', summaryError.message);
    }

    let customerName = normalizedInvoice.customerName || '';
    if (!customerName && normalizedInvoice.customer) {
        const customerId = typeof normalizedInvoice.customer === 'object' ? normalizedInvoice.customer._id : normalizedInvoice.customer;
        const cust = await Customer.findOne({ _id: customerId });
        if (cust) customerName = cust.name;
    }

    let carDisplayName = '';
    const carId = typeof normalizedInvoice.carModel === 'object' ? normalizedInvoice.carModel._id : normalizedInvoice.carModel;
    if (carId) {
        const car = await Car.findOne({ _id: carId });
        if (car) carDisplayName = `${car.make || ''} ${car.model || ''} ${car.year || ''}`.trim();
    }

    // Hydrate invoice items with product data for service job
    const hydratedItems = await Promise.all((normalizedInvoice.items || []).map(async (item) => {
        let productId = typeof item.product === 'object' ? item.product._id : item.product;
        let materialCategory = item.materialCategory || item.category || item.serviceType || '';

        if (productId) {
            try {
                // أولاً: ابحث بالـ _id
                let product = await db.findOne('products', { _id: productId });

                // إذا مش لاقيه بالـ _id، ابحث بالـ slug أو الاسم (legacy data)
                if (!product) {
                    product = await db.findOne('products', { inventorySlug: productId });
                }
                if (!product) {
                    product = await db.findOne('products', { code: productId });
                }
                if (!product) {
                    // بحث بالاسم كـ fallback أخير
                    const allProds = await db.find('products');
                    product = allProds.find(p =>
                        String(p.name || '').toLowerCase() === String(productId).toLowerCase()
                    ) || null;
                }

                if (product) {
                    productId = product._id;   // ← استبدل الـ slug بالـ _id الحقيقي
                    materialCategory = materialCategory
                        || product.category
                        || product.type
                        || product.serviceCategory
                        || '';
                }
            } catch (error) {
                console.error('Error resolving product in salesService:', error);
            }
        }

        return {
            ...item,
            product:          productId,   // دائماً _id وليس slug
            partName:         item.partName || item.productName || item.description || '',
            materialCategory,
            lengthCM:         item.lengthCM || item.length || 0,
            widthCM:          item.widthCM  || item.width  || 0,
            area:             item.area     || 0,
            issueStatus:      'Pending'
        };
    }));

    // حدّث items في الفاتورة المحفوظة بالـ IDs الصحيحة
    await SalesInvoice.updateOne({ _id: invoice._id }, { items: hydratedItems });

    // Create service job with proper structure
    const serviceJob = await ServiceJob.create({
        salesInvoiceId: invoice._id,
        invoiceNumber: invoice.invoiceNumber,   // رقم الفاتورة — المفتاح المشترك مع إذن الصرف
        jobOrder: invoice.invoiceNumber,
        date: normalizedInvoice.date,
        customer: normalizedInvoice.customer,
        customerName: customerName,
        carModel: normalizedInvoice.carModel,
        carName: carDisplayName,
        serviceType: (normalizedInvoice.items[0]?.productName) || 'General Service',
        status: 'PENDING_OPS',
        workflowStatus: 'AwaitingTechnician',
        items: hydratedItems
    });

    // ربط الفاتورة بأمر التشغيل فور إنشائه
    if (serviceJob && serviceJob._id) {
        await SalesInvoice.updateOne(
            { _id: invoice._id },
            { serviceJobId: serviceJob._id }
        );
        // أضف serviceJobId للـ object المُرجَع حتى لا يحتاج المستدعي لإعادة جلبه
        invoice.serviceJobId = serviceJob._id;
    }

    if (normalizedInvoice.customer) {
        const customerId = typeof normalizedInvoice.customer === 'object' ? normalizedInvoice.customer._id : normalizedInvoice.customer;
        const customer = await Customer.findOne({ _id: customerId });
        if (customer) {
            await Customer.updateOne({ _id: customerId }, { balance: (customer.balance || 0) + normalizedInvoice.finalAmount });
        }
    }

    return invoice;
}

async function findAll(query = {}) { return await SalesInvoice.find(query); }
async function findOne(query) { return await SalesInvoice.findOne(query); }
async function updateOne(id, data) { return await SalesInvoice.updateOne({ _id: id }, data); }
async function deleteOne(id) { return await SalesInvoice.deleteOne({ _id: id }); }
async function count(query = {}) { return await SalesInvoice.countDocuments(query); }

module.exports = {
    generateInvoiceNumber, createSalesInvoice, findAll, findOne, updateOne, deleteOne, count
};
