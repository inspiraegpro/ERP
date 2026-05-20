const express = require('express');
const http = require('http');

jest.mock('../file_db_manager', () => {
  const mock = {
    findOne: jest.fn(),
    updateOne: jest.fn()
  };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../models/ServiceJob', () => ({
  findOne: jest.fn(),
  create: jest.fn()
}));

jest.mock('../models/ServiceAdjustment', () => ({
  find: jest.fn(),
  create: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { username: 'qa-user', role: 'admin' };
    next();
  }
}));

const FileDbManager = require('../file_db_manager');
const ServiceJob = require('../models/ServiceJob');
const ServiceAdjustment = require('../models/ServiceAdjustment');
const serviceAdjustmentRoutes = require('../Routes/serviceAdjustmentRoutes');

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

describe('serviceAdjustmentRoutes API', () => {
  const db = FileDbManager.__mock;
  let app;
  let server;

  beforeEach((done) => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/service-adjustments', serviceAdjustmentRoutes);
    server = app.listen(0, done);

    ServiceAdjustment.find.mockResolvedValue([]);
    ServiceAdjustment.create.mockResolvedValue({ _id: 'adj1', adjustmentNo: 'ADJ-1' });
    db.findOne.mockResolvedValue({
      _id: 'inv1',
      invoiceNumber: 'INV-1',
      items: [{ partName: 'hood', quantity: 1, price: 100, total: 100 }],
      discount: 0
    });
    db.updateOne.mockResolvedValue({ _id: 'inv1', finalTotal: 114 });
    ServiceJob.findOne.mockResolvedValue(null);
    ServiceJob.create.mockResolvedValue({ _id: 'job-adj-1' });
  });

  afterEach((done) => {
    server.close(done);
  });

  test('GET / returns adjustments list', async () => {
    ServiceAdjustment.find.mockResolvedValue([{ _id: 'a1', invoiceId: 'inv1' }]);
    const res = await request(server, 'GET', '/api/service-adjustments');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
  });

  test('POST / validates invoiceId', async () => {
    const res = await request(server, 'POST', '/api/service-adjustments', { actionType: 'ADD_SERVICE' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('invoiceId');
  });

  test('POST / applies ADD_SERVICE and updates invoice', async () => {
    const res = await request(server, 'POST', '/api/service-adjustments', {
      invoiceId: 'inv1',
      actionType: 'ADD_SERVICE',
      notes: 'add extra service',
      items: [{ partName: 'roof', quantity: 2, price: 50, product: 'p1' }]
    });
    expect(res.status).toBe(201);
    expect(ServiceAdjustment.create).toHaveBeenCalled();
    expect(db.updateOne).toHaveBeenCalledWith(
      'salesinvoices',
      { _id: 'inv1' },
      expect.objectContaining({
        items: expect.any(Array),
        finalTotal: expect.any(Number)
      })
    );
  });
});
