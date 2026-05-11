const express = require('express');
const multer = require('multer');
const xlsx = require('xlsx');
const router = express.Router();
const Car = require('../models/Car');

const upload = multer({ storage: multer.memoryStorage() });

function normalizePart(part = {}) {
    const lengthCM = Number(part.lengthCM || part.length || 0) || 0;
    const widthCM = Number(part.widthCM || part.width || 0) || 0;
    return {
        name: String(part.name || part.partName || '').trim(),
        lengthCM,
        widthCM,
        areaCM2: Number(part.areaCM2 || (lengthCM * widthCM) || 0)
    };
}

function splitModelName(fullName = '') {
    const clean = String(fullName || '').trim();
    if (!clean) {
        return { brand: '', model: '' };
    }

    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) {
        return { brand: parts[0], model: parts[0] };
    }

    return {
        brand: parts.slice(0, -1).join(' '),
        model: parts.slice(-1).join(' ')
    };
}

function buildCarCode(fullName = '') {
    return `CAR-${String(fullName || '')
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 30)}`;
}

router.post('/', async (req, res) => {
    try {
        const { code, brand, model, year, parts, fullModelName } = req.body;
        const processedParts = (parts || []).map(normalizePart).filter((part) => part.name);

        const resolved = fullModelName ? splitModelName(fullModelName) : { brand, model };
        if (!resolved.brand || !resolved.model) {
            return res.status(400).json({ message: 'بيانات السيارة الأساسية مطلوبة.' });
        }

        const newCar = await Car.create({
            code: code || buildCarCode(`${resolved.brand} ${resolved.model}`),
            brand: resolved.brand,
            model: resolved.model,
            fullModelName: `${resolved.brand} ${resolved.model}`.trim(),
            year: year || '',
            parts: processedParts
        });

        res.status(201).json(newCar);
    } catch (err) {
        res.status(400).json({ message: `فشل الحفظ: ${err.message}` });
    }
});

router.post('/import-sizing', upload.single('file'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'لم يتم رفع ملف.' });
        }

        const workbook = xlsx.read(req.file.buffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows.length) {
            return res.status(400).json({ message: 'ملف المقاسات فارغ.' });
        }

        const groups = {};
        rows.forEach((row) => {
            const fullModelName = String(row['Car Model'] || row.carModel || row.model || '').trim();
            const partName = String(row['Part'] || row.partName || '').trim();
            if (!fullModelName || !partName) return;

            if (!groups[fullModelName]) {
                const resolved = splitModelName(fullModelName);
                groups[fullModelName] = {
                    code: buildCarCode(fullModelName),
                    brand: resolved.brand,
                    model: resolved.model,
                    fullModelName,
                    year: '',
                    parts: []
                };
            }

            groups[fullModelName].parts.push(normalizePart({
                name: partName,
                lengthCM: row['Length (Cm)'] || row.lengthCM || row.length,
                widthCM: row['Width (cm)'] || row.widthCM || row.width
            }));
        });

        let created = 0;
        let updated = 0;

        for (const modelName of Object.keys(groups)) {
            const payload = groups[modelName];
            const existing = await Car.findOne({ fullModelName: payload.fullModelName });

            if (existing) {
                await Car.updateOne(
                    { _id: existing._id },
                    {
                        code: payload.code,
                        brand: payload.brand,
                        model: payload.model,
                        fullModelName: payload.fullModelName,
                        year: payload.year,
                        parts: payload.parts
                    }
                );
                updated++;
            } else {
                await Car.create(payload);
                created++;
            }
        }

        res.json({
            message: `تم استيراد المقاسات بنجاح. جديد: ${created} | محدث: ${updated}`,
            created,
            updated,
            modelsCount: Object.keys(groups).length
        });
    } catch (err) {
        console.error(err);
        res.status(500).json({ message: `فشل استيراد ملف المقاسات: ${err.message}` });
    }
});

router.get('/', async (req, res) => {
    try {
        const cars = await Car.find();
        cars.sort((a, b) => String(a.fullModelName || `${a.brand} ${a.model}`).localeCompare(String(b.fullModelName || `${b.brand} ${b.model}`)));
        res.status(200).json(cars);
    } catch (err) {
        res.status(500).json({ message: 'فشل تحميل السيارات.' });
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

router.put('/:id', async (req, res) => {
    try {
        const { code, brand, model, year, parts, fullModelName } = req.body;
        const resolved = fullModelName ? splitModelName(fullModelName) : { brand, model };
        const updatedCar = await Car.updateOne(
            { _id: req.params.id },
            {
                code: code || buildCarCode(`${resolved.brand} ${resolved.model}`),
                brand: resolved.brand,
                model: resolved.model,
                fullModelName: `${resolved.brand} ${resolved.model}`.trim(),
                year: year || '',
                parts: (parts || []).map(normalizePart).filter((part) => part.name)
            }
        );
        res.json(updatedCar);
    } catch (err) {
        res.status(400).json({ message: `فشل التعديل: ${err.message}` });
    }
});

router.delete('/:id', async (req, res) => {
    try {
        await Car.deleteOne({ _id: req.params.id });
        res.json({ message: 'تم حذف السيارة بنجاح.' });
    } catch (err) {
        res.status(500).json({ message: err.message });
    }
});

module.exports = router;
