const taxEngine = require('../services/taxEngine');

describe('taxEngine', () => {
    test('calculateInclusive splits gross amount into net and VAT', () => {
        expect(taxEngine.calculateInclusive(114)).toEqual({
            total: 114,
            net: 100,
            vat: 14
        });
    });

    test('calculateExclusive adds VAT to net amount', () => {
        expect(taxEngine.calculateExclusive(200)).toEqual({
            net: 200,
            vat: 28,
            total: 228
        });
    });

    test('calculateTaxableInvoice returns VAT, WHT, and final totals', () => {
        expect(taxEngine.calculateTaxableInvoice({
            subtotal: 200,
            discount: 50,
            extraCosts: 10,
            hasWht: true
        })).toEqual({
            taxable: 160,
            netAmount: 160,
            vat: 22.4,
            vatAmount: 22.4,
            totalWithVat: 182.4,
            wht: 1.6,
            finalTotal: 180.8,
            totalAmount: 182.4,
            finalAmount: 180.8
        });
    });
});
