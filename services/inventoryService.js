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

function toCentimeters(value) {
    const numeric = normalizeNumber(value);
    if (!numeric) return 0;
    return numeric <= 50 ? Math.round(numeric * 100) : Math.round(numeric);
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

async function processInbound(transactionData) {
    try {
        const items = transactionData.items || [];
        const transactionId = transactionData._id;
        const warehouseId = transactionData.warehouseId || 'main_warehouse';

        for (const item of items) {
            const productId = item.product || item.productCode;
            const area = normalizeNumber(item.area || item.quantity);

            // 1. Update Product Current Stock
            const product = await db.findById('products', productId);
            if (product) {
                const newStock = (product.currentStock || 0) + area;
                await db.updateOne('products', { _id: productId }, { 
                    currentStock: Number(newStock.toFixed(3)),
                    updatedAt: new Date().toISOString()
                });
            }

            // 2. Handle specific inventory types (Rolls vs Pieces)
            if (item.itemType === 'roll' || item.type === 'roll') {
                // Prefer roll code coming from UI (structured format)
                const rollCode = cleanText(item.rollCode) || `R-${Date.now().toString(36)}-${Math.floor(Math.random() * 1000)}`;
                const barcodeValue = cleanText(item.barcode_id || item.barcodeId || item.barcode || rollCode) || rollCode;
                
                // Get dimensions in cm (prefer cm values, fallback to meters×100)
                const lengthCm = Number(item.lengthCm || 0) || Math.round(Number(item.customDimensions?.length || 0) * 100);
                const widthCm = Number(item.widthCm || 0) || Math.round(Number(item.customDimensions?.width || 0) * 100);
                
                await db.create('rollbalances', {
                    product: productId,
                    productCode: productId,
                    productName: item.productName || (product ? product.name : ''),
                    barcode_id: barcodeValue,
                    barcodeId: barcodeValue,
                    barcode: barcodeValue,
                    rollCode: rollCode,
                    originalArea: area,
                    currentArea: area,
                    remainingArea: area,
                    originalLengthCm: lengthCm,
                    currentLengthCm: lengthCm,
                    remainingLengthCm: lengthCm,
                    originalWidthCm: widthCm,
                    width: widthCm,
                    widthCm: widthCm,
                    status: 'Available',
                    warehouse: warehouseId,
                    warehouseId: warehouseId,
                    source: 'Stock Receipt',
                    purchaseInvoiceId: transactionData.purchaseInvoiceId || transactionData.supplierDoc,
                    supplierDoc: transactionData.supplierDoc || '',
                    receivedDate: transactionData.date || new Date().toISOString().split('T')[0],
                    createdAt: new Date().toISOString()
                });
            } else if (item.itemType === 'piece' || item.type === 'piece' || item.itemType === 'remnant') {
                const pieceCode = item.pieceCode || `P-${Date.now().toString(36)}`;
                const lengthCm = Number(item.lengthCm || 0) || toCentimeters(item.customDimensions?.length || 0);
                const widthCm = Number(item.widthCm || 0) || toCentimeters(item.customDimensions?.width || 0);
                const parentRollCode = cleanText(item.parentRollCode || item.parentRoll || '');
                const barcodeValue = cleanText(item.barcode_id || item.barcodeId || item.barcode) ||
                    buildRemnantBarcode(parentRollCode || pieceCode, lengthCm, widthCm);
                await db.create('inventory_pieces', {
                    pieceCode: pieceCode,
                    barcode_id: barcodeValue,
                    barcodeId: barcodeValue,
                    barcode: barcodeValue,
                    parentRollCode,
                    product: productId,
                    productCode: productId,
                    productName: item.productName || (product ? product.name : ''),
                    lengthCm,
                    widthCm,
                    area: area,
                    status: 'available',
                    type: item.itemType || 'piece',
                    warehouseId: warehouseId,
                    source: 'Stock Receipt',
                    createdAt: new Date().toISOString()
                });
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Error in processInbound:', error);
        throw error;
    }
}

        async function processOutbound(transactionData) {
    try {
        const items = transactionData.items || [];
        const warehouseId = transactionData.warehouseId || 'main_warehouse';

        for (const item of items) {
            const productId = item.product || item.productCode;
            const area = normalizeNumber(item.area || item.quantity);

            // 1. Update Product Current Stock (Reduce)
            const product = await db.findById('products', productId);
            if (product) {
                const newStock = Math.max(0, (product.currentStock || 0) - area);
                await db.updateOne('products', { _id: productId }, { 
                    currentStock: Number(newStock.toFixed(3)),
                    updatedAt: new Date().toISOString()
                });
            }

            // 2. Update specific inventory item status
            if (item.rollCode) {
                const roll = await db.findOne('rollbalances', { rollCode: item.rollCode });
                console.log('processOutbound roll consumption debug:', {
                    productId,
                    rollCode: item.rollCode,
                    area,
                    consumedLength: item.consumedLength || 0,
                    selectedSource: item.selectedSource || item.source || 'roll'
                });
                if (roll) {
                    const newArea = Math.max(0, (roll.currentArea || 0) - area);
                    const newStatus = newArea <= 0.05 ? 'Consumed' : 'PartiallyUsed';
                    
                    // Update the roll's remaining area and status
                    // تحديث الرول
                    await db.updateOne('rollbalances', { _id: roll._id }, {
                        currentArea: Number(newArea.toFixed(3)),
                        remainingArea: Number(newArea.toFixed(3)),
                        status: newStatus,
                        updatedAt: new Date().toISOString()
                    });
                }
            } else if (item.pieceCode) {
                const piece = await db.findOne('inventory_pieces', { pieceCode: item.pieceCode });
                if (piece) {
                    await db.updateOne('inventory_pieces', { _id: piece._id }, {
                        status: 'consumed',
                        consumedDate: new Date().toISOString(),
                        jobOrderId: transactionData.jobOrderId
                    });
                }
            }
        }
        return { success: true };
    } catch (error) {
        console.error('Error in processOutbound:', error);
        throw error;
    }
}

async function syncProductsFromStock({ dryRun = false } = {}) {
    const products = await db.find('products');
    const productById = new Map((products || []).map((p) => [String(p._id), p]));

    const rolls = await db.find('rollbalances');
    const pieces = await db.find('inventory_pieces');

    const ensureKey = (materialType, productName) => `${normalizeMaterialType(materialType)}||${cleanText(productName).toLowerCase()}`;

    const wanted = new Map();
    for (const r of (rolls || [])) {
        const name = r.productName || '';
        const mat = r.materialType || '';
        if (!cleanText(name) || !cleanText(mat)) continue;
        wanted.set(ensureKey(mat, name), { materialType: normalizeMaterialType(mat), productName: name });
    }
    for (const p of (pieces || [])) {
        const name = p.productName || '';
        const mat = p.materialType || '';
        if (!cleanText(name) || !cleanText(mat)) continue;
        wanted.set(ensureKey(mat, name), { materialType: normalizeMaterialType(mat), productName: name });
    }

    const ensuredProducts = new Map();
    let createdCount = 0;
    for (const { materialType, productName } of wanted.values()) {
        const normalizedName = repairArabicMojibake(productName);
        const key = ensureKey(materialType, normalizedName);
        if (ensuredProducts.has(key)) continue;

        const existing = (products || []).find((row) =>
            cleanText(row.name).toLowerCase() === cleanText(normalizedName).toLowerCase() &&
            normalizeMaterialType(row.materialType || row.type || '') === materialType
        );

        if (existing) {
            ensuredProducts.set(key, existing);
            continue;
        }

        if (dryRun) {
            createdCount += 1;
            continue;
        }

        const created = await ensureInventoryProduct({ productName: normalizedName, materialType });
        createdCount += 1;
        products.push(created);
        productById.set(String(created._id), created);
        ensuredProducts.set(key, created);
    }

    const fixRefs = async (collectionName, rows, idField = '_id') => {
        let fixed = 0;
        for (const row of (rows || [])) {
            const name = row.productName || '';
            const mat = row.materialType || '';
            if (!cleanText(name) || !cleanText(mat)) continue;

            const normalizedName = repairArabicMojibake(name);
            const key = ensureKey(mat, normalizedName);
            const targetProduct = ensuredProducts.get(key) ||
                (products || []).find((p) =>
                    cleanText(p.name).toLowerCase() === cleanText(normalizedName).toLowerCase() &&
                    normalizeMaterialType(p.materialType || p.type || '') === normalizeMaterialType(mat)
                );

            if (!targetProduct) continue;

            const currentProductId = cleanText(row.product);
            const productExists = currentProductId && productById.has(String(currentProductId));
            const needsFix = !productExists || String(currentProductId) !== String(targetProduct._id);

            if (!needsFix) continue;
            fixed += 1;
            if (dryRun) continue;

            await db.updateOne(collectionName, { [idField]: row[idField] }, {
                product: targetProduct._id,
                productCode: targetProduct._id,
                productName: targetProduct.name,
                materialType: normalizeMaterialType(mat)
            });
        }
        return fixed;
    };

    const fixedRolls = await fixRefs('rollbalances', rolls, '_id');
    const fixedPieces = await fixRefs('inventory_pieces', pieces, '_id');

    return {
        dryRun,
        distinctItems: wanted.size,
        createdProducts: createdCount,
        fixedRollRefs: fixedRolls,
        fixedPieceRefs: fixedPieces
    };
}

async function processCuttingAction({ rollBarcode, cutLength, cutWidth, remainingLength, remainingWidth, jobId, warehouseId, inspectionReport }) {
    if (!rollBarcode) throw new Error('Roll barcode is required for cutting action.');
    if (!cutLength || !cutWidth) throw new Error('Cut length and width are required.');

    const roll = await db.findOne('rollbalances', {
        $or: [
            { barcode_id: rollBarcode },
            { barcodeId: rollBarcode },
            { barcode: rollBarcode },
            { rollCode: rollBarcode }
        ]
    });

    if (!roll) throw new Error(`Roll with barcode ${rollBarcode} not found.`);

    // Calculate consumed area and new remaining area of the roll
    const consumedArea = buildArea(cutLength, cutWidth);
    const newRollArea = Math.max(0, (roll.currentArea || 0) - consumedArea);
    const newRollStatus = newRollArea <= 0.05 ? 'Consumed' : 'PartiallyUsed';

    // Update the original roll
    await db.updateOne('rollbalances', { _id: roll._id }, {
        currentArea: Number(newRollArea.toFixed(3)),
        remainingArea: Number(newRollArea.toFixed(3)),
        // currentLengthCm and remainingLengthCm of the roll are not updated by a single cut
        // The roll's overall length is not changed, only its available area.
        status: newRollStatus,
        updatedAt: new Date().toISOString()
    });

    // Create a remnant piece if there's a specified remaining piece
    if (remainingLength > 0 && remainingWidth > 0) {
        const remnantArea = buildArea(remainingLength, remainingWidth);
        const parentBarcode = roll.barcode_id || roll.barcodeId || roll.barcode || roll.rollCode;
        // Generate a unique barcode for the remnant
        const pieceBarcode = `${parentBarcode}-R-${Date.now().toString().slice(-6)}-${Math.floor(Math.random() * 1000)}`;

        await db.create('inventory_pieces', {
            pieceCode: pieceBarcode,
            barcode_id: pieceBarcode,
            barcodeId: pieceBarcode,
            barcode: pieceBarcode,
            parentRollCode: roll.rollCode,
            parentBarcode: parentBarcode,
            parentId: roll._id,
            product: roll.product,
            productCode: roll.productCode,
            productName: roll.productName,
            materialType: roll.materialType,
            materialName: roll.productName,
            lengthCm: remainingLength,
            widthCm: remainingWidth,
            area: remnantArea,
            status: 'available',
            type: 'remnant',
            isRemnant: true,
            warehouseId: warehouseId || roll.warehouseId || 'main_warehouse',
            source: 'cutting_action',
            serviceJobId: jobId,
            inspectionReport,
            createdAt: new Date().toISOString()
        });
    }

    return { success: true, newRollArea, newRollStatus };
}

async function getSmartSuggestions(productIdentifier, desiredArea = 0, lengthCm = 0, widthCm = 0, warehouseId = '') {
    const products = await db.find('products');
    let product = products.find(p => 
        p._id === productIdentifier || 
        p.inventorySlug === productIdentifier || 
        p.code === productIdentifier ||
        p.name === productIdentifier
    );

    if (!product) return [];

    const productId = product._id;
    const suggestions = [];
    const requestedArea = normalizeNumber(desiredArea);
    const requestedLength = normalizeNumber(lengthCm);
    const requestedWidth = normalizeNumber(widthCm);
    const normalizedWarehouse = cleanText(warehouseId);

    const matchesWarehouse = (row) => {
        if (!normalizedWarehouse) return true;
        return cleanText(row.warehouseId || row.warehouse || row.path || '') === normalizedWarehouse;
    };

    const enrichSuggestion = (entry) => {
        const candidateArea = normalizeNumber(entry.area);
        const candidateLength = normalizeNumber(entry.lengthCm);
        const candidateWidth = normalizeNumber(entry.widthCm);

        const fitsLength = requestedLength <= 0 || candidateLength + 0.01 >= requestedLength;
        const fitsWidth = requestedWidth <= 0 || candidateWidth + 0.01 >= requestedWidth;
        const fitsArea = requestedArea <= 0 || candidateArea + 0.01 >= requestedArea;
        const canFit = fitsLength && fitsWidth && fitsArea;

        const widthDelta = requestedWidth > 0 ? Math.abs(candidateWidth - requestedWidth) : 0;
        const wasteArea = requestedArea > 0 ? Math.max(0, candidateArea - requestedArea) : candidateArea;
        const lengthDelta = requestedLength > 0 ? Math.abs(candidateLength - requestedLength) : 0;

        return {
            ...entry,
            canFit,
            widthDelta: Number(widthDelta.toFixed(3)),
            wasteArea: Number(wasteArea.toFixed(3)),
            lengthDelta: Number(lengthDelta.toFixed(3))
        };
    };

    // 1. Check Pieces / Remnants (Priority 1: Waste-First)
    const pieces = await db.find('inventory_pieces');
    const availablePieces = pieces.filter(p => 
        p.product === productId && 
        p.status === 'available' &&
        matchesWarehouse(p)
    );

    availablePieces.forEach(p => {
        const suggestionType = p.type === 'piece' ? 'piece' : 'remnant';
        suggestions.push(enrichSuggestion({
            type: suggestionType,
            code: p.pieceCode,
            name: p.productName,
            lengthCm: p.lengthCm,
            widthCm: p.widthCm,
            area: p.area,
            source: 'piece',
            barcode_id: p.barcode_id || p.barcodeId || p.barcode || p.pieceCode,
            parentRoll: p.parentRollCode || '',
            parentRollCode: p.parentRollCode || '',
            isRemnant: suggestionType === 'remnant',
            priority: 1 // Highest priority for remnants
        }));
    });

    // 2. Check Rolls - Separate Opened and Full Rolls
    const rolls = await db.find('rollbalances');
    const availableRolls = rolls.filter(r => 
        r.product === productId && 
        ['available', 'Available', 'PartiallyUsed', 'open'].includes(r.status) &&
        (r.currentArea || r.remainingArea) > 0 &&
        matchesWarehouse(r)
    );

    availableRolls.forEach(r => {
        const currentArea = r.currentArea || r.remainingArea || 0;
        const currentLength = r.currentLengthCm || r.remainingLengthCm || r.originalLengthCm || 0;
        const isOpened = r.status === 'PartiallyUsed' || r.status === 'open' || 
                        (currentLength < (r.originalLengthCm || currentLength));
        
        suggestions.push(enrichSuggestion({
            type: isOpened ? 'opened_roll' : 'full_roll',
            code: r.rollCode,
            name: r.productName,
            lengthCm: currentLength,
            widthCm: r.width || r.widthCm || 0,
            area: currentArea,
            source: 'roll',
            barcode_id: r.barcode_id || r.barcodeId || r.barcode || r.rollCode,
            priority: isOpened ? 2 : 3 // Opened rolls priority 2, Full rolls priority 3
        }));
    });

    // Sort by Waste-First Consumption Logic:
    // 1) Priority: Remnants (1) > Opened Rolls (2) > Full Rolls (3)
    // 2) Within same priority: fitting candidates first
    // 3) For remnants: closest length to requested (but not less than)
    // 4) Closest width to requested width
    // 5) Lowest waste area
    return suggestions.sort((a, b) => {
        // Priority 1: Type-based priority
        if (a.priority !== b.priority) return a.priority - b.priority;

        // Priority 2: Fitting candidates first
        if (a.canFit !== b.canFit) return a.canFit ? -1 : 1;

        // Priority 3: For remnants, sort by closest length (but not less than)
        if (a.priority === 1 && b.priority === 1) {
            const aFitsLength = a.lengthCm >= requestedLength - 0.01;
            const bFitsLength = b.lengthCm >= requestedLength - 0.01;
            
            if (aFitsLength && !bFitsLength) return -1;
            if (!aFitsLength && bFitsLength) return 1;
            
            if (aFitsLength && bFitsLength) {
                // Both fit - prefer closer to requested length
                if (a.lengthDelta !== b.lengthDelta) return a.lengthDelta - b.lengthDelta;
            }
        }

        // Priority 4: Closest width
        if (a.widthDelta !== b.widthDelta) return a.widthDelta - b.widthDelta;

        // Priority 5: Lowest waste
        if (a.wasteArea !== b.wasteArea) return a.wasteArea - b.wasteArea;

        // Priority 6: Smaller area as fallback
        return normalizeNumber(a.area) - normalizeNumber(b.area);
    });
}

module.exports = {
    buildArea,
    buildRemnantBarcode,
    findInventoryItemByBarcode,
    importOpeningInventoryRows,
    parseOpeningInventoryText,
    repairArabicMojibake,
    resetOperationalInventory,
    processInbound,
    processOutbound,
    processStockOut: processOutbound,
    syncProductsFromStock,
    getSmartSuggestions,
    processCuttingAction // New function for cutting rolls
};
