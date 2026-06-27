/**
 * Tests for pricingService.js - Extended Coverage
 * Testing product.pricing.priceWithoutVat integration
 */

// Mock filesystem for pricing matrix
jest.mock('fs', () => ({
    existsSync: jest.fn(),
    readFileSync: jest.fn(),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

// Mock FileDatabaseManager
jest.mock('../file_db_manager', () => {
    return jest.fn().mockImplementation(() => ({
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null),
        create: jest.fn().mockResolvedValue({}),
        updateOne: jest.fn().mockResolvedValue({})
    }));
});

// Mock Product model
jest.mock('../models/Product', () => ({
    find: jest.fn().mockResolvedValue([]),
    findOne: jest.fn().mockResolvedValue(null)
}));

const fs = require('fs');
const pricingService = require('../services/pricingService');
const Product = require('../models/Product');

// ─── Sample pricing matrix ────────────────────────────────────────────────────
const SAMPLE_MATRIX = [
    { carSize: 'Sedan', partName: 'front windshield', netPrice: 500, gradeFactors: { '1': 1.0, '2': 1.2 } },
    { carSize: 'SUV',   partName: 'rear windshield',  inclusivePrice: 1140 },
    { carSize: 'Sedan', partName: 'roof',              netPrice: 300 }
];

beforeEach(() => {
    jest.clearAllMocks();
    fs.existsSync.mockReturnValue(true);
    fs.readFileSync.mockReturnValue(JSON.stringify(SAMPLE_MATRIX));
});

// ═══════════════════════════════════════════════════════════════════════════════
// getItemPrice - Extended Tests for product.pricing
// ═══════════════════════════════════════════════════════════════════════════════
describe('getItemPrice - Extended', () => {

    test('gets price from product.pricing.priceWithoutVat when available', async () => {
        Product.findOne.mockResolvedValue({
            pricing: { priceWithoutVat: 1200 },
            price: 1500
        });

        const item = { product: 'prod-123', quantity: 1 };
        const price = await pricingService.getItemPrice(item, 'Sedan');

        expect(Product.findOne).toHaveBeenCalledWith({ _id: 'prod-123' });
        expect(price).toBe(1200);
    });

    test('falls back to product.price when pricing.priceWithoutVat is missing', async () => {
        Product.findOne.mockResolvedValue({
            pricing: {},
            price: 800
        });

        const item = { product: 'prod-456', quantity: 1 };
        const price = await pricingService.getItemPrice(item, 'SUV');

        expect(Product.findOne).toHaveBeenCalledWith({ _id: 'prod-456' });
        expect(price).toBe(800);
    });

    test('falls back to product.price when pricing is completely missing', async () => {
        Product.findOne.mockResolvedValue({
            price: 600
        });

        const item = { product: 'prod-789', quantity: 1 };
        const price = await pricingService.getItemPrice(item, 'Sedan');

        expect(Product.findOne).toHaveBeenCalledWith({ _id: 'prod-789' });
        expect(price).toBe(600);
    });

    test('returns 0 when no product found', async () => {
        Product.findOne.mockResolvedValue(null);

        const item = { product: 'non-existent', quantity: 1 };
        const price = await pricingService.getItemPrice(item, 'Sedan');

        expect(price).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateInvoice - Extended Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('calculateInvoice - Extended', () => {

    beforeEach(() => {
        Product.findOne.mockResolvedValue({
            pricing: { priceWithoutVat: 1000 }
        });
    });

    test('calculates invoice with productId only (no price in payload)', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ product: 'prod-123', quantity: 1 }],
            vehicleType: 'Sedan',
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(1000);
        expect(result.vat).toBeCloseTo(140, 2);
        expect(result.totalWithVat).toBe(1140);
        expect(result.finalTotal).toBe(1140);
    });

    test('calculates invoice with productId and area (M2 pricing)', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ product: 'prod-123', area: 2.5 }],
            vehicleType: 'Sedan',
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(2500);
        expect(result.vat).toBeCloseTo(350, 2);
        expect(result.totalWithVat).toBe(2850);
    });

    test('calculates invoice with mixed items (productId + window film)', async () => {
        const result = await pricingService.calculateInvoice({
            items: [
                { product: 'prod-123', area: 1 },
                { partName: 'front windshield', materialCategory: 'window film', area: 1 }
            ],
            vehicleType: 'Sedan',
            extraCosts: 0,
            discount: 0,
            hasWht: false
        });

        expect(result.subtotal).toBe(1500);
        expect(result.vat).toBeCloseTo(210, 2);
        expect(result.totalWithVat).toBe(1710);
    });

    test('respects discount when using productId only', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ product: 'prod-123', quantity: 2 }],
            vehicleType: 'Sedan',
            extraCosts: 0,
            discount: 300,
            hasWht: false
        });

        expect(result.subtotal).toBe(2000);
        expect(result.taxable).toBe(1700);
        expect(result.vat).toBeCloseTo(238, 2);
        expect(result.totalWithVat).toBe(1938);
    });

    test('applies WHT with productId only', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ product: 'prod-123', quantity: 1 }],
            vehicleType: 'Sedan',
            extraCosts: 0,
            discount: 0,
            hasWht: true
        });

        expect(result.subtotal).toBe(1000);
        expect(result.totalWithVat).toBe(1140);
        expect(result.wht).toBe(10);
        expect(result.finalTotal).toBe(1130);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// Product Fallback Compatibility Test
// ═══════════════════════════════════════════════════════════════════════════════
describe('Product Fallback Compatibility', () => {

    test('old products with only price field still work', async () => {
        Product.findOne.mockResolvedValue({
            price: 500
        });

        const item = { product: 'old-prod', quantity: 1 };
        const price = await pricingService.getItemPrice(item, 'Sedan');

        expect(price).toBe(500);
    });

    test('products with pricing.priceWithoutVat = 0 fall back to price', async () => {
        Product.findOne.mockResolvedValue({
            pricing: { priceWithoutVat: 0 },
            price: 750
        });

        const item = { product: 'prod-zero', quantity: 1 };
        const price = await pricingService.getItemPrice(item, 'Sedan');

        expect(price).toBe(750);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// pricingSource Priority Tests
// ═══════════════════════════════════════════════════════════════════════════════
describe('pricingSource Priority', () => {

    test('pricingSource="matrix" uses pricing matrix (Window Film)', async () => {
        const item = {
            pricingSource: 'matrix',
            partName: 'front windshield',
            materialCategory: 'window film',
            area: 1
        };

        const price = await pricingService.getItemPrice(item, 'Sedan');

        expect(Product.findOne).not.toHaveBeenCalled();
        expect(price).toBe(500);
    });

    test('pricingSource="products" uses Product model pricing', async () => {
        Product.findOne.mockResolvedValue({
            pricing: { priceWithoutVat: 900 }
        });

        const item = {
            pricingSource: 'products',
            product: 'prod-123',
            quantity: 1
        };

        const price = await pricingService.getItemPrice(item, 'Sedan');

        expect(Product.findOne).toHaveBeenCalledWith({ _id: 'prod-123' });
        expect(price).toBe(900);
    });
});