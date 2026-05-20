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

jest.mock('../services/inventoryService', () => ({
  getSmartSuggestions: jest.fn(),
  processInbound: jest.fn(),
  processOutbound: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { _id: 'u1', role: 'admin' };
    next();
  }
}));

const FileDbManager = require('../file_db_manager');
const inventoryService = require('../services/inventoryService');
const stockRoutes = require('../Routes/stockRoutes');

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

describe('stockRoutes API', () => {
  const db = FileDbManager.__mock;
  let app;
  let server;

  beforeEach((done) => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/stock', stockRoutes);
    server = app.listen(0, done);

    db.find.mockResolvedValue([]);
    db.findOne.mockResolvedValue(null);
    db.create.mockResolvedValue({ _id: 'tx1', type: 'Inbound', serialNumber: 'IN-00001' });
    inventoryService.getSmartSuggestions.mockResolvedValue([{ code: 'R1', type: 'remnant' }]);
    inventoryService.processInbound.mockResolvedValue({});
    inventoryService.processOutbound.mockResolvedValue({});
  });

  afterEach((done) => {
    server.close(done);
  });

  test('GET /smart-suggestions validates productId', async () => {
    const res = await request(server, 'GET', '/api/stock/smart-suggestions');
    expect(res.status).toBe(400);
    expect(res.body.error).toContain('productId');
  });

  test('GET /smart-suggestions returns inventory suggestions', async () => {
    const res = await request(server, 'GET', '/api/stock/smart-suggestions?productId=p1&area=2&lengthCm=200&widthCm=100');
    expect(res.status).toBe(200);
    expect(res.body).toEqual([{ code: 'R1', type: 'remnant' }]);
    expect(inventoryService.getSmartSuggestions).toHaveBeenCalledWith('p1', 2, 200, 100, '');
  });

  test('POST / auto-generates serial and processes inbound transaction', async () => {
    db.find.mockResolvedValueOnce([]); // for generateSerialNumber
    const res = await request(server, 'POST', '/api/stock', {
      type: 'Inbound',
      warehouse: 'Main',
      items: [{ product: 'p1', quantity: 1 }]
    });
    expect(res.status).toBe(201);
    expect(db.create).toHaveBeenCalledWith('stocktransactions', expect.objectContaining({
      serialNumber: 'IN-00001'
    }));
    expect(inventoryService.processInbound).toHaveBeenCalled();
  });

  test('POST / rejects duplicate serial number', async () => {
    db.findOne.mockResolvedValueOnce({ _id: 'existingTx', serialNumber: 'IN-00088' });
    const res = await request(server, 'POST', '/api/stock', {
      serialNumber: 'IN-00088',
      type: 'Inbound',
      items: [{ product: 'p1', quantity: 1 }]
    });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('مكرر');
  });

  test('GET /available-rolls filters by product and status', async () => {
    db.find.mockResolvedValueOnce([
      { product: 'p1', status: 'Available', rollCode: 'R1', remainingArea: 5 },
      { product: 'p2', status: 'Available', rollCode: 'R2', remainingArea: 8 },
      { product: 'p1', status: 'Consumed', rollCode: 'R3', remainingArea: 0 }
    ]);
    const res = await request(server, 'GET', '/api/stock/available-rolls?productId=p1');
    expect(res.status).toBe(200);
    expect(res.body).toHaveLength(1);
    expect(res.body[0].rollCode).toBe('R1');
  });
});

