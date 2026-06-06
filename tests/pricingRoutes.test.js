const express = require('express');
const http = require('http');

jest.mock('../services/pricingService', () => ({
  loadPricingMatrix: jest.fn(),
  savePricingMatrix: jest.fn(),
  getWindowFilmPrice: jest.fn(),
  getItemPrice: jest.fn(),
  calculateInvoice: jest.fn(),
  VAT_RATE: 0.14
}));

jest.mock('../services/cuttingService', () => ({
  optimizeCutting: jest.fn(),
  calculateWaste: jest.fn()
}));

jest.mock('../services/validationService', () => ({
  checkJournalIntegrity: jest.fn(),
  cleanupOrphanedJournals: jest.fn(),
  runFullSystemCheck: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { _id: 'u1', role: 'admin' };
    next();
  }
}));

const pricingService = require('../services/pricingService');
const cuttingService = require('../services/cuttingService');
const pricingRoutes = require('../Routes/pricingRoutes');

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

describe('pricingRoutes API', () => {
  let app;
  let server;

  beforeEach((done) => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/pricing', pricingRoutes);
    server = app.listen(0, done);
  });

  afterEach((done) => {
    server.close(done);
  });

  test('POST /calculate-invoice delegates to pricingService', async () => {
    pricingService.calculateInvoice.mockResolvedValueOnce({
      subtotal: 100,
      vat: 14,
      wht: 0,
      finalTotal: 114,
      commission: 5
    });

    const payload = { items: [{ product: 'p1', price: 9999 }], finalTotal: 9999 };
    const res = await request(server, 'POST', '/api/pricing/calculate-invoice', payload);

    expect(res.status).toBe(200);
    expect(pricingService.calculateInvoice).toHaveBeenCalledWith(payload);
    expect(res.body.finalTotal).toBe(114);
  });

  test('POST /cutting/optimize delegates to cuttingService', async () => {
    cuttingService.optimizeCutting.mockReturnValueOnce({
      placements: [{ rollCode: 'R1' }],
      unplaced: [],
      remnants: [{ barcode: 'R1-P1' }]
    });

    const payload = {
      rolls: [{ rollCode: 'R1', lengthCm: 200, widthCm: 100 }],
      pieces: [{ lengthCm: 50, widthCm: 100 }],
      allowRotate: false
    };
    const res = await request(server, 'POST', '/api/pricing/cutting/optimize', payload);

    expect(res.status).toBe(200);
    expect(cuttingService.optimizeCutting).toHaveBeenCalledWith(payload.rolls, payload.pieces, false);
    expect(res.body.remnants[0].barcode).toBe('R1-P1');
  });
});
