/**
 * Tests for validationService.js
 * Coverage target: ≥ 80%
 */

// We need to control what the db instance returns BEFORE the module is required.
// Use a shared mock object that validationService's internal db will use.
const mockDbFind = jest.fn().mockResolvedValue([]);
const mockDbDeleteOne = jest.fn().mockResolvedValue(true);

jest.mock('../file_db_manager', () => {
    return jest.fn().mockImplementation(() => ({
        find: mockDbFind,
        findOne: jest.fn().mockResolvedValue(null),
        deleteOne: mockDbDeleteOne
    }));
});

jest.mock('../models/JournalEntry', () => ({
    find: jest.fn().mockResolvedValue([]),
    deleteOne: jest.fn().mockResolvedValue(true)
}));

const JournalEntry = require('../models/JournalEntry');
const validationService = require('../services/validationService');

beforeEach(() => {
    jest.clearAllMocks();
    // Reset to empty defaults
    mockDbFind.mockResolvedValue([]);
    JournalEntry.find.mockResolvedValue([]);
    JournalEntry.deleteOne.mockResolvedValue(true);
});

// Helper: make mockDbFind return different data per collection call order
function mockCollections(map) {
    mockDbFind.mockImplementation((collection) => {
        return Promise.resolve(map[collection] || []);
    });
}

// ═══════════════════════════════════════════════════════════════════════════════
// checkJournalIntegrity
// ═══════════════════════════════════════════════════════════════════════════════
describe('checkJournalIntegrity', () => {
    test('returns 0 orphans when all entries have known refs', async () => {
        JournalEntry.find.mockResolvedValue([
            { _id: 'j1', referenceNumber: 'INV-00001' }
        ]);
        mockCollections({
            salesinvoices: [{ _id: 'inv1', invoiceNumber: 'INV-00001' }],
            purchaseinvoices: [],
            payrolls: []
        });

        const result = await validationService.checkJournalIntegrity();
        expect(result.orphanedCount).toBe(0);
        expect(result.totalEntries).toBe(1);
    });

    test('detects orphaned journal entries', async () => {
        JournalEntry.find.mockResolvedValue([
            { _id: 'j1', referenceNumber: 'GHOST-999' }
        ]);
        mockCollections({ salesinvoices: [], purchaseinvoices: [], payrolls: [] });

        const result = await validationService.checkJournalIntegrity();
        expect(result.orphanedCount).toBe(1);
        expect(result.orphaned[0].referenceNumber).toBe('GHOST-999');
    });

    test('returns correct structure', async () => {
        const result = await validationService.checkJournalIntegrity();
        expect(result).toHaveProperty('totalEntries');
        expect(result).toHaveProperty('orphanedCount');
        expect(result).toHaveProperty('orphaned');
        expect(Array.isArray(result.orphaned)).toBe(true);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// checkDuplicateRollCodes
// ═══════════════════════════════════════════════════════════════════════════════
describe('checkDuplicateRollCodes', () => {
    test('returns 0 duplicates for unique roll codes', async () => {
        mockCollections({
            rollbalances: [
                { _id: 'r1', rollCode: 'ROLL-001' },
                { _id: 'r2', rollCode: 'ROLL-002' }
            ]
        });

        const result = await validationService.checkDuplicateRollCodes();
        expect(result.duplicateCount).toBe(0);
        expect(result.totalRolls).toBe(2);
    });

    test('detects duplicate roll codes', async () => {
        mockCollections({
            rollbalances: [
                { _id: 'r1', rollCode: 'ROLL-001' },
                { _id: 'r2', rollCode: 'ROLL-001' },
                { _id: 'r3', rollCode: 'ROLL-002' }
            ]
        });

        const result = await validationService.checkDuplicateRollCodes();
        expect(result.duplicateCount).toBe(1);
        expect(result.duplicates[0].rollCode).toBe('ROLL-001');
    });

    test('ignores rolls with empty rollCode', async () => {
        mockCollections({
            rollbalances: [
                { _id: 'r1', rollCode: '' },
                { _id: 'r2', rollCode: '' }
            ]
        });

        const result = await validationService.checkDuplicateRollCodes();
        expect(result.duplicateCount).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// checkMissingProductLinks
// ═══════════════════════════════════════════════════════════════════════════════
describe('checkMissingProductLinks', () => {
    test('returns 0 broken links when all refs are valid', async () => {
        mockCollections({
            products: [{ _id: 'p1' }],
            rollbalances: [{ _id: 'r1', product: 'p1' }],
            inventory_pieces: []
        });

        const result = await validationService.checkMissingProductLinks();
        expect(result.brokenCount).toBe(0);
    });

    test('detects rolls with missing product reference', async () => {
        mockCollections({
            products: [{ _id: 'p1' }],
            rollbalances: [{ _id: 'r1', product: 'MISSING-PRODUCT', rollCode: 'RC-001' }],
            inventory_pieces: []
        });

        const result = await validationService.checkMissingProductLinks();
        expect(result.brokenCount).toBe(1);
        expect(result.broken[0].rollCode).toBe('RC-001');
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// runFullSystemCheck
// ═══════════════════════════════════════════════════════════════════════════════
describe('runFullSystemCheck', () => {
    test('returns healthy=true when all checks pass', async () => {
        mockCollections({ rollbalances: [], inventory_pieces: [], products: [] });
        const result = await validationService.runFullSystemCheck();
        expect(result.healthy).toBe(true);
        expect(result).toHaveProperty('timestamp');
        expect(result).toHaveProperty('journals');
        expect(result).toHaveProperty('rollCodes');
        expect(result).toHaveProperty('productLinks');
    });

    test('returns healthy=false when duplicate rolls found', async () => {
        mockCollections({
            rollbalances: [
                { _id: 'r1', rollCode: 'DUP' },
                { _id: 'r2', rollCode: 'DUP' }
            ],
            inventory_pieces: [],
            products: [],
            salesinvoices: [],
            purchaseinvoices: [],
            payrolls: []
        });

        const result = await validationService.runFullSystemCheck();
        expect(result.healthy).toBe(false);
        expect(result.rollCodes.duplicateCount).toBeGreaterThan(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// cleanupOrphanedJournals
// ═══════════════════════════════════════════════════════════════════════════════
describe('cleanupOrphanedJournals', () => {
    test('removes orphaned journal entries', async () => {
        let callCount = 0;
        JournalEntry.find.mockImplementation(() => {
            callCount++;
            return Promise.resolve(
                callCount === 1 ? [{ _id: 'j1', referenceNumber: 'GHOST' }] : []
            );
        });
        mockCollections({ salesinvoices: [], purchaseinvoices: [], payrolls: [] });

        const result = await validationService.cleanupOrphanedJournals();
        expect(result.removed).toBe(1);
        expect(JournalEntry.deleteOne).toHaveBeenCalledTimes(1);
    });

    test('does nothing when no orphans exist', async () => {
        JournalEntry.find.mockResolvedValue([]);
        mockCollections({});

        const result = await validationService.cleanupOrphanedJournals();
        expect(result.removed).toBe(0);
        expect(JournalEntry.deleteOne).not.toHaveBeenCalled();
    });
});
