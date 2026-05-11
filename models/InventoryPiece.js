/**
 * Inventory Piece Model
 * لتخزين القطع المقطوعة من الرولات
 */

const FileDbManager = require('../file_db_manager');
const db = new FileDbManager();

class InventoryPiece {
    constructor(data) {
        this._id = data._id || null;
        this.pieceCode = data.pieceCode;           // كود القطعة: 57901/2-C1
        this.parentRollCode = data.parentRollCode;  // كود الرول الأب: 57901/2
        this.productCode = data.productCode;        // كود المنتج: P2
        this.materialType = data.materialType;      // نوع الخامة: ppf, vinyl, window_film
        this.materialName = data.materialName;      // اسم الخامة: Paint Protection Film
        this.productName = data.productName;        // اسم الصنف: تركيب عريض K.C
        
        // الأبعاد
        this.lengthCm = data.lengthCm || 0;         // الطول بالسم
        this.widthCm = data.widthCm || 0;           // العرض بالسم (غالباً 152)
        this.area = data.area || 0;                 // المساحة بالمتر المربع
        
        // الحالة
        this.status = data.status || 'available';    // available, consumed, remnant
        this.type = data.type || 'piece';            // piece (قطعة), remnant (بواقي)
        
        // الربط
        this.jobOrderId = data.jobOrderId || null;  // رقم أمر الشغل
        this.salesInvoiceId = data.salesInvoiceId || null; // رقم الفاتورة
        this.stockTransactionId = data.stockTransactionId || null; // رقم حركة الصرف
        
        // البيانات الوصفية
        this.notes = data.notes || '';
        this.cutDate = data.cutDate || new Date().toISOString();
        this.cutBy = data.cutBy || '';              // من قصها
        this.warehouseId = data.warehouseId || '';
        
        // الباركود/الرقم التسلسلي
        this.barcode_id = data.barcode_id || data.barcodeId || data.barcode || data.pieceCode;
        this.barcodeId = this.barcode_id;
        this.barcode = data.barcode || this.barcode_id;
        
        // إذا كانت بواقي
        this.isRemnant = data.isRemnant || false;
        this.remnantReason = data.remnantReason || ''; // سبب البواقي
    }

    static async findById(id) {
        return await db.findById('inventory_pieces', id);
    }

    static async findAll(query = {}) {
        const pieces = await db.find('inventory_pieces', query);
        return pieces;
    }

    static async findByCode(code) {
        const pieces = await this.findAll();
        return pieces.find(p => p.pieceCode === code);
    }

    static async findByParentRoll(parentRollCode) {
        const pieces = await this.findAll();
        return pieces.filter(p => p.parentRollCode === parentRollCode);
    }

    static async findByProduct(productCode) {
        const pieces = await this.findAll();
        return pieces.filter(p => p.productCode === productCode);
    }

    static async findByMaterialType(materialType) {
        const pieces = await this.findAll();
        return pieces.filter(p => p.materialType === materialType);
    }

    static async findAvailable(filters = {}) {
        const pieces = await this.findAll({ status: 'available', ...filters });
        return pieces;
    }

    static async findRemnants() {
        return await this.findAll({ type: 'remnant', status: 'available' });
    }

