jest.mock('../models/SalesInvoice', () => ({
  countDocuments: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn(),
  updateDailySummary: jest.fn(),
  find: jest.fn(),
  findOne: jest.fn(),
  deleteOne: jest.fn(),
  streamProcess: jest.fn(),
  streamAggregate: jest.fn(),
  getDailySummary: jest.fn(),
  getDateRangeSummary: jest.fn()
}));

jest.mock('../models/Customer', () => ({
  findOne: jest.fn(),
  updateOne: jest.fn()
}));

jest.mock('../models/Car', () => ({
  findOne: jest.fn()
}));

jest.mock('../models/ServiceJob', () => ({
  create: jest.fn()
}));

jest.mock('../models/Product', () => ({}));

jest.mock('../file_db_manager', () => {
  const mockInstance = {
    findOne: jest.fn(),
    find: jest.fn()
  };
  const Ctor = jest.fn(() => mockInstance);
  Ctor.__mockInstance = mockInstance;
  return Ctor;
});

jest.mock('../services/journalService', () => ({
  archiveBeforeMutation: jest.fn(),
  syncSalesJournal: jest.fn()
}));

const SalesInvoice = require('../models/SalesInvoice');
const Customer = require('../models/Customer');
const Car = require('../models/Car');
const ServiceJob = require('../models/ServiceJob');
const FileDbManager = require('../file_db_manager');
const journalService = require('../services/journalService');
const salesService = require('../services/salesService');

describe('salesService', () => {
const dbInstance = FileDbManager.__mockInstance;

  beforeEach(() => {
    jest.clearAllMocks();
    SalesInvoice.updateOne.mockResolvedValue({});
    SalesInvoice.updateDailySummary.mockResolvedValue({});
    Customer.findOne.mockResolvedValue({ _id: 'c1', name: 'عميل 1', balance: 100 });
    Customer.updateOne.mockResolvedValue({});
    Car.findOne.mockResolvedValue({ make: 'BMW', model: 'X5', year: 2024 });
    ServiceJob.create.mockResolvedValue({ _id: 'job1' });
    dbInstance.findOne.mockResolvedValue(null);
    dbInstance.find.mockResolvedValue([]);
    journalService.archiveBeforeMutation.mockResolvedValue({});
    journalService.syncSalesJournal.mockResolvedValue({});
  });

  test('generateInvoiceNumber uses count and padding', async () => {
    SalesInvoice.countDocuments.mockResolvedValue(12);
    await expect(salesService.generateInvoiceNumber()).resolves.toBe('INV-00013');
  });

  test('generateInvoiceNumber falls back to timestamp when count fails', async () => {
    SalesInvoice.countDocuments.mockRejectedValue(new Error('db down'));
    const number = await salesService.generateInvoiceNumber();
    expect(number.startsWith('INV-')).toBe(true);
    expect(number).not.toBe('INV-00001');
  });

  test('createSalesInvoice creates invoice, syncs GL, creates service job, and updates customer balance', async () => {
    SalesInvoice.create.mockResolvedValue({
      _id: 'inv1',
      invoiceNumber: 'INV-00999',
      customerName: 'عميل 1'
    });

    const payload = {
      invoiceNumber: 'INV-00999',
      customer: 'c1',
      carModel: 'car1',
      subtotal: 1000,
      totalExtraCosts: 100,
      totalDiscount: 50,
      totalTax: 130,
      finalTotal: 1180,
      items: [
        { product: 'prod-slug-1', partName: 'hood', price: 500, quantity: 1, category: 'PPF' }
      ]
    };

    const invoice = await salesService.createSalesInvoice(payload, { username: 'admin' });

    expect(SalesInvoice.create).toHaveBeenCalledTimes(1);
    expect(journalService.archiveBeforeMutation).toHaveBeenCalledTimes(1);
    expect(journalService.syncSalesJournal).toHaveBeenCalledTimes(1);
    expect(ServiceJob.create).toHaveBeenCalledWith(expect.objectContaining({
      salesInvoiceId: 'inv1',
      invoiceNumber: 'INV-00999',
      status: 'PENDING_OPS'
    }));
    expect(Customer.updateOne).toHaveBeenCalledWith({ _id: 'c1' }, { balance: 1280 });
    expect(invoice.serviceJobId).toBe('job1');
  });

  test('createSalesInvoice marks GL pending when sync fails', async () => {
    SalesInvoice.create.mockResolvedValue({
      _id: 'inv2',
      invoiceNumber: 'INV-01000'
    });
    ServiceJob.create.mockResolvedValue({ _id: 'job2' });
    journalService.syncSalesJournal.mockRejectedValue(new Error('GL fail'));

    await salesService.createSalesInvoice({
      customer: 'c1',
      finalTotal: 114,
      items: []
    });

    expect(SalesInvoice.updateOne).toHaveBeenCalledWith(
      { _id: 'inv2' },
      expect.objectContaining({ glStatus: 'pending_manual_entry', glErrorMessage: 'GL fail' })
    );
  });
});
