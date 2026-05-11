/**
 * import_opening_stock.js
 * يقوم باستيراد رصيد أول المدة (رولات وبواقي) إلى قاعدة البيانات المحلية
 * Run: node import_opening_stock.js
 */

const fs = require('fs');
const path = require('path');

const DATA_PATH = path.join(__dirname, 'data_storage');

function readCollection(name) {
    const fp = path.join(DATA_PATH, name, 'index.json');
    if (!fs.existsSync(fp)) return [];
    try {
        const raw = fs.readFileSync(fp, 'utf8').replace(/^\uFEFF/, '').trim();
        return JSON.parse(raw || '[]');
    } catch(e) {
        console.error(`Error reading ${name}:`, e.message);
        return [];
    }
}

function writeCollection(name, data) {
    const fp = path.join(DATA_PATH, name, 'index.json');
    const dir = path.dirname(fp);
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(fp, JSON.stringify(data, null, 2), 'utf8');
}

function genId() {
    return `ob_${Date.now()}_${Math.random().toString(36).substr(2, 7)}`;
}

// ── Raw stock data ──────────────────────────────────────────────────────────
const rawData = `ppf	p2	4174/2	1500	152	رول	حديد
ppf	p2	49871/1	1500	152	رول	حديد
ppf	p2	49871/2	1500	152	رول	حديد
ppf	p2	54740/1	1500	152	رول	حديد
ppf	p2	54740/2	1500	152	رول	حديد
ppf	p2	52870/1	1500	152	رول	حديد
ppf	p2	52870/2	1500	152	رول	حديد
ppf	p2	55778/1	1500	152	رول	حديد
ppf	p2	5778/2	1500	152	رول	حديد
ppf	p2	59450/1	1500	152	رول	حديد
ppf	p2	59450/2	1500	152	رول	حديد
ppf	p2	54161/1	1500	152	رول	حديد
ppf	p2	54161/2	1500	152	رول	حديد
ppf	p2	56610/1	1500	152	رول	حديد
ppf	p2	56610/2	1500	152	رول	حديد
ppf	p2	57069/1	1500	152	رول	حديد
ppf	p2	57069/2	1500	152	رول	حديد
ppf	p2	5291/1	1500	152	رول	حديد
ppf	p2	52291/2	1500	152	رول	حديد
ppf	p2	57648/1	1500	152	رول	حديد
ppf	p2	57648/2	1500	152	رول	حديد
ppf	p2	56031/1	1500	152	رول	حديد
ppf	p2	56031/2	1500	152	رول	حديد
ppf	p2	55199/1	1500	152	رول	حديد
ppf	p2	55199/2	1500	152	رول	حديد
ppf	p2	51900/1	1500	152	رول	حديد
ppf	p2	51900/2	1500	152	رول	حديد
ppf	p2	48901/1	1500	152	رول	حديد
ppf	p2	48901/2	1500	152	رول	حديد
ppf	p2	59518/1	1500	152	رول	حديد
ppf	p2	59518/2	1500	152	رول	حديد
ppf	p2	50489/1	1500	152	رول	حديد
ppf	p2	50489/2	1500	152	رول	حديد
ppf	p2	54808/1	1500	152	رول	حديد
ppf	p2	54808/2	1500	152	رول	حديد
ppf	p2	54229/1	1500	152	رول	حديد
ppf	p2	54229/2	1500	152	رول	حديد
ppf	p2	59939/1	1500	152	رول	حديد
ppf	p2	59939/2	1500	152	رول	حديد
ppf	p2	51321/1	1500	152	رول	حديد
ppf	p2	51321/2	1500	152	رول	حديد
ppf	p2	57580/1	1500	152	رول	حديد
ppf	p2	57580/2	1500	152	رول	حديد
ppf	p2	52359/1	1500	152	رول	حديد
ppf	p2	04959/2	60	152	بواقى	حديد
ppf	p2	02089/2	220	152	بواقى	حديد
ppf	p2	41742/1	930	152	بواقى	حديد
ppf	p2	04959/1	520	60	بواقى	حديد
ppf	p2	04959/1	290	60	بواقى	حديد
ppf	p2	04959/2	250	60	بواقى	حديد
ppf	p2	04959/2	320	60	بواقى	حديد
ppf	p2	04959/2	120	60	بواقى	حديد
ppf	p2	02089/1	370	60	بواقى	حديد
ppf	p2	02089/2	480	30	بواقى	حديد
ppf	p2	02089/2	190	30	بواقى	حديد
ppf	p2	41742/1	570	60	بواقى	حديد
ppf	p2	09669/1	970	60	بواقى	حديد
ppf	p2	09669/2	680	30	بواقى	حديد
ppf	p2	09669/2	180	30	بواقى	حديد
ppf	p2	09669/2	170	30	بواقى	حديد
ppf	p2	87666/1	1360	60	بواقى	حديد
ppf	p2	87666/2	660	60	بواقى	حديد
ppf	p2	93084/2	280	30	بواقى	حديد
ppf	p2	07799/2	160	75	بواقى	حديد
ppf	p2	42520/1	880	30	بواقى	حديد
ppf	p2	46102/1	660	60	بواقى	حديد
ppf	p2	45360/2	660	60	بواقى	حديد
ppf	p2	45360/1	360	30	بواقى	حديد
ppf	p2	01119/2	730	60	بواقى	حديد
ppf	p2	01630/1	1020	60	بواقى	حديد
ppf	p2	93663/1	660	60	بواقى	حديد
ppf	p2	80086/2	740	60	بواقى	حديد
ppf	p2	49100/1	700	60	بواقى	حديد
ppf	p2	41813/2	700	60	بواقى	حديد
ppf	p2	46102/2	740	60	بواقى	حديد
ppf	p2	44653/2	700	60	بواقى	حديد
ppf	p2	90244/2	600	60	بواقى	حديد
ppf	p2	45781/1	70	60	بواقى	حديد
ppf	p2	06829/2	240	60	بواقى	حديد
ppf	p2	90244/1	350	60	بواقى	حديد
ppf	p2	01119/2	260	75	بواقى	حديد
ppf	p2	47230/2	340	60	بواقى	حديد
ppf	p2	96661/2	180	30	بواقى	حديد
ppf	p2	40071/2	940	30	بواقى	حديد
ppf	p2	44811/2	420	30	بواقى	حديد
ppf	p2	49100/2	180	30	بواقى	حديد
ppf	p2	44811/2	400	30	بواقى	حديد
ppf	p2	90402/2	600	60	بواقى	حديد
ppf	p2	45360/1	340	30	بواقى	حديد
ppf	p2	49521/2	240	30	بواقى	حديد
ppf	p2	91372/1	160	30	بواقى	حديد
ppf	p2	45781/2	240	30	بواقى	حديد
ppf	p2	06829/2	720	30	بواقى	حديد
ppf	p2	06829/2	210	30	بواقى	حديد
ppf	p2	97403/1	240	30	بواقى	حديد
ppf	p2	91372/2	120	30	بواقى	حديد
ppf	p2	19484/2	700	60	بواقى	مرحل
ppf	p2	17693/1	360	30	بواقى	مرحل
ppf	p2	16144/2	700	60	بواقى	مرحل
ppf	p2	60394/2	565	60	بواقى	مرحل
ppf	p2	64134/2	1170	60	بواقى	مرحل
ppf	p2	53808/2	990	60	بواقى	مرحل
ppf	p2	57901/2	810	60	بواقى	مرحل
ppf	p2	98373/1	700	60	بواقى	مرحل
ppf	p2	40129/1	640	60	بواقى	مرحل
ppf	p2	85375/1	740	60	بواقى	مرحل
ppf	p2	99080/2	280	30	بواقى	مرحل
ppf	p2	90823/2	180	30	بواقى	مرحل
ppf	p2	81407/2	700	60	بواقى	مرحل
ppf	p2	16486/1	740	60	بواقى	مرحل
ppf	p2	14774/1	740	60	بواقى	مرحل
ppf	p2	18356/1	700	60	بواقى	مرحل
MATT	ساتن  j.y.h	91094/1	80	60	بواقى	مرحل
MATT	ساتن  j.y.h	13304/2	185	30	بواقى	مرحل
MATT	ساتن  j.y.h	12983/1	120	30	بواقى	مرحل
MATT	ساتن  j.y.h	12983/1	700	30	بواقى	مرحل
MATT	ساتن  j.y.h	82535/2	800	30	بواقى	مرحل
MATT	ساتن  j.y.h	82535/2	290	30	بواقى	مرحل
MATT	ساتن  j.y.h	19984/1	270	60	بواقى	مرحل
MATT	ساتن  j.y.h	93242/1	170	60	بواقى	مرحل
MATT	ساتن  j.y.h	93242/1	200	60	بواقى	مرحل
MATT	ساتن  j.y.h	82535/1	280	60	بواقى	مرحل
MATT	ساتن  j.y.h	19984/2	220	152	بواقى	مرحل
MATT	ساتن  j.y.h	84405/1	110	152	بواقى	مرحل
MATT	ساتن  j.y.h	84405/2	1500	152	رول	مرحل
ppf	تركيب عريض K.C	55783/1	120	180	بواقى	مرحل
ppf	تركيب عريض K.C	55783/2	1120	180	بواقى	مرحل
ppf	تركيب عريض K.C	09248/1	1500	180	رول	مرحل
ppf	تركيب عريض K.C	58292/1	1500	180	رول	مرحل
ppf	تركيب عريض K.C	58292/2	1500	180	رول	مرحل
ppf	 KM - PLUS	03218/2	1500	152	رول	مرحل
ppf	كاربون فابير بلاك	44232/1	1425	152	بواقى	مرحل
ppf	 PPF لايجند ميتليك جرايه	52359/2	1050	152	بواقى	مرحل
ppf	( C )  توزيع	93242/2	1500	152	رول	مرحل
ppf	( C )  توزيع	57743/2	1500	152	رول	مرحل
ppf	( C )  توزيع	14695/1	1500	152	رول	مرحل
ppf	( C )  توزيع	14695/2	1500	152	رول	مرحل
ppf	( C )  توزيع	16565/1	1500	152	رول	مرحل
ppf	( C )  توزيع	16565/2	1500	152	رول	مرحل
ppf	( C )  توزيع	58450/2	1150	152	بواقى	مرحل
ppf	( C )  توزيع	53229/1	530	152	بواقى	مرحل
ppf	( C )  توزيع	53229/1	740	30	بواقى	مرحل
ppf	( C )  توزيع	06714/2	520	15	بواقى	مرحل
ppf	( C )  توزيع	06714/2	230	15	بواقى	مرحل
ppf	( C )  توزيع	06714/2	750	60	بواقى	مرحل
ppf	( C )  توزيع	06714/3	260	60	بواقى	مرحل
ppf	( C )  توزيع	09831/2	430	30	بواقى	مرحل
ppf	( C )  توزيع	20251/2	650	30	بواقى	مرحل
ppf	( C )  توزيع	20251/3	980	60	بواقى	مرحل
ppf	( C )  توزيع	42012/3	190	15	بواقى	مرحل
ppf	( C )  توزيع	07842/2	240	30	بواقى	مرحل
ppf	( C )  توزيع	07842/2	200	60	بواقى	مرحل
ppf	( C )  توزيع	07842/3	660	15	بواقى	مرحل
ppf	( C )  توزيع	64721/3	660	30	بواقى	مرحل
ppf	( C )  توزيع	42012/2	200	75	بواقى	مرحل
ppf	( C )  توزيع	62315/3	300	15	بواقى	مرحل
ppf	( C )  توزيع	94826/2	260	60	بواقى	مرحل
ppf	( C )  توزيع	94826/2	420	15	بواقى	مرحل
ppf	( C )  توزيع	94826/3	780	30	بواقى	مرحل
ppf	كينج ١٠  	35782/1	135	152	بواقى	مرحل
ppf	( C )  توزيع PA2	01745/1	1500	152	رول	مرحل
W F	WF 1	91951/1	3000	152	رول	مرحل
W F	WF 1	15130/1	3000	152	رول	مرحل
W F	WF 1	15130/2	3000	152	رول	مرحل
W F	WF 1	23701/1	3000	152	رول	مرحل
W F	WF 1	23701/2	3000	152	رول	مرحل
W F	WF 1	49942/1	3000	152	رول	مرحل
W F	WF 1	49942/2	3000	152	رول	مرحل
W F	WF 1	08210/1	3000	152	رول	مرحل
W F	WF 1	08210/2	3000	152	رول	مرحل
W F	WF 2	44232/2	3000	152	رول	مرحل
W F	WF 2	80665/1	3000	152	رول	مرحل
W F	WF 2	80665/2	3000	152	رول	مرحل
W F	WF 2	91951/2	3000	152	رول	مرحل
W F	WF 2	64897/2	3000	152	رول	مرحل
W F	WF 3	54357/1	3000	152	رول	مرحل
W F	WF 3	54357/2	3000	152	رول	مرحل
W F	WF 3	60136/1	3000	152	رول	مرحل
W F	WF 4	02960/1	3000	152	رول	مرحل
W F	WF 4	02960/2	3000	152	رول	مرحل
W F	WF 4	01745/2	3000	152	رول	مرحل
W F	WF 5	11934/1	3000	152	رول	مرحل
W F	WF 5	04470/1	3000	152	رول	مرحل
W F	WF 5	03500/1	3000	152	رول	مرحل
W F	WF 5	03500/2	3000	152	رول	مرحل
W F	WF 6	59464/1	3000	152	رول	مرحل
W F	WF 6	59464/2	3000	152	رول	مرحل
W F	WF 6	04585/1	3000	152	رول	مرحل
W F	WF 6	04585/2	3000	152	رول	مرحل
W F	WF 1	85954/2	170	50	بواقى	مرحل
W F	WF 1	85954/2	125	75	بواقى	مرحل
W F	WF 1	85954/2	100	50	بواقى	مرحل
W F	WF 2	64897/1	180	50	بواقى	مرحل
W F	WF 2	64897/1	200	50	بواقى	مرحل
W F	WF 2	64897/1	580	50	بواقى	مرحل
W F	WF 3	33625/1	200	50	بواقى	مرحل
W F	WF 4	33625/2	100	50	بواقى	مرحل
W F	WF 5	33046/1	170	50	بواقى	مرحل
W F	WF 5	33046/2	835	50	بواقى	مرحل
W F	WF 6	04251/2	200	50	بواقى	مرحل
W F	WF 1	15603/2	780	50	بواقى	مرحل
W F	WF 1	93385/2	1050	50	بواقى	مرحل
W F	WF 2	64897/1	790	50	بواقى	مرحل
W F	WF 2	99416/1	125	75	بواقى	مرحل
W F	WF 2	99416/1	360	50	بواقى	مرحل
W F	WF 3	17402/3	460	50	بواقى	مرحل
W F	WF 3	06121/1	1225	50	بواقى	مرحل
W F	WF 4	33625/2	490	50	بواقى	مرحل
W F	WF 4	33625/2	125	75	بواقى	مرحل
W F	WF 5	33046/1	235	50	بواقى	مرحل
W F	WF 5	33046/1	200	100	بواقى	مرحل
W F	WF 1	85954/2	170	50	بواقى	حديد
W F	WF 1	85954/2	125	75	بواقى	حديد
W F	WF 1	85954/2	100	50	بواقى	حديد
W F	WF 2	64897/1	180	50	بواقى	حديد
W F	WF 2	64897/1	200	50	بواقى	حديد
W F	WF 2	64897/1	580	50	بواقى	حديد
W F	WF 3	33625/1	200	50	بواقى	حديد
W F	WF 4	33625/2	100	50	بواقى	حديد
W F	WF 5	33046/1	170	50	بواقى	حديد
W F	WF 5	33046/2	835	50	بواقى	حديد
W F	WF 6	04251/2	200	50	بواقى	حديد
W F	WF 1	85954//2	735	152	بواقى	حديد
W F	WF 2	64897/1	960	152	بواقى	حديد
W F	WF 3	33625/1	2680	152	بواقى	حديد
W F	WF 4	33625/2	1320	152	بواقى	حديد
W F	WF 5	33046/2	230	152	بواقى	حديد
W F	WF 6	33467/2	1690	152	بواقى	حديد
Plixi	Plixi Plus	06340/1	3000	152	رول	حديد
Plixi	Plixi Plus	06340/2	3000	152	رول	حديد
Plixi	Plixi Plus	14353/2	1500	152	رول	حديد
Plixi	Plixi Plus	56227/2	140	152	بواقى	حديد
Plixi	Plixi	16731/1	3000	152	رول	حديد
Plixi	Plixi	21831/2	2470	152	بواقى	حديد
Plixi	Plixi Plus	91380/2	1320	152	بواقى	حديد
Plixi	Plixi Plus	91380/1	700	152	بواقى	حديد`;

