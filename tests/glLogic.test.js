jest.mock('../models/Account', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/AccountingMapping', () => ({
  find: jest.fn()
}));

jest.mock('../models/FinancialSettings', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/Product', () => ({
  find: jest.fn()
}));

const Account = require('../models/Account');
const AccountingMapping = require('../models/AccountingMapping');
const FinancialSettings = require('../models/FinancialSettings');
const Product = require('../models/Product');
const glLogic = require('../services/glLogic');

describe('glLogic', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    FinancialSettings.findOne.mockResolvedValue({
      defaultRevenueAccountId: 'rev-default',
      defaultVatOutputAccountId: 'vat-output',
      defaultCustomerAccountId: 'ar-default',
      defaultWhtAccountId: 'wht-default',
      defaultCogsAccountId: 'cogs-default',
      defaultInventoryAccountId: 'inv-default'
    });
    Product.find.mockResolvedValue([
      { _id: 'p1', name: 'PPF Hood', category: 'PPF', accounts: { sales: 'rev-ppf' } },
      { _id: 'p2', name: 'Window Film', category: 'WF' }
    ]);
    AccountingMapping.find.mockResolvedValue([
      { mappingType: 'CATEGORY', mappedValue: 'WF', revenueAccount: 'rev-wf', cogsAccount: 'cogs-wf', inventoryAccount: 'inv-wf' }
    ]);
    Account.findOne.mockResolvedValue({ _id: 'acc-ar' });
  });

  test('getAccountId returns id for existing code', async () => {
    await expect(glLogic.getAccountId('110201')).resolves.toBe('acc-ar');
  });

  test('getAccountId throws when missing account', async () => {
    Account.findOne.mockResolvedValueOnce(null);
    await expect(glLogic.getAccountId('9999')).rejects.toThrow('غير موجود');
  });

  test('getSalesEntryDetails builds balanced entry with VAT and WHT', async () => {
    const invoice = {
      invoiceNumber: 'INV-1',
      customerName: 'عميل',
      customerAccount: 'ar-custom',
      totalWithVat: 1140,
      finalTotal: 1140,
      vatAmount: 140,
      netAmount: 1000,
      whtAmount: 50,
      items: [
        { product: 'p1', price: 600, quantity: 1 },
        { product: 'p2', price: 400, quantity: 1 }
      ]
    };

    const details = await glLogic.getSalesEntryDetails(invoice);
    const debit = details.reduce((s, l) => s + (l.debit || 0), 0);
    const credit = details.reduce((s, l) => s + (l.credit || 0), 0);

    expect(details.find((x) => x.accountId === 'ar-custom')).toBeTruthy();
    expect(details.find((x) => x.accountId === 'vat-output')).toBeTruthy();
    expect(details.find((x) => x.accountId === 'wht-default')).toBeTruthy();
    expect(Number(debit.toFixed(2))).toBe(Number(credit.toFixed(2)));
  });
});

