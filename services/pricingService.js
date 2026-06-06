const fs = require('fs');
const path = require('path');
const FileDatabaseManager = require('../file_db_manager');
const Product = require('../models/Product');

const db = new FileDatabaseManager();

const VAT_RATE = 0.14;
const WHT_RATE = 0.01;
const MAX_DISCOUNT_RATIO = 0.30;

const MATRIX_PATH = path.join(__dirname, '../data_storage/pricingmatrices/pricing_matrix.json');

const toNumber = (value) => {
    const n = parseFloat(value);
    return Number.isFinite(n) ? n : 0;
};

const round2 = (value) => Number(toNumber(value).toFixed(2));

function loadPricingMatrix() {
    try {
        if (!fs.existsSync(MATRIX_PATH)) return [];
        return JSON.parse(fs.readFileSync(MATRIX_PATH, 'utf8'));
    } catch (error) {
        console.error('loadPricingMatrix error:', error.message);
        return [];
    }
}

function savePricingMatrix(matrix) {
    const dir = path.dirname(MATRIX_PATH);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(MATRIX_PATH, JSON.stringify(matrix, null, 2), 'utf8');
    return { success: true };
}

function normalizeKey(value = '') {
    return String(value || '').trim().toLowerCase();
}

function getWindowFilmPrice(vehicleCategory, partName, grade = null) {
    const matrix = loadPricingMatrix();
    const entry = matrix.find((e) =>
        normalizeKey(e.carSize) === normalizeKey(vehicleCategory) &&
        normalizeKey(e.partName) === normalizeKey(partName)
    );

    if (!entry) return 0;

    let netPrice = 0;
    if (entry.netPrice) {
        netPrice = toNumber(entry.netPrice);
    } else if (entry.inclusivePrice) {
        netPrice = toNumber(entry.inclusivePrice) / (1 + VAT_RATE);
    }

    if (grade != null && entry.gradeFactors) {
        const factor = toNumber(entry.gradeFactors[String(grade)] ?? entry.gradeFactors[grade] ?? 1);
        if (factor > 0) netPrice *= factor;
    }

    return round2(netPrice);
}

async function findProduct(identifier) {
    if (!identifier) return null;
    const value = typeof identifier === 'object' ? identifier?._id : identifier;
    if (!value) return null;

    const lookups = [
        { _id: value },
        { inventorySlug: value },
        { code: value },
        { barcode: value }
    ];

    for (const query of lookups) {
        try {
            const product = await Product.findOne(query);
            if (product) return product;
        } catch (error) {
            break;
        }
    }

    const products = await db.find('products');
    return products.find((p) =>
        String(p._id) === String(value) ||
        String(p.inventorySlug) === String(value) ||
        String(p.code) === String(value) ||
        String(p.barcode) === String(value)
    ) || null;
}

async function findProducts() {
    try {
        return await Product.find();
    } catch (error) {
        return await db.find('products');
    }
}

function normalizeItemArgs(productOrItem, quantity, area, vehicleCategory, partName, grade) {
    if (productOrItem && typeof productOrItem === 'object' && !Array.isArray(productOrItem)) {
        return {
            item: productOrItem,
            context: quantity && typeof quantity === 'object' ? quantity : {}
        };
    }

    return {
        item: {
            product: productOrItem,
            quantity,
            area,
            partName,
            grade
        },
        context: { vehicleCategory }
    };
}

async function getItemPrice(productOrItem, requestedQuantity = 1, requestedArea = 0, requestedVehicleCategory = 'Sedan', requestedPartName = '', requestedGrade = null) {
    const { item, context } = normalizeItemArgs(
        productOrItem,
        requestedQuantity,
        requestedArea,
        requestedVehicleCategory,
        requestedPartName,
        requestedGrade
    );
    const effectiveVehicleCategory = context.vehicleCategory || context.vehicleType || item.vehicleCategory || 'Sedan';
    const resolvedPartName = item.partName || item.productName || '';
    const effectiveGrade = item.grade ?? item.wfGrade ?? null;
    const serviceType = item.materialCategory || item.serviceType || item.category || item.prodType || '';
    const effectiveArea = toNumber(item.area || item.areaM2);
    const effectiveQuantity = effectiveArea > 0 ? effectiveArea : toNumber(item.quantity || 1);

    const serviceLower = normalizeKey(serviceType);
    const isWindowFilm = serviceLower.includes('window') || serviceLower.includes('film') || serviceLower.includes('عزل');

    if (isWindowFilm && resolvedPartName) {
        const unitPrice = getWindowFilmPrice(effectiveVehicleCategory, resolvedPartName, effectiveGrade);
        return round2(unitPrice * (effectiveArea > 0 ? effectiveArea : 1));
    }

    const directProduct = await findProduct(item.product || item.productId || item._id);
    if (directProduct?.pricing) {
        let unitPrice = toNumber(directProduct.pricing.priceWithoutVat);
        if (!unitPrice && directProduct.pricing.salePrice) {
            unitPrice = toNumber(directProduct.pricing.salePrice) / (1 + VAT_RATE);
        }
        if (!unitPrice && directProduct.pricing.unitSalePrice) {
            unitPrice = toNumber(directProduct.pricing.unitSalePrice) / (1 + VAT_RATE);
        }
        return round2(unitPrice * effectiveQuantity);
    }

    const products = await findProducts();
    const categoryProduct = products.find((p) => {
        const categoryLower = normalizeKey(serviceType);
        const fields = [p.category, p.type, p.serviceCategory, p.name].map(normalizeKey);
        return fields.some((f) => f === categoryLower || f.includes(categoryLower) || categoryLower.includes(f));
    });

    if (categoryProduct?.pricing) {
        let unitPrice = toNumber(categoryProduct.pricing.priceWithoutVat);
        if (!unitPrice && categoryProduct.pricing.salePrice) {
            unitPrice = toNumber(categoryProduct.pricing.salePrice) / (1 + VAT_RATE);
        }
        return round2(unitPrice * effectiveQuantity);
    }

    return 0;
}

