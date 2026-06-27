/**
 * End-to-end integration test for calculating a complete invoice
 */

jest.mock('../models/Product', () => {
    return {
        findOne: jest.fn(),
        find: jest.fn()
    };
});

jest.mock('fs', () => ({
    existsSync: jest.fn().mockReturnValue(true),
    readFileSync: jest.fn().mockReturnValue(JSON.stringify([
        { carSize: 'Sedan', partName: 'front windshield', netPrice: 500 },
        { carSize: 'Sedan', partName: 'side windows', netPrice: 1000 }
    ])),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

jest.mock('../file_db_manager', () => {
    return jest.fn().mockImplementation(() => ({
        find: jest.fn().mockResolvedValue([]),
        findOne: jest.fn().mockResolvedValue(null)
    }));
});

const pricingService = require('../services/pricingService');
const Product = require('../models/Product');

describe('Invoice Integration Test', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('calculates complete invoice with mixed items, extra costs, discount, and WHT', async () => {
        Product.findOne.mockResolvedValue({
            pricing: { priceWithoutVat: 2000 }
        });

        const invoicePayload = {
            vehicleType: 'Sedan',
            items: [
                {
                    pricingSource: 'matrix',
                    materialCategory: 'window film',
                    partName: 'front windshield',
                    area: 1,
                    quantity: 1
                },
                {
                    pricingSource: 'products',
                    product: 'ppf-kit-1',
                    quantity: 1
                }
            ],
            extraCosts: 500,
            discount: 300,
            hasWht: true
        };

        const result = await pricingService.calculateInvoice(invoicePayload);

        expect(result.subtotal).toBe(2500);
        expect(result.discountValid).toBe(true);
        expect(result.totalDiscount).toBe(300);
        expect(result.taxable).toBe(2700); // 2500 + 500 - 300
        expect(result.vat).toBe(378); // 2700 * 0.14
        expect(result.totalWithVat).toBe(3078);
        expect(result.wht).toBe(27); // 2700 * 0.01
        expect(result.finalTotal).toBe(3051);
    });
});
