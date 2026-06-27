const FileDatabaseManager = require('../file_db_manager');
const JournalEntry = require('../models/JournalEntry');

const db = new FileDatabaseManager();

async function checkJournalIntegrity() {
    const entries = await JournalEntry.find({});
    const invoices = await db.find('salesinvoices');
    const purchases = await db.find('purchaseinvoices');
    const payrolls = await db.find('payrolls');

    const knownRefs = new Set();
    invoices.forEach((i) => {
        if (i._id) knownRefs.add(String(i._id));
        if (i.invoiceNumber) knownRefs.add(String(i.invoiceNumber));
    });
    purchases.forEach((p) => {
        if (p._id) knownRefs.add(String(p._id));
        if (p.invoiceNumber) knownRefs.add(String(p.invoiceNumber));
    });
    payrolls.forEach((p) => {
        if (p._id) knownRefs.add(String(p._id));
        if (p.month) knownRefs.add(String(p.month));
    });

    const orphaned = (entries || []).filter((entry) => {
        const ref = String(entry.referenceNumber || entry.transactionId || '');
        if (!ref) return true;
        return !knownRefs.has(ref) && !entries.some((e) => e.transactionId === ref);
    });

    return {
        totalEntries: entries.length,
        orphanedCount: orphaned.length,
        orphaned: orphaned.slice(0, 50)
    };
}

async function checkDuplicateRollCodes() {
    const rolls = await db.find('rollbalances');
    const seen = new Map();
    const duplicates = [];

    rolls.forEach((roll) => {
        const code = String(roll.rollCode || '').trim();
        if (!code) return;
        if (seen.has(code)) {
            duplicates.push({ rollCode: code, ids: [seen.get(code), roll._id] });
        } else {
            seen.set(code, roll._id);
        }
    });

    return { totalRolls: rolls.length, duplicateCount: duplicates.length, duplicates };
}

async function checkMissingProductLinks() {
    const products = await db.find('products');
    const productIds = new Set(products.map((p) => String(p._id)));
    const rolls = await db.find('rollbalances');
    const pieces = await db.find('inventory_pieces');
    const broken = [];

    const checkRow = (row, collection) => {
        const pid = String(row.product || row.productCode || '');
        if (pid && !productIds.has(pid)) {
            broken.push({
                collection,
                id: row._id,
                product: pid,
                rollCode: row.rollCode || row.pieceCode || ''
            });
        }
    };

    rolls.forEach((r) => checkRow(r, 'rollbalances'));
    pieces.forEach((p) => checkRow(p, 'inventory_pieces'));

    return { brokenCount: broken.length, broken: broken.slice(0, 100) };
}

async function runFullSystemCheck() {
    const [journals, rollCodes, productLinks] = await Promise.all([
        checkJournalIntegrity(),
        checkDuplicateRollCodes(),
        checkMissingProductLinks()
    ]);

    const healthy = journals.orphanedCount === 0 &&
        rollCodes.duplicateCount === 0 &&
        productLinks.brokenCount === 0;

    return {
        healthy,
        timestamp: new Date().toISOString(),
        journals,
        rollCodes,
        productLinks
    };
}

async function cleanupOrphanedJournals() {
    const { orphaned } = await checkJournalIntegrity();
    let removed = 0;
    for (const entry of orphaned) {
        if (entry._id) {
            await JournalEntry.deleteOne({ _id: entry._id });
            removed += 1;
        }
    }
    return { removed, remaining: (await checkJournalIntegrity()).orphanedCount };
}

module.exports = {
    checkJournalIntegrity,
    checkDuplicateRollCodes,
    checkMissingProductLinks,
    runFullSystemCheck,
    cleanupOrphanedJournals
};
