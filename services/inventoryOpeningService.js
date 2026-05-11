const FileDbManager = require('../file_db_manager');

const db = new FileDbManager();

function cleanText(value = '') {
    return String(value || '').replace(/^\uFEFF/, '').trim();
}

function repairArabicMojibake(value = '') {
    const text = cleanText(value);
    if (!text) return '';

    if (/[ØÙ]/.test(text)) {
        try {
            return Buffer.from(text, 'latin1').toString('utf8').trim();
        } catch (error) {
            return text;
        }
    }

    return text;
}

function normalizeMaterialType(value = '') {
    const text = repairArabicMojibake(value).toLowerCase();
    const compact = text.replace(/\s+/g, '');
    if (compact.includes('wf') || text.includes('window')) return 'window_film';
    if (text.includes('matt') || text.includes('ساتن')) return 'matt';
    if (text.includes('plixi') || text.includes('plexi')) return 'protection';
    if (text.includes('vinyl')) return 'vinyl';
    return text || 'ppf';
}

function normalizeRowType(value = '') {
    const raw = cleanText(value).toLowerCase();
    const text = repairArabicMojibake(value).toLowerCase();
    if (raw.includes('ø±ùˆù„')) return 'roll';
    if (raw.includes('ø¨ùˆø§ù‚ù‰')) return 'remnant';
    if (text.includes('roll') || text.includes('رول')) return 'roll';
    if (text.includes('بواقي') || text.includes('بواقى') || text.includes('فضلة') || text.includes('remnant')) return 'remnant';
    return 'roll';
}

function normalizeStatus(value = '') {
    const raw = cleanText(value).toLowerCase();
    const text = repairArabicMojibake(value).toLowerCase();
    if (raw.includes('ø­ø¯ùšø¯')) return 'available';
    if (raw.includes('ù…ø±ø­ù„')) return 'available';
    if (text.includes('مستهلك') || text.includes('consumed')) return 'consumed';
    if (text.includes('open') || text.includes('مفتوح')) return 'open';
    return 'available';
}

function normalizeNumber(value) {
    const text = cleanText(value).replace(',', '.');
    const numeric = Number(text);
    return Number.isFinite(numeric) ? numeric : 0;
}

function splitLine(line) {
    const byTabs = line.split('\t').map((segment) => cleanText(segment));
    if (byTabs.length >= 7) return byTabs;
    return line.split(/\s{2,}/).map((segment) => cleanText(segment));
}

function mapProductType(materialType) {
    if (materialType === 'window_film') {
        return 'Thermal Insulation Window Film';
    }

    if (materialType === 'matt') {
        return 'Paint Protection Film (MATT)';
    }

    if (materialType === 'vinyl') {
        return 'Vinyl Wrapping';
    }

    if (materialType === 'protection') {
        return 'Protection';
    }

    return 'Paint Protection Film (PPF)';
}

function slugify(input) {
    return cleanText(input)
        .toLowerCase()
        .replace(/[^a-z0-9\u0600-\u06FF]+/g, '-')
        .replace(/^-+|-+$/g, '');
}

function deriveParentRollCode(code = '') {
    const normalized = cleanText(code);
    const match = normalized.match(/^(.+?)\/\d+$/);
    return match ? match[1] : normalized;
}

function buildArea(lengthCm, widthCm) {
    return Number(((lengthCm * widthCm) / 10000).toFixed(3));
}

function buildRemnantBarcode(parentCode, lengthCm, widthCm) {
    const stamp = Date.now().toString().slice(-6);
    return `${parentCode}-R-${Math.round(lengthCm)}x${Math.round(widthCm)}-${stamp}`;
}

async function ensureInventoryProduct({ productName, materialType }) {
    const products = await db.find('products');
    const normalizedName = repairArabicMojibake(productName);

    let product = products.find((row) =>
        cleanText(row.name).toLowerCase() === normalizedName.toLowerCase() &&
        normalizeMaterialType(row.materialType || row.type || '') === materialType
    );

    if (!product) {
        product = await db.create('products', {
            name: normalizedName,
            type: mapProductType(materialType),
            serviceCategory: mapProductType(materialType),
            materialType,
            pricingType: 'مقاسات',
            unit: 'رول',
            pricing: {
                purchasePrice: 0,
                salePrice: 0,
                unitSalePrice: 0
            },
            currentStock: 0,
            isActive: true,
            isRawMaterial: true,
            source: 'inventory_opening_balance',
            inventorySlug: slugify(`${materialType}-${normalizedName}`)
        });
    }

    return product;
}

function parseOpeningInventoryText(rawText) {
    const rows = [];
    const text = cleanText(rawText);
    if (!text) return rows;

    const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
    const dataLines = lines.slice(1);

    for (const line of dataLines) {
        const cols = splitLine(line);
        if (cols.length < 7) continue;

        const materialType = normalizeMaterialType(cols[0]);
        const productName = repairArabicMojibake(cols[1]);
        const barcodeId = cleanText(cols[2]);
        const lengthCm = normalizeNumber(cols[3]);
        const widthCm = normalizeNumber(cols[4]);
        const itemType = normalizeRowType(cols[5]);
        const status = normalizeStatus(cols[6]);

        if (!barcodeId || !productName || !lengthCm || !widthCm) continue;

        rows.push({
            materialType,
            productName,
            barcode_id: barcodeId,
            barcodeId,
            code: barcodeId,
            lengthCm,
            widthCm,
            area: buildArea(lengthCm, widthCm),
            itemType,
            status
        });
    }

    return rows;
}

