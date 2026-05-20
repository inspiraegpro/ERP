const express = require('express');
const http = require('http');

jest.mock('../models/ServiceJob', () => ({
  find: jest.fn(),
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
  updateOne: jest.fn()
}));

jest.mock('../models/SalesInvoice', () => ({ findById: jest.fn() }));
jest.mock('../models/Employee', () => ({ findById: jest.fn() }));
jest.mock('../models/Customer', () => ({}));
jest.mock('../models/Car', () => ({}));
jest.mock('../models/Product', () => ({}));
jest.mock('../models/WarrantyRequest', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../models/ReissueRequest', () => ({ findById: jest.fn(), updateOne: jest.fn() }));
jest.mock('../services/inventoryService', () => ({}));
jest.mock('../file_db_manager', () => {
  const mock = { findOne: jest.fn() };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { username: 'ops-admin', role: 'admin' };
    next();
  }
}));

const ServiceJob = require('../models/ServiceJob');
const Employee = require('../models/Employee');
const serviceJobRoutes = require('../Routes/serviceJobRoutes');

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

describe('serviceJobRoutes API', () => {
  let app;
  let server;

  beforeEach((done) => {
    jest.clearAllMocks();
    app = express();
    app.use(express.json());
    app.use('/api/service-jobs', serviceJobRoutes);
    server = app.listen(0, done);

    ServiceJob.find.mockResolvedValue([]);
    ServiceJob.findOne.mockResolvedValue(null);
    ServiceJob.findById.mockResolvedValue({
      _id: 'job1',
      items: [{ partName: 'hood', quantity: 1 }],
      evaluationHistory: []
    });
    ServiceJob.create.mockResolvedValue({ _id: 'job1', jobOrder: 'JOB-1' });
    ServiceJob.updateOne.mockResolvedValue({ _id: 'job1' });
    Employee.findById.mockResolvedValue({ _id: 'tech1', name: 'فني 1' });
  });

  afterEach((done) => {
    server.close(done);
  });

  test('POST / validates jobOrder', async () => {
    const res = await request(server, 'POST', '/api/service-jobs', { serviceType: 'PPF' });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('رقم أمر الشغل');
  });

  test('POST / creates new service job', async () => {
    const res = await request(server, 'POST', '/api/service-jobs', {
      jobOrder: 'JOB-1',
      customerName: 'عميل',
      items: [{ partName: 'hood' }]
    });
    expect(res.status).toBe(201);
    expect(ServiceJob.create).toHaveBeenCalledWith(expect.objectContaining({
      workflowStatus: 'AwaitingTechnician',
      evaluationStatus: 'Pending'
    }));
  });

  test('POST /:id/assign-technician validates technician input', async () => {
    const res = await request(server, 'POST', '/api/service-jobs/job1/assign-technician', {});
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('الفني');
  });

  test('POST /:id/evaluate validates rating range', async () => {
    const res = await request(server, 'POST', '/api/service-jobs/job1/evaluate', { rating: 11 });
    expect(res.status).toBe(400);
    expect(res.body.message).toContain('بين 0 و 10');
  });
});
