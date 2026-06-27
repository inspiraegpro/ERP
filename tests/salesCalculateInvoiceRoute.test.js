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

describe('sales calculate-invoice route', () => {
  let app;
  let server;

  beforeEach((done) => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/sales', salesRoutes);
    server = app.listen(0, done);
  });

  afterEach((done) => {
    server.close(done);
  });

  test('POST /calculate-invoice returns server calculation even when frontend sends totals', async () => {
    pricingService.calculateInvoice.mockResolvedValueOnce({
      subtotal: 100,
      vat: 14,
      wht: 0,
      finalTotal: 114,
      commission: 5,
      agentCommission: 5
    });

    const payload = {
      items: [{ product: 'p1', price: 9999 }],
      subtotal: 9999,
      vat: 9999,
      finalTotal: 9999
    };

    const res = await request(server, 'POST', '/api/sales/calculate-invoice', payload);

    expect(res.status).toBe(200);
    expect(pricingService.calculateInvoice).toHaveBeenCalledWith(payload);
    expect(res.body).toEqual(expect.objectContaining({
      subtotal: 100,
      vat: 14,
      finalTotal: 114
    }));
  });
});