async function resetOperationalInventory() {
    const products = await db.find('products');
    const keptProducts = products.filter((row) => row.source !== 'inventory_opening_balance');

    await Promise.all([
        db.deleteMany('rollbalances', {}),
        db.deleteMany('inventory_pieces', {}),
        db.deleteMany('stocktransactions', {}),
    ]);

    const productsPath = db.getCollectionPath('products');
    require('fs').writeFileSync(productsPath, JSON.stringify(keptProducts, null, 2), 'utf8');

    return {
        removedProducts: products.length - keptProducts.length,
        remainingProducts: keptProducts.length
    };
}

async function importOpeningInventoryRows(rows, warehouseId = 'main_warehouse') {
    const createdRolls = [];
    const createdPieces = [];
    const transactionItems = [];
    const productTotals = new Map();

    for (const row of rows) {
        const product = await ensureInventoryProduct({
            productName: row.productName,
            materialType: row.materialType
        });

        productTotals.set(product._id, (productTotals.get(product._id) || 0) + row.area);

        if (row.itemType === 'roll') {
            const roll = await db.create('rollbalances', {
                product: product._id,
                productCode: product._id,
                barcode_id: row.barcode_id,
                barcodeId: row.barcode_id,
                barcode: row.barcode_id,
                rollCode: row.code,
                productName: product.name,
                materialType: row.materialType,
                originalArea: row.area,
                currentArea: row.area,
                remainingArea: row.area,
                originalLengthCm: row.lengthCm,
                currentLengthCm: row.lengthCm,
                remainingLengthCm: row.lengthCm,
                width: row.widthCm,
                status: row.status,
                warehouse: warehouseId,
                warehouseId,
                source: 'inventory_opening_balance'
            });

            createdRolls.push(roll);
        } else {
            const piece = await db.create('inventory_pieces', {
                pieceCode: row.code,
                barcode_id: row.barcode_id,
                barcodeId: row.barcode_id,
                barcode: row.barcode_id,
                parentRollCode: deriveParentRollCode(row.code),
                product: product._id,
                productCode: product._id,
                productName: product.name,
                materialType: row.materialType,
                materialName: product.name,
                lengthCm: row.lengthCm,
                widthCm: row.widthCm,
                area: row.area,
                status: 'available',
                type: 'remnant',
                isRemnant: true,
                warehouseId,
                source: 'inventory_opening_balance'
            });

            createdPieces.push(piece);
        }

        transactionItems.push({
            product: product._id,
            productName: product.name,
            barcode_id: row.barcode_id,
            barcode: row.barcode_id,
            rollCode: row.itemType === 'roll' ? row.code : null,
            pieceCode: row.itemType === 'remnant' ? row.code : null,
            quantity: row.area,
            area: row.area,
            itemType: row.itemType,
            customDimensions: {
                length: row.lengthCm,
                width: row.widthCm
            },
            unitCost: 0,
            totalPrice: 0
        });
    }

    for (const [productId, totalArea] of productTotals.entries()) {
        await db.updateOne('products', { _id: productId }, { currentStock: Number(totalArea.toFixed(3)) });
    }

    const openingTransaction = await db.create('stocktransactions', {
        type: 'Inbound',
        date: new Date().toISOString(),
        note: 'رصيد أول المدة - استيراد نظيف',
        warehouse: warehouseId,
        warehouseId,
        source: 'inventory_opening_balance',
        openingBalance: true,
        items: transactionItems
    });

    return {
        createdRolls: createdRolls.length,
        createdPieces: createdPieces.length,
        transactionId: openingTransaction._id
    };
}

async function findInventoryItemByBarcode(barcode) {
    const barcodeValue = cleanText(barcode);
    const rolls = await db.find('rollbalances');
    const pieces = await db.find('inventory_pieces');

    const roll = rolls.find((row) =>
        [row.barcode_id, row.barcodeId, row.barcode, row.rollCode].map(cleanText).includes(barcodeValue)
    );
    if (roll) {
        return {
            itemType: 'roll',
            code: roll.rollCode,
            barcode_id: roll.barcode_id || roll.barcodeId || roll.barcode || roll.rollCode,
            productName: roll.productName,
            materialType: roll.materialType,
            lengthCm: roll.currentLengthCm || roll.originalLengthCm || 0,
            widthCm: roll.width || roll.widthCm || 0,
            area: roll.currentArea || roll.remainingArea || roll.originalArea || 0,
            status: roll.status,
            raw: roll
        };
    }

    const piece = pieces.find((row) =>
        [row.barcode_id, row.barcodeId, row.barcode, row.pieceCode].map(cleanText).includes(barcodeValue)
    );
    if (piece) {
        return {
            itemType: piece.type || 'piece',
            code: piece.pieceCode,
            barcode_id: piece.barcode_id || piece.barcodeId || piece.barcode || piece.pieceCode,
            productName: piece.productName,
            materialType: piece.materialType,
            lengthCm: piece.lengthCm || 0,
            widthCm: piece.widthCm || 0,
            area: piece.area || 0,
            status: piece.status,
            parentRollCode: piece.parentRollCode || '',
            raw: piece
        };
    }

    return null;
}

module.exports = {
    buildArea,
    buildRemnantBarcode,
    findInventoryItemByBarcode,
    importOpeningInventoryRows,
    parseOpeningInventoryText,
    repairArabicMojibake,
    resetOperationalInventory
};
