const express = require('express');
const http = require('http');

jest.mock('../file_db_manager', () => {
  const store = { cars: [], salesinvoices: [], servicejobs: [] };
  const mock = {
    find: jest.fn(async (collection) => store[collection] || []),
    findOne: jest.fn(async (collection, query) => {
      const rows = store[collection] || [];
      if (query._id) return rows.find((r) => r._id === query._id) || null;
      if (query.fullModelName) {
        return rows.find((r) => r.fullModelName === query.fullModelName) || null;
      }
      return null;
    }),
    create: jest.fn(async (collection, data) => {
      const row = { _id: `${collection}-${Date.now()}`, ...data };
      store[collection].push(row);
      return row;
    }),
    updateOne: jest.fn(async (collection, query, data) => {
      const rows = store[collection] || [];
      const idx = rows.findIndex((r) => r._id === query._id);
      if (idx === -1) return null;
      rows[idx] = { ...rows[idx], ...data };
      return rows[idx];
    }),
    deleteOne: jest.fn(async (collection, query) => {
      const rows = store[collection] || [];
      const idx = rows.findIndex((r) => r._id === query._id);
      if (idx === -1) return false;
      rows.splice(idx, 1);
      return true;
    }),
    countDocuments: jest.fn(async (collection) => (store[collection] || []).length),
    __store: store
  };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../middleware/auth', () => ({
  authenticateToken: (req, _res, next) => {
    req.user = { _id: 'u1' };
    next();
  }
}));

const FileDbManager = require('../file_db_manager');
const Car = require('../models/Car');

describe('Car model', () => {
  beforeEach(() => {
    FileDbManager.__mock.__store.cars = [];
    FileDbManager.__mock.__store.salesinvoices = [];
    FileDbManager.__mock.__store.servicejobs = [];
    jest.clearAllMocks();
  });

  test('normalizePart computes areaCM2 and areaM2', () => {
    const part = Car.normalizePart({ name: 'Hood', lengthCM: 200, widthCM: 150 });
    expect(part.areaCM2).toBe(30000);
    expect(part.areaM2).toBe(3);
    expect(part.isRoof).toBe(false);
  });

  test('normalizePart detects roof parts', () => {
    const part = Car.normalizePart({ name: 'Sunroof', lengthCM: 100, widthCM: 80 });
    expect(part.isRoof).toBe(true);
  });

  test('create stores embedded parts with computed areas', async () => {
    const car = await Car.create({
      fullModelName: 'BMW X5 2024',
      brand: 'BMW',
      model: 'X5',
      year: 2024,
      category: 'SUV/Large Sedan',
      parts: [{ name: 'Hood', lengthCM: 200, widthCM: 150 }]
    });
    expect(car.parts[0].areaM2).toBe(3);
    expect(car.code).toMatch(/^CAR-/);
  });

  test('findByFullModelName returns exact match', async () => {
    await Car.create({
      fullModelName: 'Toyota Camry 2023',
      brand: 'Toyota',
      model: 'Camry',
      parts: [{ name: 'Door', lengthCM: 100, widthCM: 50 }]
    });
    const found = await Car.findByFullModelName('Toyota Camry 2023');
    expect(found).toBeTruthy();
    expect(found.brand).toBe('Toyota');
  });

  test('deleteWithCheck blocks when invoices are linked', async () => {
    const car = await Car.create({
      fullModelName: 'Mercedes C200',
      brand: 'Mercedes',
      model: 'C200',
      parts: [{ name: 'Door', lengthCM: 100, widthCM: 50 }]
    });
    FileDbManager.__mock.__store.salesinvoices.push({
      _id: 'inv1',
      invoiceNumber: 'INV-001',
      carModel: car._id
    });

    await expect(Car.deleteWithCheck(car._id)).rejects.toThrow(/فاتورة/);
  });

  test('deleteWithCheck succeeds when no links', async () => {
    const car = await Car.create({
      fullModelName: 'Audi A4',
      brand: 'Audi',
      model: 'A4',
      parts: [{ name: 'Door', lengthCM: 100, widthCM: 50 }]
    });
    const result = await Car.deleteWithCheck(car._id);
    expect(result.deleted).toBe(true);
  });

  test('importFromExcel creates cars from buffer', async () => {
    const xlsx = require('xlsx');
    const sheet = xlsx.utils.json_to_sheet([
      { 'Car Model': 'Honda Civic 2022', Part: 'Hood', 'Length (Cm)': 180, 'Width (cm)': 120 }
    ]);
    const wb = xlsx.utils.book_new();
    xlsx.utils.book_append_sheet(wb, sheet, 'Sheet1');
    const buffer = xlsx.write(wb, { type: 'buffer', bookType: 'xlsx' });

    const result = await Car.importFromExcel(buffer);
    expect(result.created).toBe(1);
    expect(result.modelsCount).toBe(1);
  });
});

