const FileDatabaseManager = require('../file_db_manager');
const xlsx = require('xlsx');

const ROOF_PATTERN = /roof|sunroof|سقف|full glass roof/i;

function normalizePart(part = {}) {
    const lengthCM = Number(part.lengthCM ?? part.length ?? 0) || 0;
    const widthCM = Number(part.widthCM ?? part.width ?? 0) || 0;
    const areaCM2 = Number((lengthCM * widthCM).toFixed(2));
    const areaM2 = Number((areaCM2 / 10000).toFixed(4));
    const name = String(part.name || part.partName || '').trim();

    return {
        name,
        lengthCM,
        widthCM,
        areaCM2,
        areaM2,
        isRoof: part.isRoof === true || ROOF_PATTERN.test(name),
        notes: String(part.notes || '').trim()
    };
}

function splitModelName(fullName = '') {
    const clean = String(fullName || '').trim();
    if (!clean) return { brand: '', model: '' };

    const parts = clean.split(/\s+/).filter(Boolean);
    if (parts.length === 1) return { brand: parts[0], model: parts[0] };

    const yearMatch = parts[parts.length - 1].match(/^\d{4}$/);
    if (yearMatch && parts.length >= 2) {
        return {
            brand: parts.slice(0, -2).join(' ') || parts[0],
            model: parts.slice(-2, -1).join(' ') || parts[parts.length - 2]
        };
    }

    return {
        brand: parts.slice(0, -1).join(' '),
        model: parts[parts.length - 1]
    };
}

function buildCarCode(fullName = '', year = '') {
    const token = `${fullName}${year ? `-${year}` : ''}`;
    return `CAR-${String(token)
        .toUpperCase()
        .replace(/[^A-Z0-9]+/g, '-')
        .replace(/^-+|-+$/g, '')
        .slice(0, 40)}`;
}

function buildFullModelName(brand = '', model = '', year = '') {
    const base = `${String(brand || '').trim()} ${String(model || '').trim()}`.trim();
    const y = Number(year);
    return y ? `${base} ${y}`.trim() : base;
}

class Car {
    constructor() {
        this.db = new FileDatabaseManager();
    }

    normalizePart(part) {
        return normalizePart(part);
    }

    normalizeCarPayload(data = {}) {
        const fullModelName = String(
            data.fullModelName ||
            buildFullModelName(data.brand, data.model, data.year)
        ).trim();

        const resolved = data.brand && data.model
            ? { brand: String(data.brand).trim(), model: String(data.model).trim() }
            : splitModelName(fullModelName);

        const year = Number(data.year) || null;
        const parts = (data.parts || [])
            .map((p) => normalizePart(p))
            .filter((p) => p.name);

        return {
            code: data.code || buildCarCode(fullModelName, year || ''),
            fullModelName,
            brand: resolved.brand,
            model: resolved.model,
            year,
            category: String(data.category || '').trim() || 'Sedan',
            parts,
            isActive: data.isActive !== false,
            updatedAt: new Date().toISOString()
        };
    }

    async create(data) {
        const payload = this.normalizeCarPayload(data);
        if (!payload.brand || !payload.model) {
            throw new Error('بيانات السيارة الأساسية مطلوبة.');
        }
        if (!payload.parts.length) {
            throw new Error('يجب إضافة جزء واحد على الأقل.');
        }

        const existing = await this.findByFullModelName(payload.fullModelName);
        if (existing) {
            throw new Error(`السيارة "${payload.fullModelName}" مسجلة مسبقاً.`);
        }

        return await this.db.create('cars', {
            ...payload,
            createdAt: new Date().toISOString()
        });
    }

    async find(query = {}) {
        const cars = await this.db.find('cars', query);
        return cars.filter((c) => c.isActive !== false || query.includeInactive);
    }

    async findOne(query) {
        return await this.db.findOne('cars', query);
    }

    async findByFullModelName(fullModelName) {
        const name = String(fullModelName || '').trim().toLowerCase();
        if (!name) return null;
        const cars = await this.db.find('cars');
        return cars.find((c) =>
            String(c.fullModelName || `${c.brand} ${c.model}`).trim().toLowerCase() === name
        ) || null;
    }

    async findByBrandOrModel(searchTerm = '') {
        const term = String(searchTerm || '').trim().toLowerCase();
        if (!term) return await this.find();

        const cars = await this.db.find('cars');
        return cars.filter((car) => {
            if (car.isActive === false) return false;
            const haystack = [
                car.fullModelName,
                car.brand,
                car.model,
                car.code,
                car.category
            ].join(' ').toLowerCase();
            return haystack.includes(term);
        });
    }

    async updateOne(query, updateData) {
        const existing = await this.findOne(query);
        if (!existing) return null;

        const payload = this.normalizeCarPayload({ ...existing, ...updateData });
        if (!payload.parts.length) {
            throw new Error('يجب إضافة جزء واحد على الأقل.');
        }

        const duplicate = await this.findByFullModelName(payload.fullModelName);
        if (duplicate && String(duplicate._id) !== String(existing._id)) {
            throw new Error(`السيارة "${payload.fullModelName}" مسجلة مسبقاً.`);
        }

        return await this.db.updateOne('cars', query, payload);
    }

