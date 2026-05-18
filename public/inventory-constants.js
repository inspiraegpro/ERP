/**
 * inventory-constants.js
 * ملف الثوابت المركزي لوحدة المخزون — Wrapstyle ERP
 * استخدم: <script src="/inventory-constants.js"></script>
 */

const INVENTORY = {

    // ── الضرائب ──────────────────────────────────────────────────────
    VAT_RATE:  0.14,   // ضريبة القيمة المضافة 14%
    WHT_RATE:  0.01,   // ضريبة الخصم من المنبع 1%

    // ── حدود المخزون ─────────────────────────────────────────────────
    LOW_STOCK_THRESHOLD_M2: 5,     // تنبيه عند أقل من 5 م²
    WASTE_THRESHOLD:        0.85,  // نسبة الاستخدام المقبولة (85%)
    MIN_AREA_M2:            0.01,  // أقل مساحة يمكن صرفها

    // ── طريقة احتساب التكلفة ─────────────────────────────────────────
    // 'FIFO' | 'WEIGHTED_AVERAGE'
    COSTING_METHOD: 'WEIGHTED_AVERAGE',

    // ── حالات الرولات ────────────────────────────────────────────────
    ROLL_STATUS: {
        AVAILABLE:      'Available',
        PARTIALLY_USED: 'PartiallyUsed',
        EXHAUSTED:      'Exhausted',
        ON_HOLD:        'OnHold'
    },

    // ── ألوان الحالات (موحدة في جميع الصفحات) ───────────────────────
    STATUS_COLORS: {
        Available:      { bg: '#dcfce7', text: '#166534', label: '✅ متاح' },
        PartiallyUsed:  { bg: '#fef3c7', text: '#92400e', label: '⚠️ مستخدم جزئياً' },
        Exhausted:      { bg: '#fee2e2', text: '#991b1b', label: '❌ مستنفذ' },
        OnHold:         { bg: '#dbeafe', text: '#1e40af', label: '🔒 محجوز' }
    },

    // ── حالات إذن الصرف ──────────────────────────────────────────────
    ISSUE_STATUS: {
        PENDING:          'Pending',
        PARTIALLY_ISSUED: 'PartiallyIssued',
        ISSUED:           'Issued',
        CANCELLED:        'Cancelled'
    },

    // ── أنواع حركات المخزون ──────────────────────────────────────────
    TXN_TYPES: {
        INBOUND:    'Inbound',
        OUTBOUND:   'Outbound',
        TRANSFER:   'Transfer',
        ADJUSTMENT: 'Adjustment',
        REVERSAL:   'Reversal'
    },

    // ── وحدات القياس ─────────────────────────────────────────────────
    UNITS: {
        ROLL:   'رول',
        M2:     'م²',
        PIECE:  'قطعة',
        METER:  'متر'
    },

    // ── دوال مساعدة ──────────────────────────────────────────────────

    /**
     * تحويل سم → م
     */
    cmToM(cm) {
        return Number(cm || 0) / 100;
    },

    /**
     * تحويل م → سم
     */
    mToCm(m) {
        return Number(m || 0) * 100;
    },

    /**
     * حساب المساحة بالمتر المربع من الطول والعرض بالسنتيمتر
     */
    calcAreaM2(lengthCm, widthCm) {
        return (Number(lengthCm || 0) * Number(widthCm || 0)) / 10000;
    },

    /**
     * حساب التكلفة الإجمالية
     */
    calcTotalCost(areaM2, unitCostPerM2) {
        return Number(areaM2 || 0) * Number(unitCostPerM2 || 0);
    },

    /**
     * حساب نسبة الاستخدام
     */
    calcUsagePct(consumed, original) {
        if (!original || original <= 0) return 0;
        return Math.min(100, (consumed / original) * 100);
    },

    /**
     * تحديد حالة الرول بناءً على المساحة المتبقية
     */
    getRollStatus(remainingArea, originalArea) {
        if (remainingArea <= 0.001)                          return this.ROLL_STATUS.EXHAUSTED;
        if (remainingArea < originalArea - 0.001)            return this.ROLL_STATUS.PARTIALLY_USED;
        return this.ROLL_STATUS.AVAILABLE;
    },

    /**
     * بناء badge HTML لحالة الرول
     */
    statusBadgeHtml(status) {
        const s = this.STATUS_COLORS[status] || { bg: '#f1f5f9', text: '#475569', label: status };
        return `<span style="background:${s.bg};color:${s.text};padding:3px 10px;border-radius:20px;font-size:12px;font-weight:700;">${s.label}</span>`;
    },

    /**
     * تنسيق رقم بالعربي
     */
    formatNum(n, decimals = 2) {
        return Number(n || 0).toLocaleString('ar-EG', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
    }
};

// تصدير للاستخدام في Node.js أيضاً (اختياري)
if (typeof module !== 'undefined' && module.exports) {
    module.exports = INVENTORY;
}

window.INVENTORY = INVENTORY;