async function calculateCommission(salesPersonId, invoiceTotal) {
    if (!salesPersonId) return 0;
    const agents = await db.find('agents');
    const agent = agents.find((a) => String(a._id) === String(salesPersonId));
    if (!agent) return round2(toNumber(invoiceTotal) * 0.05);

    const commissionType = String(agent.commissionType || 'percentage').toLowerCase();
    const commissionValue = toNumber(agent.commissionValue);
    if (commissionType === 'fixed') return round2(commissionValue);
    return round2(toNumber(invoiceTotal) * (commissionValue / 100));
}

function validateDiscount(customerId, discountAmount, invoiceTotal) {
    const discount = toNumber(discountAmount);
    const total = toNumber(invoiceTotal);
    if (discount < 0) return { valid: false, error: 'الخصم لا يمكن أن يكون سالباً' };
    if (total <= 0) return { valid: true, maxDiscount: 0 };
    const ratio = discount / total;
    if (ratio > MAX_DISCOUNT_RATIO) {
        return {
            valid: false,
            error: `الخصم يتجاوز الحد الأقصى (${MAX_DISCOUNT_RATIO * 100}%)`,
            maxDiscount: round2(total * MAX_DISCOUNT_RATIO)
        };
    }
    return { valid: true, maxDiscount: round2(total * MAX_DISCOUNT_RATIO) };
}

async function calculateInvoice(invoiceData) {
    const items = invoiceData.items || [];
    const extraCost = toNumber(invoiceData.extraCost ?? invoiceData.totalExtraCosts);
    const discount = toNumber(invoiceData.discount ?? invoiceData.totalDiscount);
    const hasWht = invoiceData.hasWht === true || invoiceData.hasWht === 'true';
    const vehicleCategory = invoiceData.vehicleType || invoiceData.vehicleCategory || 'Sedan';
    const salesPersonId = invoiceData.salesPerson || invoiceData.salesPersonId;

    const context = { vehicleCategory, vehicleType: vehicleCategory };

    const pricedItems = [];
    let subtotal = 0;

    for (const item of items) {
        const lineTotal = await getItemPrice(item, context);
        subtotal += lineTotal;
        pricedItems.push({
            ...item,
            unitPrice: areaQty(item) > 0 ? round2(lineTotal / areaQty(item)) : lineTotal,
            lineTotal,
            price: lineTotal
        });
    }

    subtotal = round2(subtotal);
    const taxable = round2(Math.max(0, subtotal + extraCost - discount));
    const vat = round2(taxable * VAT_RATE);
    const totalWithVat = round2(taxable + vat);
    const wht = hasWht ? round2(subtotal * WHT_RATE) : 0;
    const finalTotal = round2(totalWithVat - wht);
    const netAmount = taxable;

    const discountCheck = validateDiscount(invoiceData.customer, discount, subtotal + extraCost);
    const agentCommission = await calculateCommission(salesPersonId, finalTotal);

    return {
        items: pricedItems,
        subtotal,
        taxable,
        netAmount,
        vat,
        vatAmount: vat,
        totalTax: vat,
        totalWithVat,
        wht,
        whtAmount: wht,
        finalTotal,
        totalAmount: finalTotal,
        totalExtraCosts: extraCost,
        totalDiscount: discount,
        agentCommission,
        commission: agentCommission,
        discountValid: discountCheck.valid,
        discountError: discountCheck.error || null,
        maxDiscount: discountCheck.maxDiscount
    };
}

function areaQty(item) {
    const area = toNumber(item?.area || item?.areaM2);
    if (area > 0) return area;
    return toNumber(item?.quantity || 1);
}

module.exports = {
    VAT_RATE,
    WHT_RATE,
    MAX_DISCOUNT_RATIO,
    loadPricingMatrix,
    savePricingMatrix,
    getWindowFilmPrice,
    getItemPrice,
    calculateCommission,
    validateDiscount,
    calculateInvoice
};