// ── Category Mapping ────────────────────────────────────────────────────────
const categoryMap = {
    'ppf':   'Paint Protection Film (PPF)',
    'MATT':  'Paint Protection Film (MATT)',
    'W F':   'Thermal Insulation Window Film',
    'Plixi': 'Protection'
};

// ── Main ────────────────────────────────────────────────────────────────────
function main() {
    console.log('═══════════════════════════════════════════════');
    console.log('    استيراد رصيد أول المدة - WrapStyle ERP     ');
    console.log('═══════════════════════════════════════════════\n');

    // 1. Load existing data
    const products    = readCollection('products');
    const rollBals    = readCollection('rollbalances');
    const warehouses  = readCollection('warehouses');
    const stockTxns   = readCollection('stocktransactions');

    // 2. Parse raw lines
    const lines = rawData.trim().split('\n');
    console.log(`📋 إجمالي الأسطر للمعالجة: ${lines.length}\n`);

    const productCache  = {}; // key → product
    const newRollBals   = []; // to append
    const newProducts   = []; // to append
    const txnItems      = []; // all items for one bulk Inbound transaction

    let skipped = 0, created = 0, rollCreated = 0;

    for (const line of lines) {
        const parts = line.split('\t').map(p => p.trim());
        if (parts.length < 7) { skipped++; continue; }

        const [rawCat, rawName, rollCode, rawLen, rawWid, rollType, rawStatus] = parts;
        const cat       = categoryMap[rawCat] || rawCat;
        const length    = parseFloat(rawLen) || 0;
        const width     = parseFloat(rawWid) || 0;
        const area      = parseFloat(((length * width) / 10000).toFixed(4));
        const status    = rawStatus === 'حديد' ? 'حديد (جديد)' : 'مرحل (قديم)';
        const itemType  = rollType === 'رول' ? 'Roll' : 'Remnant';
        const pkey      = `${cat}|${rawName}`;

        // ── Find or create product ─────────────────────────────────────────
        if (!productCache[pkey]) {
            let prod = products.find(p =>
                p.name === rawName &&
                (p.serviceCategory === cat || p.type === cat)
            );
            if (!prod) {
                prod = {
                    _id: genId(),
                    name: rawName,
                    type: cat,
                    serviceCategory: cat,
                    pricingType: 'مقاسات',
                    unit: 'رول',
                    pricing: { purchasePrice: 0, salePrice: 0 },
                    currentStock: 0,
                    isActive: true,
                    createdAt: new Date().toISOString(),
                    updatedAt: new Date().toISOString()
                };
                newProducts.push(prod);
                products.push(prod); // keep in-memory so next lines find it
                created++;
                console.log(`  ✅ صنف جديد: ${rawName} (${cat})`);
            }
            productCache[pkey] = prod;
        }

        const product = productCache[pkey];

        // ── Create RollBalance entry ───────────────────────────────────────
        const rollEntry = {
            _id: genId(),
            product: product._id,
            productName: product.name,
            serviceCategory: cat,
            rollCode: rollCode,
            rollType: itemType,
            originalDimensions: { length, width },
            remainingLength: length,
            remainingWidth: width,
            remainingArea: area,
            originalArea: area,
            status: 'Available',
            warehouse: status,
            warehouseName: status,
            note: 'رصيد أول المدة',
            sourceType: 'OpeningBalance',
            createdAt: new Date().toISOString(),
            updatedAt: new Date().toISOString()
        };
        newRollBals.push(rollEntry);
        rollCreated++;

        // ── Accumulate for stock transaction ──────────────────────────────
        txnItems.push({
            product: product._id,
            productName: product.name,
            rollCode: rollCode,
            quantity: area,
            customDimensions: { length, width },
            unitCost: 0,
            totalPrice: 0
        });

        // ── Update product stock ───────────────────────────────────────────
        product.currentStock = parseFloat(((product.currentStock || 0) + area).toFixed(4));
    }

    // 3. Ensure warehouse records exist
    const whNames = ['حديد (جديد)', 'مرحل (قديم)'];
    for (const wn of whNames) {
        if (!warehouses.find(w => w.name === wn)) {
            warehouses.push({
                _id: genId(),
                name: wn,
                code: wn,
                path: wn,
                createdAt: new Date().toISOString()
            });
        }
    }

    // 4. Create one bulk Inbound stock transaction
    const bulkTxn = {
        _id: genId(),
        type: 'Inbound',
        date: new Date().toISOString().split('T')[0],
        note: 'رصيد أول المدة - استيراد تلقائي',
        warehouse: 'مخزن رئيسي',
        warehouseName: 'مخزن رئيسي',
        items: txnItems,
        totalAmount: 0,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
    };
    stockTxns.push(bulkTxn);

    // 5. Save everything
    writeCollection('products',          products);
    writeCollection('rollbalances',      [...rollBals, ...newRollBals]);
    writeCollection('warehouses',        warehouses);
    writeCollection('stocktransactions', stockTxns);

    console.log('\n══════════════════════════════════════');
    console.log(`✅ تم الاستيراد بنجاح!`);
    console.log(`   📦 أصناف جديدة أُنشئت : ${created}`);
    console.log(`   📜 رولات/بواقي مستوردة : ${rollCreated}`);
    console.log(`   ⏭  أسطر متجاهلة       : ${skipped}`);
    console.log('══════════════════════════════════════');
}

main();
