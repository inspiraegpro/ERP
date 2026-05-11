/**
 * Comprehensive Unit Tests for calcTotal function
 * Testing the sales invoice calculation logic with edge cases
 * 
 * This tests the equivalent logic from sales_invoice.html calcTotal function
 * which calculates:
 * - Subtotal from line items
 * - Extra costs
 * - Discounts
 * - VAT (14%)
 * - Withholding Tax (1% optional)
 * - Final total
 */

// Import the calculation logic (extracted from sales_invoice.html)
function calculateInvoiceTotal(data) {
    const {
        items = [],
        extraCost = 0,
        discount = 0,
        hasWht = false,
        vatRate = 14 // Default 14% VAT
    } = data;

    // Calculate subtotal from items
    const subtotal = items.reduce((sum, item) => {
        const price = parseFloat(item.price) || 0;
        return sum + price;
    }, 0);

    // Calculate totals
    const extra = parseFloat(extraCost) || 0;
    const disc = parseFloat(discount) || 0;

    // Total with VAT (items are already VAT-inclusive)
    let totalWithVat = (subtotal + extra) - disc;
    
    // Ensure non-negative
    totalWithVat = Math.max(0, totalWithVat);

    // Calculate VAT amount (extract from total)
    // Formula: VAT = totalWithVat * (vatRate / (100 + vatRate))
    const vatMultiplier = vatRate / (100 + vatRate);
    const vatAmount = totalWithVat * vatMultiplier;

    // Reference total (before withholding)
    const referenceTotal = totalWithVat;

    // Calculate withholding tax (1% if applicable)
    let whtAmount = 0;
    if (hasWht) {
        whtAmount = totalWithVat * 0.01; // 1% of total
    }

    // Final total after withholding
    const finalTotal = totalWithVat - whtAmount;

    return {
        subtotal: parseFloat(subtotal.toFixed(2)),
        totalWithVat: parseFloat(totalWithVat.toFixed(2)),
        vatAmount: parseFloat(vatAmount.toFixed(2)),
        referenceTotal: parseFloat(referenceTotal.toFixed(2)),
        whtAmount: parseFloat(whtAmount.toFixed(2)),
        finalTotal: parseFloat(finalTotal.toFixed(2))
    };
}

