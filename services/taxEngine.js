'use strict';

const VAT_RATE = 0.14;
const WHT_RATE = 0.01;

function toMoney(value) {
    const number = Number(value) || 0;
    return Number(number.toFixed(2));
}

function calculateInclusive(totalInclusive) {
    const total = toMoney(totalInclusive);
    const net = toMoney(total / (1 + VAT_RATE));
    const vat = toMoney(total - net);
    return { total, net, vat };
}

function calculateExclusive(netAmount) {
    const net = toMoney(netAmount);
    const vat = toMoney(net * VAT_RATE);
    const total = toMoney(net + vat);
    return { net, vat, total };
}

function calculateWithholding(baseAmount, enabled = true) {
    if (!enabled) return 0;
    return toMoney((Number(baseAmount) || 0) * WHT_RATE);
}

function calculateTaxableInvoice({ subtotal = 0, discount = 0, extraCosts = 0, hasWht = false } = {}) {
    const taxable = toMoney(Math.max(0, (Number(subtotal) || 0) - (Number(discount) || 0) + (Number(extraCosts) || 0)));
    const exclusive = calculateExclusive(taxable);
    const wht = calculateWithholding(taxable, hasWht);
    const finalTotal = toMoney(exclusive.total - wht);

    return {
        taxable,
        netAmount: taxable,
        vat: exclusive.vat,
        vatAmount: exclusive.vat,
        totalWithVat: exclusive.total,
        wht,
        finalTotal,
        totalAmount: exclusive.total,
        finalAmount: finalTotal
    };
}

module.exports = {
    VAT_RATE,
    WHT_RATE,
    toMoney,
    calculateInclusive,
    calculateExclusive,
    calculateWithholding,
    calculateTaxableInvoice
};
