const express = require('express');
const multer = require('multer');
const router = express.Router();
const Car = require('../models/Car');
const carService = require('../services/carService');
const { authenticateToken: auth } = require('../middleware/auth');

const upload = multer({ storage: multer.memoryStorage() });

router.get('/stats', async (_req, res) => {
    try {
        res.json(await carService.getStats());
    } catch (err) {
        res.status(500).json({ message: 'فشل تحميل الإحصائيات.' });
    }
});

router.get('/parts/catalog', async (_req, res) => {
    try {
        res.json(await carService.getPartsCatalog());
    } catch (err) {
        res.status(500).json({ message: 'فشل تحميل كتالوج الأجزاء.' });
    }
});

router.post('/calculate-part-area', async (req, res) => {
    try {
        const { lengthCM, widthCM, lengthCm, widthCm } = req.body || {};
        res.json(carService.calculatePartArea(lengthCM ?? lengthCm, widthCM ?? widthCm));
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.get('/', async (req, res) => {
    try {
        const { search, q } = req.query;
        const term = search || q;
        const cars = term
            ? await Car.findByBrandOrModel(term)
            : await Car.find();
        cars.sort((a, b) =>
            String(a.fullModelName || `${a.brand} ${a.model}`)
                .localeCompare(String(b.fullModelName || `${b.brand} ${b.model}`))
        );
        res.status(200).json(cars);
    } catch (err) {
        res.status(500).json({ message: 'فشل تحميل السيارات.' });
    }
});

router.get('/export', auth, async (req, res) => {
    try {
        const buffer = await Car.exportToExcel({
            search: req.query.search || req.query.q || ''
        });
        res.setHeader('Content-Disposition', 'attachment; filename=cars-sizing.xlsx');
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
        res.send(buffer);
    } catch (err) {
        res.status(500).json({ message: `فشل التصدير: ${err.message}` });
    }
});

router.post('/import', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'لم يتم رفع ملف.' });
        }
        const result = await Car.importFromExcel(req.file.buffer);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message || 'فشل استيراد ملف المقاسات.' });
    }
});

router.post('/import-sizing', auth, upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'لم يتم رفع ملف.' });
        }
        const result = await Car.importFromExcel(req.file.buffer);
        res.json(result);
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: err.message || 'فشل استيراد ملف المقاسات.' });
    }
});

router.get('/:id/check-delete', async (req, res) => {
    try {
        res.json(await carService.checkDeleteAllowed(req.params.id));
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.get('/:carId/parts', async (req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.carId });
        if (!car) {
            return res.status(404).json({ message: 'السيارة غير موجودة.' });
        }
        res.status(200).json(car.parts || []);
    } catch (err) {
        res.status(500).json({ message: 'فشل تحميل الأجزاء.' });
    }
});

router.get('/:id', async (req, res) => {
    try {
        const car = await Car.findOne({ _id: req.params.id });
        if (!car) {
            return res.status(404).json({ message: 'السيارة غير موجودة.' });
        }
        res.json(car);
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

router.post('/', auth, async (req, res) => {
    try {
        const newCar = await Car.create(req.body);
        res.status(201).json(newCar);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.put('/:id', auth, async (req, res) => {
    try {
        const updatedCar = await Car.updateOne({ _id: req.params.id }, req.body);
        if (!updatedCar) {
            return res.status(404).json({ message: 'السيارة غير موجودة.' });
        }
        res.json(updatedCar);
    } catch (err) {
        res.status(400).json({ message: err.message });
    }
});

router.delete('/:id', auth, async (req, res) => {
    try {
        await Car.deleteWithCheck(req.params.id);
        res.json({ message: 'تم حذف السيارة بنجاح.' });
    } catch (err) {
        const status = err.message.includes('لا يمكن حذف') ? 409 : 500;
        res.status(status).json({ message: err.message });
    }
});

module.exports = router;
