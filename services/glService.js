const JournalEntry = require('../models/JournalEntry');

/**
 * Create a General Ledger (Journal) Entry
 * @param {Object} data - The journal entry data
 * @param {string} data.date - Entry date (ISO string)
 * @param {string} data.description - Entry description
 * @param {string} data.referenceNumber - Reference number (e.g., invoice number)
 * @param {string} data.journalType - Type of journal (Sales, Purchase, Treasury, Stock, Manual)
 * @param {Array} data.details - Array of detail lines [{ accountId, accountName, debit, credit, description }]
 * @returns {Promise<Object>} The created journal entry
 */
async function createGlEntry(data) {
    const { date, description, referenceNumber, journalType, details } = data;

    if (!details || !Array.isArray(details) || details.length === 0) {
        throw new Error('Journal entry details are required');
    }

    // Validate balance
    const totalDebit = details.reduce((sum, line) => sum + (parseFloat(line.debit) || 0), 0);
    const totalCredit = details.reduce((sum, line) => sum + (parseFloat(line.credit) || 0), 0);

    if (Math.abs(totalDebit - totalCredit) > 0.01) {
        throw new Error(`Unbalanced journal entry: Debit ${totalDebit} != Credit ${totalCredit}`);
    }

    const entry = await JournalEntry.create({
        date: date || new Date().toISOString(),
        description: description || 'Manual Entry',
        referenceNumber: referenceNumber || `MAN-${Date.now()}`,
        journalType: journalType || 'Manual',
        details: details.map(d => ({
            accountId: d.accountId,
            accountName: d.accountName || d.account?.name || 'Unknown',
            debit: parseFloat(d.debit) || 0,
            credit: parseFloat(d.credit) || 0,
            description: d.description || ''
        })),
        totalDebit: totalDebit,
        totalCredit: totalCredit,
        status: 'posted',
        createdAt: new Date().toISOString()
    });

    return entry;
}

/**
 * Get GL entries by reference number
 * @param {string} referenceNumber - The reference to search for
 * @returns {Promise<Array>} Matching journal entries
 */
async function getEntriesByReference(referenceNumber) {
    return await JournalEntry.find({ referenceNumber });
}

/**
 * Delete GL entries by reference number (for reversing entries)
 * @param {string} referenceNumber - The reference to delete
 * @returns {Promise<Object>} Deletion result
 */
async function deleteEntriesByReference(referenceNumber) {
    const entries = await JournalEntry.find({ referenceNumber });
    for (const entry of entries) {
        await JournalEntry.deleteOne({ _id: entry._id });
    }
    return { deletedCount: entries.length };
}

/**
 * Get all GL entries
 * @param {Object} query - Optional query filters
 * @returns {Promise<Array>} All journal entries
 */
async function getAllEntries(query = {}) {
    return await JournalEntry.find(query);
}

module.exports = {
    createGlEntry,
    getEntriesByReference,
    deleteEntriesByReference,
    getAllEntries
};