    async deleteOne(query) {
        return await this.db.deleteOne('cars', query);
    }

    async deleteWithCheck(id) {
        const car = await this.findOne({ _id: id });
        if (!car) {
            throw new Error('السيارة غير موجودة.');
        }

        const invoices = await this.db.find('salesinvoices');
        const linkedInvoices = invoices.filter((inv) => {
            const carId = typeof inv.carModel === 'object' ? inv.carModel._id : inv.carModel;
            return String(carId) === String(id);
        });

        if (linkedInvoices.length > 0) {
            const numbers = linkedInvoices
                .slice(0, 5)
                .map((i) => i.invoiceNumber || i._id)
                .join(', ');
            throw new Error(
                `لا يمكن حذف السيارة - مرتبطة بـ ${linkedInvoices.length} فاتورة (${numbers}${linkedInvoices.length > 5 ? '...' : ''})`
            );
        }

        const jobs = await this.db.find('servicejobs');
        const linkedJobs = jobs.filter((job) => {
            const carId = typeof job.carModel === 'object' ? job.carModel._id : job.carModel;
            return String(carId) === String(id);
        });

        if (linkedJobs.length > 0) {
            throw new Error(`لا يمكن حذف السيارة - مرتبطة بـ ${linkedJobs.length} أمر تشغيل.`);
        }

        await this.deleteOne({ _id: id });
        return { deleted: true, id };
    }

    async countDocuments(query = {}) {
        return await this.db.countDocuments('cars', query);
    }

    async importFromExcel(fileBuffer) {
        const workbook = xlsx.read(fileBuffer, { type: 'buffer' });
        const sheet = workbook.Sheets[workbook.SheetNames[0]];
        const rows = xlsx.utils.sheet_to_json(sheet, { defval: '' });

        if (!rows.length) {
            throw new Error('ملف المقاسات فارغ.');
        }

        const groups = {};

        rows.forEach((row) => {
            const fullModelName = String(
                row['Car Model'] || row.carModel || row.fullModelName || row.model || ''
            ).trim();
            const partName = String(row['Part'] || row.partName || row.part || '').trim();
            if (!fullModelName || !partName) return;

            if (!groups[fullModelName]) {
                const resolved = splitModelName(fullModelName);
                const yearMatch = fullModelName.match(/\b(19|20)\d{2}\b/);
                groups[fullModelName] = {
                    code: buildCarCode(fullModelName, yearMatch ? yearMatch[0] : ''),
                    brand: row.brand || resolved.brand,
                    model: row.model || resolved.model,
                    fullModelName,
                    year: row.year || (yearMatch ? Number(yearMatch[0]) : null),
                    category: row.category || row['Car Category'] || 'Sedan',
                    parts: []
                };
            }

            groups[fullModelName].parts.push(normalizePart({
                name: partName,
                lengthCM: row['Length (Cm)'] || row.lengthCM || row.length,
                widthCM: row['Width (cm)'] || row['Width (Cm)'] || row.widthCM || row.width,
                notes: row.notes || row.Notes || ''
            }));
        });

        let created = 0;
        let updated = 0;

        for (const modelName of Object.keys(groups)) {
            const raw = groups[modelName];
            const payload = this.normalizeCarPayload(raw);
            const existing = await this.findByFullModelName(payload.fullModelName);

            if (existing) {
                await this.updateOne({ _id: existing._id }, payload);
                updated += 1;
            } else {
                await this.db.create('cars', {
                    ...payload,
                    createdAt: new Date().toISOString()
                });
                created += 1;
            }
        }

        return {
            message: `تم استيراد المقاسات بنجاح. جديد: ${created} | محدث: ${updated}`,
            created,
            updated,
            modelsCount: Object.keys(groups).length
        };
    }

    exportToExcel(filter = {}) {
        const carsPromise = filter.search
            ? this.findByBrandOrModel(filter.search)
            : this.find(filter);

        return carsPromise.then((cars) => {
            const rows = [];
            cars.forEach((car) => {
                if (car.parts && car.parts.length) {
                    car.parts.forEach((part) => {
                        rows.push({
                            'Car Model': car.fullModelName || `${car.brand} ${car.model}`,
                            Part: part.name,
                            'Length (Cm)': part.lengthCM,
                            'Width (cm)': part.widthCM,
                            brand: car.brand,
                            model: car.model,
                            year: car.year || '',
                            category: car.category || '',
                            code: car.code || '',
                            areaCM2: part.areaCM2,
                            areaM2: part.areaM2,
                            isRoof: part.isRoof ? 'Yes' : 'No',
                            notes: part.notes || ''
                        });
                    });
                } else {
                    rows.push({
                        'Car Model': car.fullModelName || `${car.brand} ${car.model}`,
                        brand: car.brand,
                        model: car.model,
                        year: car.year || '',
                        category: car.category || '',
                        code: car.code || ''
                    });
                }
            });

            const worksheet = xlsx.utils.json_to_sheet(rows);
            const workbook = xlsx.utils.book_new();
            xlsx.utils.book_append_sheet(workbook, worksheet, 'Cars');
            return xlsx.write(workbook, { type: 'buffer', bookType: 'xlsx' });
        });
    }
}

module.exports = new Car();