describe('calculateInvoiceTotal - Sales Invoice Calculation', () => {
    
    // ============ BASIC FUNCTIONALITY TESTS ============
    
    test('should calculate basic invoice with single item', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(1000);
        expect(result.vatAmount).toBeCloseTo(122.81, 2); // 1000 * 14/114
        expect(result.referenceTotal).toBe(1000);
        expect(result.whtAmount).toBe(0);
        expect(result.finalTotal).toBe(1000);
    });

    test('should calculate invoice with multiple items', () => {
        const result = calculateInvoiceTotal({
            items: [
                { price: 500 },
                { price: 750 },
                { price: 250 }
            ],
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(1500);
        expect(result.totalWithVat).toBe(1500);
        expect(result.finalTotal).toBe(1500);
    });

    // ============ EDGE CASE: ZERO VALUES ============
    
    test('should handle empty cart (no items)', () => {
        const result = calculateInvoiceTotal({
            items: [],
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(0);
        expect(result.totalWithVat).toBe(0);
        expect(result.vatAmount).toBe(0);
        expect(result.finalTotal).toBe(0);
    });

    test('should handle undefined items array', () => {
        const result = calculateInvoiceTotal({
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(0);
        expect(result.totalWithVat).toBe(0);
        expect(result.finalTotal).toBe(0);
    });

    test('should handle zero discount', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(1000);
        expect(result.finalTotal).toBe(1000);
    });

    test('should handle zero extra cost', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 500 }],
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(500);
        expect(result.totalWithVat).toBe(500);
        expect(result.finalTotal).toBe(500);
    });

    test('should handle all zero values', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 0 }],
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(0);
        expect(result.totalWithVat).toBe(0);
        expect(result.vatAmount).toBe(0);
        expect(result.finalTotal).toBe(0);
    });

    // ============ EDGE CASE: MAXIMUM TAX ============
    
    test('should handle maximum VAT calculation', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000000 }], // 1 million
            extraCost: 0,
            discount: 0,
            hasWht: false,
            vatRate: 14
        });

        expect(result.subtotal).toBe(1000000);
        expect(result.totalWithVat).toBe(1000000);
        expect(result.vatAmount).toBeCloseTo(122807.02, 2);
    });

    test('should handle high VAT rate (100%)', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 0,
            hasWht: false,
            vatRate: 100
        });

        expect(result.subtotal).toBe(1000);
        expect(result.vatAmount).toBe(500); // 1000 * 100/200
    });

    test('should handle zero VAT rate', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 0,
            hasWht: false,
            vatRate: 0
        });

        expect(result.subtotal).toBe(1000);
        expect(result.vatAmount).toBe(0);
        expect(result.finalTotal).toBe(1000);
    });

    // ============ EDGE CASE: DISCOUNTS ============
    
    test('should handle partial discount', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 200,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(800);
        expect(result.vatAmount).toBeCloseTo(98.25, 2); // 800 * 14/114
        expect(result.finalTotal).toBe(800);
    });

    test('should handle 100% discount', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 1000,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(0);
        expect(result.vatAmount).toBe(0);
        expect(result.finalTotal).toBe(0);
    });

    test('should handle discount greater than subtotal (edge case)', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 1500,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(0); // Should not be negative
        expect(result.finalTotal).toBe(0);
    });

    test('should handle discount with extra costs', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 200,
            discount: 300,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(900); // 1000 + 200 - 300
        expect(result.finalTotal).toBe(900);
    });

    // ============ EDGE CASE: WITHHOLDING TAX ============
    
    test('should calculate with withholding tax enabled', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 0,
            hasWht: true
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(1000);
        expect(result.whtAmount).toBe(10); // 1% of 1000
        expect(result.finalTotal).toBe(990); // 1000 - 10
    });

    test('should calculate with withholding tax on large amount', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 100000 }],
            extraCost: 0,
            discount: 0,
            hasWht: true
        });

        expect(result.subtotal).toBe(100000);
        expect(result.whtAmount).toBe(1000); // 1% of 100000
        expect(result.finalTotal).toBe(99000);
    });

    test('should handle withholding tax with discount', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 200,
            hasWht: true
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(800);
        expect(result.whtAmount).toBe(8); // 1% of 800
        expect(result.finalTotal).toBe(792); // 800 - 8
    });

    test('should handle zero total with withholding tax', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 0 }],
            extraCost: 0,
            discount: 0,
            hasWht: true
        });

        expect(result.subtotal).toBe(0);
        expect(result.whtAmount).toBe(0);
        expect(result.finalTotal).toBe(0);
    });

    // ============ EDGE CASE: EXTRA COSTS ============
    
    test('should handle extra costs only', () => {
        const result = calculateInvoiceTotal({
            items: [],
            extraCost: 500,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(0);
        expect(result.totalWithVat).toBe(500);
        expect(result.finalTotal).toBe(500);
    });

    test('should handle multiple extra costs with items', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }, { price: 500 }],
            extraCost: 300,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(1500);
        expect(result.totalWithVat).toBe(1800); // 1500 + 300
        expect(result.finalTotal).toBe(1800);
    });

    // ============ EDGE CASE: DECIMAL VALUES ============
    
    test('should handle decimal prices', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 99.99 }, { price: 49.99 }],
            extraCost: 10.50,
            discount: 5.25,
            hasWht: false
        });

        expect(result.subtotal).toBeCloseTo(149.98, 2);
        expect(result.totalWithVat).toBeCloseTo(155.23, 2); // 149.98 + 10.50 - 5.25
    });

    test('should handle very small decimal values', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 0.01 }],
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(0.01);
        expect(result.totalWithVat).toBe(0.01);
        // VAT on 0.01 with 2 decimal rounding becomes 0
        expect(result.vatAmount).toBeGreaterThanOrEqual(0);
    });

    // ============ EDGE CASE: NEGATIVE VALUES (DEFENSIVE) ============
    
    test('should handle negative extra cost (refund scenario)', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 1000 }],
            extraCost: -200,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(800); // 1000 - 200
        expect(result.finalTotal).toBe(800);
    });

    test('should handle string numbers (defensive)', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: "1000" }],
            extraCost: "200",
            discount: "100",
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(1100); // 1000 + 200 - 100
    });

    test('should handle null/undefined values (defensive)', () => {
        const result = calculateInvoiceTotal({
            items: [
                { price: 1000 },
                { price: null },
                { price: undefined },
                { price: "invalid" }
            ],
            extraCost: null,
            discount: undefined,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000); // Only valid number counts
        expect(result.totalWithVat).toBe(1000);
    });

    // ============ COMPLEX SCENARIOS ============
    
    test('should handle complete scenario: items + extra - discount + WHT', () => {
        const result = calculateInvoiceTotal({
            items: [
                { price: 2500 },
                { price: 1500 },
                { price: 1000 }
            ],
            extraCost: 500,
            discount: 800,
            hasWht: true
        });

        // Subtotal: 5000
        // + Extra: 500 = 5500
        // - Discount: 800 = 4700
        // WHT: 1% of 4700 = 47
        // Final: 4700 - 47 = 4653

        expect(result.subtotal).toBe(5000);
        expect(result.totalWithVat).toBe(4700);
        expect(result.vatAmount).toBeCloseTo(577.19, 2);
        expect(result.referenceTotal).toBe(4700);
        expect(result.whtAmount).toBe(47);
        expect(result.finalTotal).toBe(4653);
    });

    test('should handle many items scenario', () => {
        const items = Array(100).fill(null).map((_, i) => ({ price: 100 }));
        
        const result = calculateInvoiceTotal({
            items,
            extraCost: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(10000);
        expect(result.totalWithVat).toBe(10000);
    });

    // ============ VAT RATE VARIATIONS ============
    
    test('should handle different VAT rates', () => {
        const baseConfig = {
            items: [{ price: 1000 }],
            extraCost: 0,
            discount: 0,
            hasWht: false
        };

        // 5% VAT
        const result5 = calculateInvoiceTotal({ ...baseConfig, vatRate: 5 });
        expect(result5.vatAmount).toBeCloseTo(47.62, 2); // 1000 * 5/105

        // 10% VAT
        const result10 = calculateInvoiceTotal({ ...baseConfig, vatRate: 10 });
        expect(result10.vatAmount).toBeCloseTo(90.91, 2); // 1000 * 10/110

        // 20% VAT
        const result20 = calculateInvoiceTotal({ ...baseConfig, vatRate: 20 });
        expect(result20.vatAmount).toBeCloseTo(166.67, 2); // 1000 * 20/120
    });
});

// Integration test with real-world scenarios
describe('calculateInvoiceTotal - Real World Scenarios', () => {
    
    test('Typical WrapStyle sedan window film invoice', () => {
        const result = calculateInvoiceTotal({
            items: [
                { price: 2800 }, // Front windshield
                { price: 1800 }, // Side windows
                { price: 1200 }  // Rear window
            ],
            extraCost: 200, // Installation fee
            discount: 300, // Promotional discount
            hasWht: false
        });

        expect(result.subtotal).toBe(5800);
        expect(result.totalWithVat).toBe(5700); // 5800 + 200 - 300
        expect(result.vatAmount).toBeCloseTo(700, 0); // 5700 * 14/114 = 700
        expect(result.finalTotal).toBe(5700);
    });

    test('Commercial client with WHT', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 15000 }],
            extraCost: 500,
            discount: 1000,
            hasWht: true
        });

        expect(result.subtotal).toBe(15000);
        expect(result.totalWithVat).toBe(14500); // 15000 + 500 - 1000
        expect(result.whtAmount).toBe(145); // 1% of 14500
        expect(result.finalTotal).toBe(14355);
    });

    test('Free service (100% discount)', () => {
        const result = calculateInvoiceTotal({
            items: [{ price: 5000 }],
            extraCost: 0,
            discount: 5000,
            hasWht: false
        });

        expect(result.subtotal).toBe(5000);
        expect(result.totalWithVat).toBe(0);
        expect(result.vatAmount).toBe(0);
        expect(result.finalTotal).toBe(0);
    });
});

// Export for use in other tests if needed
module.exports = { calculateInvoiceTotal };
