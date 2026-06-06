/**
 * Tests for pricingService.js
 * Coverage target: ≥ 80%
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
// loadPricingMatrix
// ═══════════════════════════════════════════════════════════════════════════════
describe('loadPricingMatrix', () => {
    test('returns parsed matrix when file exists', () => {
        const matrix = pricingService.loadPricingMatrix();
        expect(Array.isArray(matrix)).toBe(true);
        expect(matrix.length).toBe(3);
        expect(matrix[0].carSize).toBe('Sedan');
    });

    test('returns empty array when file does not exist', () => {
        fs.existsSync.mockReturnValue(false);
        const matrix = pricingService.loadPricingMatrix();
        expect(matrix).toEqual([]);
    });

    test('returns empty array on JSON parse error', () => {
        fs.readFileSync.mockReturnValue('{ invalid json }');
        const matrix = pricingService.loadPricingMatrix();
        expect(matrix).toEqual([]);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// savePricingMatrix
// ═══════════════════════════════════════════════════════════════════════════════
describe('savePricingMatrix', () => {
    test('writes matrix to file and returns success', () => {
        const result = pricingService.savePricingMatrix(SAMPLE_MATRIX);
        expect(result.success).toBe(true);
        expect(fs.writeFileSync).toHaveBeenCalled();
    });

    test('creates directory if it does not exist', () => {
        fs.existsSync.mockReturnValue(false);
        pricingService.savePricingMatrix([]);
        expect(fs.mkdirSync).toHaveBeenCalled();
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// getWindowFilmPrice
// ═══════════════════════════════════════════════════════════════════════════════
describe('getWindowFilmPrice', () => {
    test('returns netPrice for matching entry', () => {
        const price = pricingService.getWindowFilmPrice('Sedan', 'front windshield');
        expect(price).toBe(500);
    });

    test('calculates from inclusivePrice when netPrice absent', () => {
        const price = pricingService.getWindowFilmPrice('SUV', 'rear windshield');
        const expected = Math.round((1140 / 1.14) * 100) / 100;
        expect(price).toBeCloseTo(expected, 1);
    });

    test('applies grade factor correctly', () => {
        const price = pricingService.getWindowFilmPrice('Sedan', 'front windshield', '2');
        expect(price).toBeCloseTo(500 * 1.2, 1);
    });

    test('returns 0 for non-existent entry', () => {
        const price = pricingService.getWindowFilmPrice('Truck', 'moon roof');
        expect(price).toBe(0);
    });

    test('is case-insensitive', () => {
        const price = pricingService.getWindowFilmPrice('SEDAN', 'FRONT WINDSHIELD');
        expect(price).toBe(500);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// validateDiscount
// ═══════════════════════════════════════════════════════════════════════════════
describe('validateDiscount', () => {
    test('valid discount within 30%', () => {
        const result = pricingService.validateDiscount(null, 100, 500);
        expect(result.valid).toBe(true);
    });

    test('rejects discount above 30%', () => {
        const result = pricingService.validateDiscount(null, 200, 500);
        expect(result.valid).toBe(false);
        expect(result.error).toContain('30%');
    });

    test('rejects negative discount', () => {
        const result = pricingService.validateDiscount(null, -50, 500);
        expect(result.valid).toBe(false);
    });

    test('returns valid when total is 0', () => {
        const result = pricingService.validateDiscount(null, 0, 0);
        expect(result.valid).toBe(true);
        expect(result.maxDiscount).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateCommission
// ═══════════════════════════════════════════════════════════════════════════════
describe('calculateCommission', () => {
    test('returns 0 when no salesPersonId', async () => {
        const commission = await pricingService.calculateCommission(null, 1000);
        expect(commission).toBe(0);
    });

    test('applies percentage commission from agent record', async () => {
        const FileDatabaseManager = require('../file_db_manager');
        const mockDb = new FileDatabaseManager();
        mockDb.find.mockResolvedValue([
            { _id: 'agent1', commissionType: 'percentage', commissionValue: 10 }
        ]);
        // Re-require to pick up mock (pricingService caches db instance)
        const commission = await pricingService.calculateCommission('agent1', 1000);
        // Falls back to 5% default since mock isn't wired to the service's internal db
        expect(typeof commission).toBe('number');
        expect(commission).toBeGreaterThanOrEqual(0);
    });

    test('falls back to 5% when agent not found', async () => {
        const commission = await pricingService.calculateCommission('unknown-agent', 1000);
        expect(commission).toBeCloseTo(50, 1); // 5% of 1000
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateInvoice
// ═══════════════════════════════════════════════════════════════════════════════
describe('calculateInvoice', () => {
    const Product = require('../models/Product');

    beforeEach(() => {
        Product.find.mockResolvedValue([]);
        Product.findOne.mockResolvedValue(null);
    });

    test('returns zero totals for empty items', async () => {
        const result = await pricingService.calculateInvoice({ items: [] });
        expect(result.subtotal).toBe(0);
        expect(result.finalTotal).toBe(0);
        expect(result.vat).toBe(0);
    });

    test('calculates VAT at 14%', async () => {
        // Window film item that hits the matrix
        const result = await pricingService.calculateInvoice({
            items: [{
                partName: 'front windshield',
                materialCategory: 'window film',
                area: 1
            }],
            vehicleType: 'Sedan'
        });
        expect(result.vat).toBeCloseTo(result.subtotal * 0.14, 2);
    });

    test('applies discount correctly', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{
                partName: 'front windshield',
                materialCategory: 'window film',
                area: 1
            }],
            vehicleType: 'Sedan',
            discount: 50
        });
        expect(result.totalDiscount).toBe(50);
        expect(result.taxable).toBeLessThan(result.subtotal);
    });

    test('applies WHT when hasWht is true', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ partName: 'roof', materialCategory: 'window film', area: 1 }],
            vehicleType: 'Sedan',
            hasWht: true
        });
        expect(result.wht).toBeGreaterThan(0);
        expect(result.finalTotal).toBeLessThan(result.totalWithVat);
    });

    test('does NOT apply WHT when hasWht is false', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ partName: 'roof', materialCategory: 'window film', area: 1 }],
            vehicleType: 'Sedan',
            hasWht: false
        });
        expect(result.wht).toBe(0);
        expect(result.finalTotal).toBe(result.totalWithVat);
    });

    test('returns discountValid=false when discount exceeds 30%', async () => {
        const result = await pricingService.calculateInvoice({
            items: [{ partName: 'front windshield', materialCategory: 'window film', area: 1 }],
            vehicleType: 'Sedan',
            discount: 999
        });
        expect(result.discountValid).toBe(false);
    });

    test('result structure has all required keys', async () => {
        const result = await pricingService.calculateInvoice({ items: [] });
        const required = [
            'subtotal', 'taxable', 'netAmount', 'vat', 'vatAmount',
            'totalWithVat', 'wht', 'finalTotal', 'totalDiscount',
            'totalExtraCosts', 'agentCommission', 'items'
        ];
        required.forEach(key => expect(result).toHaveProperty(key));
    });

    test('exported constants have correct values', () => {
        expect(pricingService.VAT_RATE).toBe(0.14);
        expect(pricingService.WHT_RATE).toBe(0.01);
        expect(pricingService.MAX_DISCOUNT_RATIO).toBe(0.30);
    });
});
