/**
 * tests/pricingService.test.js
 * محدَّث ليتوافق مع المنطق الجديد في pricingService.js
 *
 * القاعدة الذهبية: الـ service هو المرجع، الـ test يتحقق من صحته.
 * لا نعدل الـ service ليناسب توقعات خاطئة.
 */

jest.mock('../file_db_manager', () => {
  const mock = { find: jest.fn() };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../models/Product', () => ({
  find:    jest.fn(),
  findOne: jest.fn()
}));

// mock fs لمنع قراءة ملفات حقيقية
jest.mock('fs', () => ({
  existsSync:    jest.fn().mockReturnValue(false),
  readFileSync:  jest.fn(),
  writeFileSync: jest.fn(),
  mkdirSync:     jest.fn()
}));

const FileDbManager   = require('../file_db_manager');
const Product         = require('../models/Product');
const pricingService  = require('../services/pricingService');

describe('pricingService', () => {
  const db = FileDbManager.__mock;

  beforeEach(() => {
    jest.clearAllMocks();
    db.find.mockResolvedValue([]);
    Product.find.mockResolvedValue([]);
    Product.findOne.mockResolvedValue(null);
  });

  // ══════════════════════════════════════════════════════════════════
  // getItemPrice
  // ══════════════════════════════════════════════════════════════════

  test('getItemPrice: يجلب السعر من قاعدة البيانات ويتجاهل سعر الـ frontend', async () => {
    // الـ service يبحث بـ getDb() وليس Product.findOne
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') {
        return [{ _id: 'p1', pricing: { priceWithoutVat: 100 } }];
      }
      return [];
    });

    const price = await pricingService.getItemPrice({
      product:   'p1',
      quantity:  2,
      price:     9999,   // يُتجاهَل — الـ service يجلب السعر الحقيقي
      lineTotal: 9999
    });

    // السعر الصحيح = 100 (سعر الوحدة من DB) — وليس 200 لأن getItemPrice يرجع سعر الوحدة
    expect(price).toBe(100);
  });

  test('getItemPrice: fallback للبحث في products collection مباشرة', async () => {
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') {
        return [{ _id: 'p2', pricing: { salePrice: 114 } }];
      }
      return [];
    });

    const price = await pricingService.getItemPrice({ product: 'p2', quantity: 3 });

    // salePrice = 114 → priceWithoutVat = 114 (الـ service يستخدم salePrice مباشرة)
    expect(price).toBe(114);
  });

  test('getItemPrice: window film بدون matrix يرجع 0', async () => {
    // fs.existsSync = false → matrix فارغة → لا يوجد سعر
    const price = await pricingService.getItemPrice({
      materialCategory: 'Window Film',
      vehicleCategory:  'Sedan',
      partName:         '2 Doors',
      grade:            2,
      area:             2
    });

    expect(price).toBe(0);
  });

  test('getItemPrice: يستخدم item.price مباشرة إذا لم يوجد product في DB', async () => {
    db.find.mockResolvedValue([]); // لا يوجد منتج في DB

    const price = await pricingService.getItemPrice({
      product: 'unknown-id',
      price:   250,
      quantity: 1
    });

    // fallback: يستخدم item.price مباشرة
    expect(price).toBe(250);
  });

  test('getItemPrice: يرجع 0 إذا لا يوجد أي سعر', async () => {
    const price = await pricingService.getItemPrice({ product: null });
    expect(price).toBe(0);
  });

  // ══════════════════════════════════════════════════════════════════
  // calculateCommission
  // ══════════════════════════════════════════════════════════════════

  test('calculateCommission: fixed = القيمة الثابتة مباشرة', async () => {
    db.find.mockResolvedValueOnce([
      { _id: 'a-fixed', commissionType: 'fixed', commissionValue: 25 }
    ]);

    const result = await pricingService.calculateCommission('a-fixed', 1000);
    expect(result).toBe(25);
  });

  test('calculateCommission: fallback 5% عند عدم وجود الوكيل', async () => {
    db.find.mockResolvedValueOnce([]);
    // 5% من 1000 = 50
    const result = await pricingService.calculateCommission('missing', 1000);
    expect(result).toBe(50);
  });

  test('calculateCommission: يرجع 0 إذا لم يُعطَ salesPersonId', async () => {
    const result = await pricingService.calculateCommission(null, 1000);
    expect(result).toBe(0);
  });

  test('calculateCommission: percentage = net × rate/100', async () => {
    db.find.mockResolvedValueOnce([
      { _id: 'a1', commissionType: 'percentage', commissionValue: 10 }
    ]);
    // 10% من 1000 = 100
    const result = await pricingService.calculateCommission('a1', 1000);
    expect(result).toBe(100);
  });

  // ══════════════════════════════════════════════════════════════════
  // calculateInvoice — المنطق الكامل
  // ══════════════════════════════════════════════════════════════════

  test('calculateInvoice: حساب صحيح بالمنطق الجديد (VAT 14% + WHT 1%)', async () => {
    /*
     * بند واحد: سعر الوحدة = 100، كمية = 2
     * subtotal   = 200
     * taxable    = 200  (لا خصم، لا تكاليف إضافية)
     * vat        = 200 × 0.14 = 28
     * totalWithVat = 228
     * wht        = 200 × 0.01 = 2   (hasWht = true)
     * finalTotal = 228 - 2 = 226
     * commission = 200 × 10% = 20
     */
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') {
        return [{ _id: 'p1', pricing: { priceWithoutVat: 100 } }];
      }
      if (collection === 'agents') {
        return [{ _id: 'a1', commissionType: 'percentage', commissionValue: 10 }];
      }
      return [];
    });

    const result = await pricingService.calculateInvoice({
      items:        [{ product: 'p1', quantity: 2, price: 9999 }],
      discount:     0,
      hasWht:       true,
      salesPerson:  'a1'
    });

    expect(result.subtotal).toBe(200);
    expect(result.vat).toBe(28);
    expect(result.wht).toBe(2);
    expect(result.totalWithVat).toBe(228);
    expect(result.finalTotal).toBe(226);
    expect(result.agentCommission).toBe(20);
  });

  test('calculateInvoice: بدون WHT', async () => {
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') {
        return [{ _id: 'p1', pricing: { priceWithoutVat: 100 } }];
      }
      return [];
    });

    const result = await pricingService.calculateInvoice({
      items:  [{ product: 'p1', quantity: 2, price: 9999 }],
      hasWht: false
    });

    expect(result.subtotal).toBe(200);
    expect(result.wht).toBe(0);
    expect(result.finalTotal).toBe(result.totalWithVat);
  });

  test('calculateInvoice: بنود فارغة → أصفار', async () => {
    const result = await pricingService.calculateInvoice({ items: [] });

    expect(result.subtotal).toBe(0);
    expect(result.vat).toBe(0);
    expect(result.finalTotal).toBe(0);
    expect(result.agentCommission).toBe(0);
  });

  test('calculateInvoice: خصم صالح يُطبَّق على الوعاء الضريبي', async () => {
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') {
        return [{ _id: 'p1', pricing: { priceWithoutVat: 100 } }];
      }
      return [];
    });

    const result = await pricingService.calculateInvoice({
      items:    [{ product: 'p1', quantity: 2 }],
      discount: 50
    });

    // taxable = 200 - 50 = 150
    expect(result.taxable).toBe(150);
    expect(result.totalDiscount).toBe(50);
    expect(result.vat).toBeCloseTo(150 * 0.14, 2);
  });

  test('calculateInvoice: خصم يتجاوز 30% → discountValid = false', async () => {
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') {
        return [{ _id: 'p1', pricing: { priceWithoutVat: 100 } }];
      }
      return [];
    });

    const result = await pricingService.calculateInvoice({
      items:    [{ product: 'p1', quantity: 2 }],
      discount: 999
    });

    expect(result.discountValid).toBe(false);
    // الخصم يُلغى عند تجاوز الحد
    expect(result.totalDiscount).toBe(0);
  });

  test('calculateInvoice: يحتوي على جميع المفاتيح المطلوبة', async () => {
    const result = await pricingService.calculateInvoice({ items: [] });
    const required = [
      'subtotal', 'taxable', 'netAmount', 'vat', 'vatAmount',
      'totalWithVat', 'wht', 'finalTotal', 'totalDiscount',
      'totalExtraCosts', 'agentCommission', 'items',
      'discountValid', 'totalAmount', 'finalAmount'
    ];
    required.forEach(key => expect(result).toHaveProperty(key));
  });

  // ══════════════════════════════════════════════════════════════════
  // الثوابت
  // ══════════════════════════════════════════════════════════════════

  test('الثوابت لها القيم الصحيحة', () => {
    expect(pricingService.VAT_RATE).toBe(0.14);
    expect(pricingService.WHT_RATE).toBe(0.01);
    expect(pricingService.MAX_DISCOUNT_RATIO).toBe(0.30);
  });
});
