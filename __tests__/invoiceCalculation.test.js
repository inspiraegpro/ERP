/**
 * Comprehensive Unit Tests for calculateInvoice function
 */

const pricingService = require('../services/pricingService');

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(false),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

jest.mock('../file_db_manager', () => {
    return jest.fn().mockImplementation(() => ({
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null)
    }));
});

jest.mock('../models/Product', () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null)
}));

describe('calculateInvoice - Sales Invoice Calculation', () => {
    
    beforeEach(() => {
        jest.clearAllMocks();
        jest.spyOn(pricingService, 'getItemPrice').mockImplementation(async (item) => {
            return parseFloat(item.price) || 0;
        });
        jest.spyOn(pricingService, 'calculateCommission').mockImplementation(async () => 0);
    });

    test('should calculate basic invoice with single item', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 1000, quantity: 1 }],
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });
        expect(result.subtotal).toBe(1000);
        expect(result.taxable).toBe(1000);
        expect(result.vat).toBeCloseTo(140, 2);
        expect(result.totalWithVat).toBe(1140);
        expect(result.wht).toBe(0);
        expect(result.finalTotal).toBe(1140);
    });

    test('should calculate invoice with multiple items', async () => {
        const result = await pricingService.calculateInvoice({
            items: [
                { price: 500, quantity: 1 },
                { price: 750, quantity: 1 },
                { price: 250, quantity: 1 }
            ],
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });
        expect(result.subtotal).toBe(1500);
        expect(result.vat).toBeCloseTo(210, 2);
        expect(result.totalWithVat).toBe(1710);
        expect(result.finalTotal).toBe(1710);
    });

    test('should handle empty cart (no items)', async () => {
        const result = await pricingService.calculateInvoice({
            items: [],
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });
        expect(result.subtotal).toBe(0);
        expect(result.totalWithVat).toBe(0);
        expect(result.vat).toBe(0);
        expect(result.finalTotal).toBe(0);
    });

    test('should handle zero discount', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 1000, quantity: 1 }],
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });
        expect(result.totalDiscount).toBe(0);
        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(1140);
    });

    test('should handle all zero values', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 0, quantity: 1 }],
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });
        expect(result.subtotal).toBe(0);
        expect(result.totalWithVat).toBe(0);
        expect(result.vat).toBe(0);
        expect(result.finalTotal).toBe(0);
    });

    test('should handle partial discount', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 1000, quantity: 1 }],
            extraCosts: 0,
            discount: 200,
            hasWht: false
        });
        expect(result.subtotal).toBe(1000);
        expect(result.taxable).toBe(800);
        expect(result.vat).toBeCloseTo(112, 2);
        expect(result.totalWithVat).toBe(912);
        expect(result.finalTotal).toBe(912);
    });

    test('should reject discount > 30%', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 1000, quantity: 1 }],
            extraCosts: 0,
            discount: 400,
            hasWht: false
        });
        expect(result.discountValid).toBe(false);
        expect(result.totalDiscount).toBe(0);
        expect(result.subtotal).toBe(1000);
        expect(result.taxable).toBe(1000);
    });

    test('should handle discount with extra costs', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 1000, quantity: 1 }],
            extraCosts: 200,
            discount: 300,
            hasWht: false
        });
        expect(result.subtotal).toBe(1000);
        expect(result.taxable).toBe(900); // 1000 + 200 - 300
        expect(result.vat).toBeCloseTo(126, 2);
        expect(result.totalWithVat).toBe(1026);
    });

    test('should calculate with withholding tax enabled', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 1000, quantity: 1 }],
            extraCosts: 0,
            discount: 0,
            hasWht: true
        });
        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(1140);
        expect(result.wht).toBe(10);
        expect(result.finalTotal).toBe(1130);
    });

    test('should handle withholding tax with discount', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ price: 1000, quantity: 1 }],
            extraCosts: 0,
            discount: 200,
            hasWht: true
        });
        expect(result.subtotal).toBe(1000);
        expect(result.taxable).toBe(800);
        expect(result.totalWithVat).toBe(912);
        expect(result.wht).toBe(8);
        expect(result.finalTotal).toBe(904);
    });

    test('should handle complete scenario: items + extra - discount + WHT', async () => {
        const result = await pricingService.calculateInvoice({
            items: [
                { price: 2500, quantity: 1 },
                { price: 1500, quantity: 1 },
                { price: 1000, quantity: 1 }
            ],
            extraCosts: 500,
            discount: 800,
            hasWht: true
        });

        expect(result.subtotal).toBe(5000);
        expect(result.taxable).toBe(4700);
        expect(result.vat).toBeCloseTo(658, 2);
        expect(result.totalWithVat).toBe(5358);
        expect(result.wht).toBe(47);
        expect(result.finalTotal).toBe(5311);
    });
});
