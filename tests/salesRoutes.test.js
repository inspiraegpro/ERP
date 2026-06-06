const express = require('express');
const http = require('http');

jest.mock('../file_db_manager', () => {
  const mock = {
    find: jest.fn(),
    findOne: jest.fn(),
    create: jest.fn(),
    updateOne: jest.fn(),
    deleteOne: jest.fn()
  };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../services/salesService', () => ({
  generateInvoiceNumber: jest.fn(),
  createSalesInvoice: jest.fn()
}));

jest.mock('../services/pricingService', () => ({
  calculateInvoice: jest.fn()
}));

jest.mock('../models/Product', () => ({
  findOne: jest.fn()
}));
jest.mock('../models/Customer', () => ({
  findOne: jest.fn()
}));
jest.mock('../models/Car', () => ({
  findOne: jest.fn()
}));
jest.mock('../models/ServiceJob', () => ({}));
jest.mock('../services/journalService', () => ({}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { _id: 'u1', role: 'admin' };
    next();
  },
  requireAdmin: (_req, _res, next) => next()
}));

const FileDbManager = require('../file_db_manager');
const salesService = require('../services/salesService');
const pricingService = require('../services/pricingService');
const Product = require('../models/Product');
const Customer = require('../models/Customer');
const Car = require('../models/Car');
const salesRoutes = require('../Routes/salesRoutes');

function request(server, method, path, body) {
  return new Promise((resolve, reject) => {
    const payload = body ? JSON.stringify(body) : null;
    const req = http.request(
      {
        method,
        hostname: '127.0.0.1',
        port: server.address().port,
        path,
        headers: {
          'Content-Type': 'application/json',
          ...(payload ? { 'Content-Length': Buffer.byteLength(payload) } : {})
        }
      },
      (res) => {
        let raw = '';
        res.on('data', (chunk) => { raw += chunk; });
        res.on('end', () => {
          let json = null;
          try { json = raw ? JSON.parse(raw) : null; } catch (_) { json = raw; }
          resolve({ status: res.statusCode, body: json });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('salesRoutes API', () => {
  const db = FileDbManager.__mock;
  let app;
  let server;

  beforeEach((done) => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/sales', salesRoutes);
    server = app.listen(0, done);

    db.find.mockResolvedValue([]);
    db.findOne.mockResolvedValue(null);
    salesService.generateInvoiceNumber.mockResolvedValue('INV-00010');
    salesService.createSalesInvoice.mockResolvedValue({ _id: 'inv1', invoiceNumber: 'INV-00010' });
    pricingService.calculateInvoice.mockResolvedValue({
      items: [{ product: 'p1', lineTotal: 100, price: 100, unitPrice: 100 }],
      subtotal: 100,
      totalExtraCosts: 0,
      totalDiscount: 0,
      vat: 14,
      netAmount: 100,
      wht: 0,
      finalTotal: 114,
      agentCommission: 5.7,
      discountValid: true
    });
    Product.findOne.mockResolvedValue({ _id: 'p1', name: 'PPF' });
    Customer.findOne.mockResolvedValue({ _id: 'c1', name: 'عميل' });
    Car.findOne.mockResolvedValue({ _id: 'car1', make: 'BMW', model: 'X5' });
  });

  afterEach((done) => {
    server.close(done);
  });

  test('GET /number/next returns next invoice number', async () => {
    const res = await request(server, 'GET', '/api/sales/number/next');
    expect(res.status).toBe(200);
    expect(res.body).toEqual({ nextNumber: 'INV-00010' });
  });

  test('POST / validates required fields', async () => {
    const res = await request(server, 'POST', '/api/sales', { items: [] });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('العميل');
  });

  test('POST / rejects duplicate invoice number', async () => {
    db.findOne.mockResolvedValueOnce({ _id: 'existing', invoiceNumber: 'INV-1' });
    const res = await request(server, 'POST', '/api/sales', {
      invoiceNumber: 'INV-1',
      customer: 'c1',
      items: [{ product: 'p1', price: 100 }]
    });
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('مكرر');
  });

  test('POST / creates invoice through service', async () => {
    const payload = {
      invoiceNumber: 'INV-9',
      customer: 'c1',
      items: [{ product: 'p1', price: 100 }]
    };
    const res = await request(server, 'POST', '/api/sales', payload);
    expect(res.status).toBe(201);
    expect(pricingService.calculateInvoice).toHaveBeenCalled();
    expect(salesService.createSalesInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        customer: 'c1',
        items: expect.any(Array),
        finalTotal: 114
      }),
      expect.objectContaining({ _id: 'u1' })
    );
  });

  test('GET / hydrates invoice list', async () => {
    db.find.mockResolvedValueOnce([
      { _id: 'i1', customer: 'c1', carModel: 'car1', date: '2026-01-01', items: [{ product: 'p1', area: 2, price: 50 }] }
    ]);
    const res = await request(server, 'GET', '/api/sales');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0].customer).toEqual(expect.objectContaining({ _id: 'c1' }));
    expect(res.body[0].items[0].product).toEqual(expect.objectContaining({ _id: 'p1' }));
  });
});