    static async getSmartSuggestions(productCode, requiredArea, dimensions = {}) {
        // الحصول على اقتراحات ذكية للأكواد المتاحة
        const suggestions = [];
        const requiredLength = Number(dimensions.lengthCm || 0);
        const requiredWidth = Number(dimensions.widthCm || 0);
        const canFit = (lengthCm, widthCm, area) => {
            if (requiredLength && requiredWidth) {
                const direct = Number(lengthCm || 0) >= requiredLength && Number(widthCm || 0) >= requiredWidth;
                const rotated = Number(lengthCm || 0) >= requiredWidth && Number(widthCm || 0) >= requiredLength;
                return direct || rotated;
            }
            return Number(area || 0) >= requiredArea;
        };
        const wasteScore = (itemArea) => Math.max(0, Number(itemArea || 0) - Number(requiredArea || 0));
        
        // 1. البحث عن رولات كاملة متاحة
        const FileDbManager = require('../file_db_manager');
        const rollDb = new FileDbManager();
        const rolls = await rollDb.find('rollbalances');
        
        console.log(`[DEBUG] Searching for: ${productCode}, requiredArea: ${requiredArea}`);
        console.log(`[DEBUG] Total rolls found in DB: ${rolls ? rolls.length : 0}`);

        const availableRolls = (rolls || []).filter(r => 
            (String(r.productCode || '') === String(productCode) || String(r.productName || '').toLowerCase() === String(productCode).toLowerCase()) && 
            (String(r.status || '').toLowerCase() === 'available' || String(r.status || '').toLowerCase() === 'open') &&
            canFit(r.currentLengthCm || r.originalLengthCm, r.widthCm || r.width, r.currentArea || r.originalArea || 0)
        );
        
        console.log(`[DEBUG] Matching rolls found: ${availableRolls.length}`);
        
        for (const roll of availableRolls) {
            suggestions.push({
                type: 'full_roll',
                code: roll.rollCode || roll.barcode,
                barcode_id: roll.barcode_id || roll.barcodeId || roll.barcode || roll.rollCode,
                name: roll.name || roll.productName,
                lengthCm: roll.lengthCm || roll.originalLengthCm,
                widthCm: roll.widthCm || roll.width,
                area: roll.currentArea || roll.originalArea,
                status: 'available',
                source: 'roll',
                originalLength: roll.originalLengthCm,
                waste: wasteScore(roll.currentArea || roll.originalArea),
                remainingLength: roll.remainingLengthCm || roll.currentLengthCm
            });
        }
        
        // 2. البحث عن قطع متاحة من نفس المنتج
        const allPieces = await this.findAll({ status: 'available' });
        const pieces = allPieces.filter(p => 
            String(p.productCode) === String(productCode) || 
            String(p.productName).toLowerCase() === String(productCode).toLowerCase()
        );
        
        for (const piece of pieces) {
            if (canFit(piece.lengthCm, piece.widthCm, piece.area)) {
                suggestions.push({
                    type: piece.type,
                    code: piece.pieceCode,
                    barcode_id: piece.barcode_id || piece.barcodeId || piece.barcode || piece.pieceCode,
                    name: piece.productName,
                    lengthCm: piece.lengthCm,
                    widthCm: piece.widthCm,
                    area: piece.area,
                    status: piece.status,
                    source: 'piece',
                    parentRoll: piece.parentRollCode,
                    isRemnant: piece.isRemnant,
                    waste: wasteScore(piece.area)
                });
            }
        }
        
        // 3. البحث عن بواقي مناسبة
        const remnants = await this.findRemnants();
        const suitableRemnants = remnants.filter(r => 
            (String(r.productCode) === String(productCode) || String(r.productName).toLowerCase() === String(productCode).toLowerCase()) && 
            canFit(r.lengthCm, r.widthCm, r.area)
        );
        
        for (const remnant of suitableRemnants) {
            suggestions.push({
                type: 'remnant',
                code: remnant.pieceCode,
                barcode_id: remnant.barcode_id || remnant.barcodeId || remnant.barcode || remnant.pieceCode,
                name: `${remnant.productName} (بواقي)`,
                lengthCm: remnant.lengthCm,
                widthCm: remnant.widthCm,
                area: remnant.area,
                status: remnant.status,
                source: 'remnant',
                parentRoll: remnant.parentRollCode,
                waste: wasteScore(remnant.area)
            });
        }
        
        // ترتيب الاقتراحات: أصغر فضلة مناسبة أولاً، ثم القطع، ثم الرولات الكاملة
        return suggestions.sort((a, b) => {
            const priority = { remnant: 0, piece: 1, full_roll: 2 };
            if (priority[a.type] !== priority[b.type]) {
                return priority[a.type] - priority[b.type];
            }
            return (a.waste || 0) - (b.waste || 0);
        });
    }

    async save() {
        const data = { ...this };
        delete data._id;
        
        // Remove methods from data
        Object.keys(data).forEach(key => {
            if (typeof data[key] === 'function') {
                delete data[key];
            }
        });
        
        if (this._id) {
            // Update existing
            await db.updateOne('inventory_pieces', { _id: this._id }, data);
            return this;
        } else {
            // Create new
            const created = await db.create('inventory_pieces', data);
            this._id = created._id;
            this.createdAt = created.createdAt;
            this.updatedAt = created.updatedAt;
            return this;
        }
    }

    static async update(id, data) {
        return await db.updateOne('inventory_pieces', { _id: id }, data);
    }

    static async delete(id) {
        return await db.deleteOne('inventory_pieces', { _id: id });
    }

    static async deleteByParentRoll(parentRollCode) {
        const pieces = await this.findByParentRoll(parentRollCode);
        for (const piece of pieces) {
            await db.deleteOne('inventory_pieces', { _id: piece._id });
        }
        return pieces.length;
    }

    // إحصائيات
    static async getStats() {
        const pieces = await db.find('inventory_pieces', {});
        return {
            totalPieces: pieces.length,
            availablePieces: pieces.filter(p => p.status === 'available').length,
            consumedPieces: pieces.filter(p => p.status === 'consumed').length,
            totalRemnants: pieces.filter(p => p.type === 'remnant').length,
            totalArea: pieces.reduce((sum, p) => sum + (p.area || 0), 0),
            availableArea: pieces
                .filter(p => p.status === 'available')
                .reduce((sum, p) => sum + (p.area || 0), 0)
        };
    }
}

module.exports = InventoryPiece;
