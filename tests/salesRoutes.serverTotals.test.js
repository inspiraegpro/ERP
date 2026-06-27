const express = require('express');
const http = require('http');

jest.mock('../file_db_manager', () => {
  const mock = {
    find: jest.fn(),
    findOne: jest.fn()
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

jest.mock('../models/Product', () => ({ findOne: jest.fn() }));
jest.mock('../models/Customer', () => ({ findOne: jest.fn() }));
jest.mock('../models/Car', () => ({ findOne: jest.fn() }));
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
          resolve({ status: res.statusCode, body: raw ? JSON.parse(raw) : null });
        });
      }
    );
    req.on('error', reject);
    if (payload) req.write(payload);
    req.end();
  });
}

describe('salesRoutes server-side totals', () => {
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
    pricingService.calculateInvoice.mockResolvedValue({
      items: [{ product: 'p1', lineTotal: 100, price: 100, unitPrice: 100 }],
      subtotal: 100,
      totalExtraCosts: 0,
      totalDiscount: 0,
      vat: 14,
      netAmount: 100,
      wht: 0,
      finalTotal: 114,
      agentCommission: 5,
      commission: 5,
      discountValid: true
    });
    salesService.createSalesInvoice.mockResolvedValue({ _id: 'inv1' });
  });

  afterEach((done) => {
    server.close(done);
  });

  test('POST / ignores frontend totals and saves calculated server values', async () => {
    const res = await request(server, 'POST', '/api/sales', {
      customer: 'c1',
      items: [{ product: 'p1', price: 9999 }],
      subtotal: 9999,
      vat: 9999,
      finalTotal: 9999
    });

    expect(res.status).toBe(201);
    expect(salesService.createSalesInvoice).toHaveBeenCalledWith(
      expect.objectContaining({
        subtotal: 100,
        vatAmount: 14,
        finalTotal: 114,
        totalAmount: 114
      }),
      expect.objectContaining({ _id: 'u1' })
    );
  });
});
