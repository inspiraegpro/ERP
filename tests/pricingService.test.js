jest.mock('../file_db_manager', () => {
  const mock = {
    find: jest.fn()
  };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../models/Product', () => ({
  find: jest.fn(),
  findOne: jest.fn()
}));

const FileDbManager = require('../file_db_manager');
const Product = require('../models/Product');
const pricingService = require('../services/pricingService');

describe('pricingService', () => {
  const db = FileDbManager.__mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db.find.mockResolvedValue([]);
    Product.find.mockResolvedValue([]);
    Product.findOne.mockResolvedValue(null);
  });

  test('getItemPrice uses stored product price and ignores frontend price', async () => {
    Product.findOne.mockResolvedValueOnce({
      _id: 'p1',
      pricing: { priceWithoutVat: 100 }
    });

    const price = await pricingService.getItemPrice({
      product: 'p1',
      quantity: 2,
      price: 9999,
      lineTotal: 9999
    });

    expect(price).toBe(200);
  });

  test('getItemPrice supports positional product signature and db fallback', async () => {
    Product.findOne.mockRejectedValueOnce(new Error('model not initialized'));
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') {
        return [{ _id: 'p2', pricing: { salePrice: 114 } }];
      }
      return [];
    });

    const price = await pricingService.getItemPrice('p2', 3);

    expect(price).toBe(300);
  });

  test('getItemPrice supports window film matrix with grade factor', async () => {
    const price = await pricingService.getItemPrice({
      materialCategory: 'Window Film',
      vehicleCategory: 'Sedan',
      partName: '2 Doors',
      grade: 2,
      area: 2
    });

    expect(price).toBe(1100);
  });

  test('getItemPrice falls back to category product pricing', async () => {
    Product.find.mockResolvedValueOnce([
      { category: 'polish', pricing: { salePrice: 228 } }
    ]);

    const price = await pricingService.getItemPrice({
      materialCategory: 'polish',
      quantity: 2
    });

    expect(price).toBe(400);
  });

  test('calculateCommission supports fixed and default commission', async () => {
    db.find.mockResolvedValueOnce([{ _id: 'a-fixed', commissionType: 'fixed', commissionValue: 25 }]);

    await expect(pricingService.calculateCommission('a-fixed', 1000)).resolves.toBe(25);

    db.find.mockResolvedValueOnce([]);
    await expect(pricingService.calculateCommission('missing', 1000)).resolves.toBe(50);
  });

  test('calculateInvoice returns server totals and commission alias', async () => {
    Product.findOne.mockResolvedValue({
      _id: 'p1',
      pricing: { priceWithoutVat: 100 }
    });
    db.find.mockImplementation(async (collection) => {
      if (collection === 'agents') {
        return [{ _id: 'a1', commissionType: 'percentage', commissionValue: 10 }];
      }
      return [];
    });

    const result = await pricingService.calculateInvoice({
      items: [{ product: 'p1', quantity: 2, price: 9999 }],
      extraCost: 10,
      discount: 0,
      hasWht: true,
      salesPersonId: 'a1',
      subtotal: 9999,
      finalTotal: 9999
    });

    expect(result.subtotal).toBe(200);
    expect(result.vat).toBe(29.4);
    expect(result.wht).toBe(2);
    expect(result.finalTotal).toBe(237.4);
    expect(result.commission).toBe(23.74);
    expect(result.agentCommission).toBe(23.74);
  });
});
