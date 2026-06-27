'use strict';

/**
 * pricingService.js  — Single Source of Truth للحسابات المالية
 *
 * القاعدة الذهبية:
 *   السعر الشامل = صافي × 1.14
 *   الصافي       = شامل / 1.14
 *   الضريبة      = شامل - صافي
 *
 * لا يُسمح لأي ملف آخر (Route / Frontend) بإجراء حسابات ضريبية.
 * كل عملية مالية يجب أن تمر عبر calculateFinancials أو calculateInvoice.
 */

const fs   = require('fs');
const path = require('path');

// ── الثوابت ────────────────────────────────────────────────────────────────
const VAT_RATE          = 0.14;   // ضريبة القيمة المضافة
const WHT_RATE          = 0.01;   // ضريبة الخصم من المنبع
const MAX_DISCOUNT_RATIO = 0.30;  // أقصى نسبة خصم مسموح بها
const DEFAULT_COMMISSION = 0.05;  // عمولة افتراضية 5%

const MATRIX_PATH = path.join(__dirname, '..', 'data_storage', 'pricing_matrix.json');

// ── قاعدة البيانات (lazy — بدون cache لضمان عمل الـ mocks في الـ tests) ──
function getDb() {
    const FileDatabaseManager = require('../file_db_manager');
    return new FileDatabaseManager();
}

// ── Product model (lazy) ───────────────────────────────────────────────────
function getProduct() {
    return require('../models/Product');
}

// ═══════════════════════════════════════════════════════════════════════════
// 1. المحرك المركزي  (Central Tax Engine)
// ═══════════════════════════════════════════════════════════════════════════

/**
 * calculateFinancials(totalInclusive)
 * المدخل: السعر شامل الضريبة
 * المخرج: { total, net, vat }
 */
