const Car = require('../models/Car');
const FileDatabaseManager = require('../file_db_manager');

const db = new FileDatabaseManager();

function normalizePart(part = {}) {
    return Car.normalizePart(part);
}

function calculatePartArea(lengthCM, widthCM) {
    const part = normalizePart({
        name: '',
        lengthCM: Number(lengthCM) || 0,
        widthCM: Number(widthCM) || 0
    });
    return {
        lengthCM: part.lengthCM,
        widthCM: part.widthCM,
        areaCM2: part.areaCM2,
        areaM2: part.areaM2
    };
}

async function getStats() {
    const cars = await Car.find();
    const modelsCount = cars.length;
    const partsCount = cars.reduce((sum, car) => sum + Number((car.parts || []).length), 0);
    return {
        modelsCount,
        partsCount,
        avgParts: modelsCount ? Number((partsCount / modelsCount).toFixed(1)) : 0
    };
}

async function getPartsCatalog() {
    const cars = await Car.find();
    const catalog = new Map();

    cars.forEach((car) => {
        (car.parts || []).forEach((part) => {
            if (!part.name || catalog.has(part.name)) return;
            catalog.set(part.name, {
                name: part.name,
                lengthCM: part.lengthCM || 0,
                widthCM: part.widthCM || 0,
                areaM2: part.areaM2 || 0,
                areaCM2: part.areaCM2 || 0,
                isRoof: part.isRoof === true,
                carBrand: car.brand || '',
                carModel: car.model || '',
                carId: car._id
            });
        });
    });

    return Array.from(catalog.values()).sort((a, b) => a.name.localeCompare(b.name));
}

async function checkDeleteAllowed(id) {
    const car = await Car.findOne({ _id: id });
    if (!car) {
        return { allowed: false, reason: 'السيارة غير موجودة.' };
    }

    const invoices = await db.find('salesinvoices');
    const linkedInvoices = invoices.filter((inv) => {
        const carId = typeof inv.carModel === 'object' ? inv.carModel._id : inv.carModel;
        return String(carId) === String(id);
    });

    if (linkedInvoices.length > 0) {
        const numbers = linkedInvoices
            .slice(0, 5)
            .map((i) => i.invoiceNumber || i._id)
            .join(', ');
        return {
            allowed: false,
            reason: `مرتبطة بـ ${linkedInvoices.length} فاتورة (${numbers}${linkedInvoices.length > 5 ? '...' : ''})`,
            linkedInvoices: linkedInvoices.length
        };
    }

    const jobs = await db.find('servicejobs');
    const linkedJobs = jobs.filter((job) => {
        const carId = typeof job.carModel === 'object' ? job.carModel._id : job.carModel;
        return String(carId) === String(id);
    });

    if (linkedJobs.length > 0) {
        return {
            allowed: false,
            reason: `مرتبطة بـ ${linkedJobs.length} أمر تشغيل.`,
            linkedJobs: linkedJobs.length
        };
    }

    return { allowed: true };
}

async function importRowsFromData(rows = []) {
    const groups = {};

    rows.forEach((row) => {
        const fullModelName = String(
            row['Car Model'] || row.fullModelName || row.carModel || row.model || ''
        ).trim();
        const code = row.code ? String(row.code).trim() : '';
        const partName = String(row.partName || row.Part || row.part || '').trim();
        const groupKey = code || fullModelName;
        if (!groupKey) return;

        if (!groups[groupKey]) {
            groups[groupKey] = {
                code: code || undefined,
                brand: row.brand,
                model: row.model,
                fullModelName: fullModelName || undefined,
                year: row.year,
                category: row.category || row['Car Category'],
                parts: []
            };
        }

        if (partName) {
            groups[groupKey].parts.push({
                name: partName,
                lengthCM: row.lengthCM || row['Length (Cm)'] || row.length,
                widthCM: row.widthCM || row['Width (cm)'] || row['Width (Cm)'] || row.width,
                notes: row.notes || row.Notes || ''
            });
        }
    });

    let created = 0;
    let updated = 0;

    for (const key of Object.keys(groups)) {
        const raw = groups[key];
        const payload = Car.normalizeCarPayload(raw);
        if (!payload.parts.length) continue;

        const existing = payload.code
            ? await Car.findOne({ code: payload.code })
            : await Car.findByFullModelName(payload.fullModelName);

        if (existing) {
            await Car.updateOne({ _id: existing._id }, payload);
            updated += 1;
        } else {
            await Car.create(payload);
            created += 1;
        }
    }

    return { created, updated, modelsCount: Object.keys(groups).length };
}

module.exports = {
    normalizePart,
    calculatePartArea,
    getStats,
    getPartsCatalog,
    checkDeleteAllowed,
    importRowsFromData
};