describe('carService', () => {
  beforeEach(() => {
    FileDbManager.__mock.__store.cars = [];
    jest.clearAllMocks();
  });

  test('calculatePartArea returns areaM2 from dimensions', () => {
    const carService = require('../services/carService');
    const result = carService.calculatePartArea(100, 50);
    expect(result.areaCM2).toBe(5000);
    expect(result.areaM2).toBe(0.5);
  });

  test('getPartsCatalog deduplicates by part name', async () => {
    const carService = require('../services/carService');
    await Car.create({
      brand: 'Ford',
      model: 'Focus',
      parts: [{ name: 'Hood', lengthCM: 100, widthCM: 80 }]
    });
    const catalog = await carService.getPartsCatalog();
    expect(catalog.filter((p) => p.name === 'Hood')).toHaveLength(1);
  });
});

describe('carRoutes API', () => {
  const carRoutes = require('../Routes/carRoutes');
  let app;
  let server;

  beforeEach((done) => {
    FileDbManager.__mock.__store.cars = [];
    FileDbManager.__mock.__store.salesinvoices = [];
    app = express();
    app.use(express.json());
    app.use('/api/cars', carRoutes);
    server = app.listen(0, done);
  });

  afterEach((done) => {
    server.close(done);
  });

  function request(method, path, body) {
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

  test('POST / creates car with normalized parts', async () => {
    const res = await request('POST', '/api/cars', {
      fullModelName: 'BMW X5 2024',
      brand: 'BMW',
      model: 'X5',
      year: 2024,
      category: 'Large SUV',
      parts: [{ name: 'Hood', lengthCM: 200, widthCM: 150 }]
    });
    expect(res.status).toBe(201);
    expect(res.body.parts[0].areaM2).toBe(3);
  });

  test('GET /:carId/parts returns embedded parts', async () => {
    const created = await request('POST', '/api/cars', {
      brand: 'BMW',
      model: 'X5',
      parts: [{ name: 'Door', lengthCM: 100, widthCM: 80 }]
    });
    const res = await request('GET', `/api/cars/${created.body._id}/parts`);
    expect(res.status).toBe(200);
    expect(res.body[0].name).toBe('Door');
    expect(res.body[0].areaCM2).toBe(8000);
  });

  test('GET /stats returns models and parts counts', async () => {
    await request('POST', '/api/cars', {
      brand: 'Toyota',
      model: 'Camry',
      parts: [{ name: 'Hood', lengthCM: 100, widthCM: 50 }]
    });
    const res = await request('GET', '/api/cars/stats');
    expect(res.status).toBe(200);
    expect(res.body.modelsCount).toBeGreaterThanOrEqual(1);
    expect(res.body.partsCount).toBeGreaterThanOrEqual(1);
  });

  test('GET /parts/catalog returns deduplicated parts', async () => {
    await request('POST', '/api/cars', {
      brand: 'Honda',
      model: 'Civic',
      parts: [{ name: 'Door', lengthCM: 90, widthCM: 60 }]
    });
    const res = await request('GET', '/api/cars/parts/catalog');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some((p) => p.name === 'Door')).toBe(true);
  });

  test('POST /calculate-part-area computes area server-side', async () => {
    const res = await request('POST', '/api/cars/calculate-part-area', {
      lengthCM: 200,
      widthCM: 150
    });
    expect(res.status).toBe(200);
    expect(res.body.areaM2).toBe(3);
  });
});
