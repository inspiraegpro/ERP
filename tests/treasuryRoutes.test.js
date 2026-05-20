const express = require('express');
const http = require('http');

jest.mock('../file_db_manager', () => {
  const mock = {
    find: jest.fn()
  };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../services/treasuryService', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  createTreasuryTransaction: jest.fn(),
  updateOne: jest.fn(),
  deleteOne: jest.fn()
}));

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { _id: 'u1', role: 'admin' };
    next();
  },
  requireAdmin: (_req, _res, next) => next()
}));

const FileDbManager = require('../file_db_manager');
const treasuryService = require('../services/treasuryService');
const treasuryRoutes = require('../Routes/treasuryRoutes');

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

describe('treasuryRoutes API', () => {
  const db = FileDbManager.__mock;
  let app;
  let server;

  beforeEach((done) => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/treasury', treasuryRoutes);
    server = app.listen(0, done);

    db.find.mockResolvedValue([
      { _id: 'acc1', code: '1101', name: 'خزنة رئيسية' },
      { _id: 'acc2', code: '4101', name: 'إيراد' }
    ]);
    treasuryService.find.mockResolvedValue([
      { _id: 't1', type: 'income', amount: 100, accountId: 'acc1', date: '2026-01-01' },
      { _id: 't2', type: 'expense', amount: 40, accountId: 'acc1', date: '2026-01-02' }
    ]);
    treasuryService.findOne.mockResolvedValue({ _id: 't1', type: 'income', amount: 100, accountId: 'acc1' });
    treasuryService.createTreasuryTransaction.mockResolvedValue({ _id: 't3', type: 'income', amount: 200, accountId: 'acc1' });
    treasuryService.updateOne.mockResolvedValue({ _id: 't1', type: 'expense', amount: 50, accountId: 'acc1' });
    treasuryService.deleteOne.mockResolvedValue(true);
  });

  afterEach((done) => {
    server.close(done);
  });

  test('GET / returns normalized transactions', async () => {
    const res = await request(server, 'GET', '/api/treasury');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body[0]).toEqual(expect.objectContaining({ type: 'expense' }));
  });

  test('GET /balances/summary calculates account balances', async () => {
    const res = await request(server, 'GET', '/api/treasury/balances/summary');
    expect(res.status).toBe(200);
    expect(res.body.totalAccounts).toBe(1);
    expect(res.body.totalBalance).toBe(60);
  });

  test('POST / validates payload', async () => {
    const res = await request(server, 'POST', '/api/treasury', { type: 'income' });
    expect(res.status).toBe(500);
    expect(res.body.error).toContain('date is required');
  });

  test('POST / creates treasury transaction', async () => {
    const res = await request(server, 'POST', '/api/treasury', {
      date: '2026-05-20',
      type: 'income',
      amount: 200,
      accountId: 'acc1',
      reference: 'INV-1'
    });
    expect(res.status).toBe(201);
    expect(treasuryService.createTreasuryTransaction).toHaveBeenCalled();
  });

  test('DELETE /:id returns success for existing tx', async () => {
    const res = await request(server, 'DELETE', '/api/treasury/t1');
    expect(res.status).toBe(200);
    expect(res.body.message).toContain('deleted');
  });
});
