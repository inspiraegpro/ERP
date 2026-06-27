/**
 * Unit Tests for pricingSource Logic
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
        { carSize: 'Sedan', partName: 'front windshield', netPrice: 500 }
    ])),
    writeFileSync: jest.fn(),
    mkdirSync: jest.fn()
}));

const pricingService = require('../services/pricingService');
const Product = require('../models/Product');

describe('pricingSource Logic', () => {
    beforeEach(() => {
        jest.clearAllMocks();
    });

    test('item with pricingSource="matrix" fetches from matrix', async () => {
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

    test('item with pricingSource="products" fetches from products DB', async () => {
        Product.findOne.mockResolvedValue({
            pricing: { priceWithoutVat: 1200 }
        });

        const item = {
            pricingSource: 'products',
            product: 'prod-123',
            quantity: 1
        };
        
        const price = await pricingService.getItemPrice(item, 'Sedan');
        expect(Product.findOne).toHaveBeenCalledWith({ _id: 'prod-123' });
        expect(price).toBe(1200);
    });

    test('fallback behavior when pricingSource is missing', async () => {
        const itemWindowFilm = {
            partName: 'front windshield',
            materialCategory: 'window film',
            area: 1
        };
        const priceWF = await pricingService.getItemPrice(itemWindowFilm, 'Sedan');
        expect(priceWF).toBe(500);

        Product.findOne.mockResolvedValue({
            pricing: { priceWithoutVat: 800 }
        });
        const itemProduct = {
            product: 'prod-456',
            quantity: 1
        };
        const priceProd = await pricingService.getItemPrice(itemProduct, 'SUV');
        expect(priceProd).toBe(800);
    });
});