function calculateFinancials(totalInclusive) {
    const total = parseFloat(totalInclusive) || 0;
    const net   = parseFloat((total / (1 + VAT_RATE)).toFixed(2));
    const vat   = parseFloat((total - net).toFixed(2));
    return {
        total: parseFloat(total.toFixed(2)),
        net,
        vat
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// 2. مصفوفة التسعير (Pricing Matrix — Window Film)
// ═══════════════════════════════════════════════════════════════════════════

function loadPricingMatrix() {
    try {
        if (!fs.existsSync(MATRIX_PATH)) return [];
        const raw = fs.readFileSync(MATRIX_PATH, 'utf8');
        const parsed = JSON.parse(raw);
        return Array.isArray(parsed) ? parsed : [];
    } catch {
        return [];
    }
}

function savePricingMatrix(matrix) {
    try {
        const dir = path.dirname(MATRIX_PATH);
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
        fs.writeFileSync(MATRIX_PATH, JSON.stringify(matrix, null, 2), 'utf8');
        return { success: true };
    } catch (err) {
        return { success: false, error: err.message };
    }
}

/**
 * getWindowFilmPrice(carSize, partName, grade?)
 * يجلب السعر الصافي (بدون ضريبة) من مصفوفة التسعير
 */
function getWindowFilmPrice(carSize, partName, grade) {
    const matrix = loadPricingMatrix();
    const safeSize = String(carSize  || '').toLowerCase().trim();
    const safePart = String(partName || '').toLowerCase().trim();

    const entry = matrix.find(row =>
        String(row.carSize  || '').toLowerCase().trim() === safeSize &&
        String(row.partName || '').toLowerCase().trim() === safePart
    );

    if (!entry) return 0;

    // سعر صافي مباشر
    if (entry.netPrice) {
        const base = parseFloat(entry.netPrice) || 0;
        // تطبيق معامل الدرجة إن وُجد
        if (grade && entry.gradeFactors && entry.gradeFactors[String(grade)]) {
            return parseFloat((base * entry.gradeFactors[String(grade)]).toFixed(2));
        }
        return base;
    }

    // سعر شامل → نحوّله لصافي
    if (entry.inclusivePrice) {
        return parseFloat((parseFloat(entry.inclusivePrice) / (1 + VAT_RATE)).toFixed(2));
    }

    return 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 3. التحقق من الخصم
// ═══════════════════════════════════════════════════════════════════════════

/**
 * validateDiscount(salesPersonId, discountAmount, subtotal)
 * يتحقق من أن الخصم لا يتجاوز MAX_DISCOUNT_RATIO
 */
function validateDiscount(salesPersonId, discountAmount, subtotal) {
    const discount = parseFloat(discountAmount) || 0;
    const base     = parseFloat(subtotal) || 0;

    if (discount < 0) {
        return { valid: false, error: 'الخصم لا يمكن أن يكون سالباً', maxDiscount: 0 };
    }

    const maxDiscount = parseFloat((base * MAX_DISCOUNT_RATIO).toFixed(2));

    if (base === 0) {
        return { valid: true, maxDiscount: 0 };
    }

    if (discount > maxDiscount) {
        return {
            valid: false,
            error: `الخصم يتجاوز الحد الأقصى المسموح به (30%)`,
            maxDiscount
        };
    }

    return { valid: true, maxDiscount };
}

// ═══════════════════════════════════════════════════════════════════════════
// 4. حساب العمولة
// ═══════════════════════════════════════════════════════════════════════════

/**
 * calculateCommission(salesPersonId, netAmount)
 * يجلب العمولة من قاعدة البيانات أو يرجع الافتراضية
 */
async function calculateCommission(salesPersonId, netAmount) {
    if (!salesPersonId) return 0;

    const net = parseFloat(netAmount) || 0;

    try {
        const db     = getDb();
        const agents = await db.find('agents');
        const agent  = (agents || []).find(a => String(a._id) === String(salesPersonId));

        if (!agent) {
            return parseFloat((net * DEFAULT_COMMISSION).toFixed(2));
        }

        const type  = String(agent.commissionType  || 'percentage').toLowerCase();
        const value = parseFloat(agent.commissionValue) || 0;

        if (type === 'fixed') {
            return parseFloat(value.toFixed(2));
        }

        return parseFloat((net * (value / 100)).toFixed(2));

    } catch {
        return parseFloat((net * DEFAULT_COMMISSION).toFixed(2));
    }
}

// ═══════════════════════════════════════════════════════════════════════════
// 5. سعر البند الواحد
// ═══════════════════════════════════════════════════════════════════════════

/**
 * getItemPrice(item, vehicleType?)
 * يحسب السعر الصافي لبند واحد من الفاتورة
 * المخرج: رقم (سعر الوحدة صافي)
 *
 * ترتيب الأولوية:
 *   1. Window Film → من مصفوفة التسعير
 *   2. product ID  → من Product model (findOne)
 *   3. product ID  → من db.find (fallback)
 *   4. category    → أول منتج في الفئة
 *   5. item.price  → السعر المُرسَل مباشرة
 */
async function getItemPrice(item, vehicleType) {
    if (!item) return 0;

    const category  = String(item.materialCategory || item.category || '').toLowerCase();
    const productId = typeof item.product === 'object' ? item.product?._id : item.product;

    // 1. Window Film → مصفوفة التسعير
    if (category.includes('window') || category.includes('film')) {
        const matrixPrice = getWindowFilmPrice(
            vehicleType || item.vehicleCategory || item.vehicleType || '',
            item.partName || '',
            item.grade
        );
        if (matrixPrice > 0) return matrixPrice;
    }

    // 2. Product ID → Product.findOne
    if (productId) {
        try {
            const Product = getProduct();
            const product = await Product.findOne({ _id: String(productId) });
            if (product) {
                const rawPrice = product.pricing?.priceWithoutVat
                    || product.pricing?.salePrice
                    || product.price
                    || 0;
                const p = parseFloat(rawPrice) || 0;
                if (p > 0) return p;
            }
        } catch { /* silent */ }

        // 3. Product ID → db.find fallback
        try {
            const db       = getDb();
            const products = await db.find('products');
            const product  = (products || []).find(p => String(p._id) === String(productId));
            if (product) {
                const rawPrice = product.pricing?.priceWithoutVat
                    || product.pricing?.salePrice
                    || product.price
                    || 0;
                const p = parseFloat(rawPrice) || 0;
                if (p > 0) return p;
            }
        } catch { /* silent */ }
    }

    // 4. category → أول منتج في الفئة
    if (category) {
        try {
            const Product  = getProduct();
            const products = await Product.find({ category });
            if (products && products.length > 0) {
                const rawPrice = products[0].pricing?.priceWithoutVat
                    || products[0].pricing?.salePrice
                    || products[0].price
                    || 0;
                const p = parseFloat(rawPrice) || 0;
                if (p > 0) return p;
            }
        } catch { /* silent */ }
    }

    // 5. item.price كـ fallback أخير
    if (item.price && parseFloat(item.price) > 0) {
        return parseFloat(item.price);
    }

    return 0;
}

// ═══════════════════════════════════════════════════════════════════════════
// 6. حساب الفاتورة الكاملة  ← القلب
// ═══════════════════════════════════════════════════════════════════════════

/**
 * calculateInvoice(data)
 *
 * المدخل: بيانات الفاتورة الخام من الـ Route
 * المخرج: كائن كامل بجميع الحقول المالية جاهزة للحفظ
 */
async function calculateInvoice(data) {
    const items       = Array.isArray(data?.items) ? data.items : [];
    const vehicleType = data?.vehicleType || '';
    const discountIn  = parseFloat(data?.discount || data?.totalDiscount || 0);
    const extraCosts  = parseFloat(data?.extraCosts || data?.totalExtraCosts || 0);
    const hasWht      = Boolean(data?.hasWht);
    const salesPersonId = data?.salesPerson || data?.salesPersonId || null;

    // ── حساب إجمالي البنود (صافي) ──────────────────────────────
    const enrichedItems = await Promise.all(items.map(async (item) => {
        const unitPrice = await getItemPrice(item, vehicleType);
        
        // حساب المساحة إذا لم تكن موجودة وتم توفير الطول والعرض
        let qty = parseFloat(item.area || item.quantity || 1) || 1;
        if ((!item.area || item.area === 0) && item.lengthCM > 0 && item.widthCM > 0) {
            qty = parseFloat(((item.lengthCM * item.widthCM) / 10000).toFixed(4));
        }

        const lineTotal = parseFloat((unitPrice * qty).toFixed(2));
        return {
            ...item,
            price:     unitPrice,
            quantity:  qty,
            area:      item.area || qty,
            lineTotal,
            total:     lineTotal
        };
    }));

    const subtotal = parseFloat(
        enrichedItems.reduce((s, i) => s + (i.lineTotal || 0), 0).toFixed(2)
    );

    // ── التحقق من الخصم ─────────────────────────────────────────
    const discountValidation = validateDiscount(salesPersonId, discountIn, subtotal);
    const discount = discountValidation.valid ? discountIn : 0;

    // ── الوعاء الضريبي = صافي - خصم + تكاليف إضافية ───────────
    const taxable = parseFloat(
        Math.max(0, subtotal - discount + extraCosts).toFixed(2)
    );

    // ── الضريبة (14% من الوعاء) ─────────────────────────────────
    const vat          = parseFloat((taxable * VAT_RATE).toFixed(2));
    const vatAmount    = vat;
    const totalWithVat = parseFloat((taxable + vat).toFixed(2));

    // ── ضريبة الخصم من المنبع (1% من الوعاء) ────────────────────
    const wht = hasWht
        ? parseFloat((taxable * WHT_RATE).toFixed(2))
        : 0;

    // ── الإجمالي النهائي ─────────────────────────────────────────
    const finalTotal = parseFloat((totalWithVat - wht).toFixed(2));
    const netAmount  = taxable;

    // ── العمولة ──────────────────────────────────────────────────
    const agentCommission = await calculateCommission(salesPersonId, netAmount);

    return {
        // بنود مُحسَّبة
        items: enrichedItems,

        // حقول الإجماليات
        subtotal,
        taxable,
        netAmount,
        totalDiscount:   parseFloat(discount.toFixed(2)),
        totalExtraCosts: parseFloat(extraCosts.toFixed(2)),
        vat,
        vatAmount,
        totalWithVat,
        wht,
        finalTotal,

        // عمولة الوكيل
        agentCommission,

        // صحة الخصم
        discountValid: discountValidation.valid,

        // تفاصيل إضافية للـ GL
        totalAmount:  totalWithVat,
        finalAmount:  finalTotal
    };
}

// ═══════════════════════════════════════════════════════════════════════════
// الصادرات
// ═══════════════════════════════════════════════════════════════════════════
module.exports = {
    // الثوابت
    VAT_RATE,
    WHT_RATE,
    MAX_DISCOUNT_RATIO,

    // المحرك المركزي
    calculateFinancials,

    // مصفوفة التسعير
    loadPricingMatrix,
    savePricingMatrix,
    getWindowFilmPrice,

    // التحقق
    validateDiscount,

    // الحسابات
    calculateCommission,
    getItemPrice,
    calculateInvoice
};
