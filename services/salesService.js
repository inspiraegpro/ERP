const SalesInvoice = require('../models/SalesInvoice');
const Customer = require('../models/Customer');
const Car = require('../models/Car');
const ServiceJob = require('../models/ServiceJob');
const Product = require('../models/Product');
const FileDatabaseManager = require('../file_db_manager');
const { createGlEntry } = require('./glService');
const glLogic = require('./glLogic');

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

async function createSalesInvoice(data) {
    const totalWithVat = toNumber(data.totalAmount);
    const vatRate = 0.14;
    const netAmount = Number((totalWithVat / (1 + vatRate)).toFixed(2));
    const vatAmount = Number((totalWithVat - netAmount).toFixed(2));
    const agentCommission = data.agentCommission || (totalWithVat * 0.05);

    const normalizedInvoice = {
        invoiceNumber: data.invoiceNumber || await generateInvoiceNumber(),
        customer: data.customer,
        customerName: data.customerName || data.customer?.name,
        carModel: data.carModel,
        items: data.items || [],
        totalAmount: totalWithVat,
        vat: vatAmount,
        discount: toNumber(data.discount),
        finalAmount: totalWithVat,
        paymentMethod: data.paymentMethod || 'Cash',
        salesPersonId: data.salesPersonId,
        salesPersonName: data.salesPersonName,
        agentCommission: agentCommission,
        date: data.date || new Date().toISOString(),
        status: 'active',
        glStatus: 'pending',
        glErrorMessage: null,
        createdAt: new Date().toISOString()
    };

    const invoice = await SalesInvoice.create(normalizedInvoice);
    if (!invoice) throw new Error('Failed to create sales invoice');

    let glStatus = 'synced';
    let glErrorMessage = null;
    try {
        const glData = glLogic.generateSalesGl(invoice);
        await createGlEntry(glData);
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
        const productId = typeof item.product === 'object' ? item.product._id : item.product;
        let materialCategory = item.materialCategory || item.category || item.serviceType || '';
        
        // If product exists, get its category information
        if (productId) {
            try {
                const product = await db.findOne('products', { _id: productId });
                if (product) {
                    materialCategory = materialCategory || product.category || product.type || product.serviceCategory || '';
                }
            } catch (error) {
                console.error('Error fetching product for category in salesService:', error);
            }
        }
        
        return {
            ...item,
            partName: item.partName || item.productName || item.description || '',
            materialCategory,
            lengthCM: item.lengthCM || item.length || 0,
            widthCM: item.widthCM || item.width || 0,
            area: item.area || 0,
            issueStatus: 'Pending',
            product: productId
        };
    }));

    // Create service job with proper structure
    await ServiceJob.create({
        salesInvoiceId: invoice._id,
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

async function streamProcess(processor, query = {}) { return await SalesInvoice.streamProcess(processor, query); }
async function streamAggregate(aggregators, query = {}) { return await SalesInvoice.streamAggregate(aggregators, query); }
async function getDailySummary(date) { return await SalesInvoice.getDailySummary(date); }
async function getDateRangeSummary(fromDate, toDate) { return await SalesInvoice.getDateRangeSummary(fromDate, toDate); }

module.exports = {
    generateInvoiceNumber, createSalesInvoice, findAll, findOne, updateOne, deleteOne, count,
    streamProcess, streamAggregate, getDailySummary, getDateRangeSummary
};
