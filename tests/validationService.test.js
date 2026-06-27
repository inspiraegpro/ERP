jest.mock('../file_db_manager', () => {
  const mock = {
    find: jest.fn()
  };
  const Ctor = jest.fn(() => mock);
  Ctor.__mock = mock;
  return Ctor;
});

jest.mock('../models/JournalEntry', () => ({
  find: jest.fn()
}));

const FileDbManager = require('../file_db_manager');
const JournalEntry = require('../models/JournalEntry');
const validationService = require('../services/validationService');

describe('validationService', () => {
  const db = FileDbManager.__mock;

  beforeEach(() => {
    jest.clearAllMocks();
    JournalEntry.find.mockResolvedValue([]);
    db.find.mockResolvedValue([]);
  });

  test('checkDuplicateRollCodes detects duplicate roll codes', async () => {
    db.find.mockResolvedValueOnce([
      { _id: 'r1', rollCode: 'R1' },
      { _id: 'r2', rollCode: 'R1' },
      { _id: 'r3', rollCode: 'R2' }
    ]);

    const result = await validationService.checkDuplicateRollCodes();

    expect(result.duplicateCount).toBe(1);
    expect(result.duplicates[0].rollCode).toBe('R1');
  });

  test('checkJournalIntegrity treats existing invoice references as valid', async () => {
    JournalEntry.find.mockResolvedValueOnce([
      { _id: 'j1', referenceNumber: 'INV-1' },
      { _id: 'j2', referenceNumber: 'missing' }
    ]);
    db.find.mockImplementation(async (collection) => {
      if (collection === 'salesinvoices') return [{ _id: 'i1', invoiceNumber: 'INV-1' }];
      return [];
    });

    const result = await validationService.checkJournalIntegrity();

    expect(result.totalEntries).toBe(2);
    expect(result.orphanedCount).toBe(1);
    expect(result.orphaned[0]._id).toBe('j2');
  });

  test('checkMissingProductLinks reports broken inventory references', async () => {
    db.find.mockImplementation(async (collection) => {
      if (collection === 'products') return [{ _id: 'p1' }];
      if (collection === 'rollbalances') return [{ _id: 'r1', product: 'missing', rollCode: 'R1' }];
      if (collection === 'inventory_pieces') return [];
      return [];
    });

    const result = await validationService.checkMissingProductLinks();

    expect(result.brokenCount).toBe(1);
    expect(result.broken[0].collection).toBe('rollbalances');
  });

  test('runFullSystemCheck aggregates health checks', async () => {
    JournalEntry.find.mockResolvedValue([{ _id: 'j1', referenceNumber: 'missing' }]);
    db.find.mockImplementation(async (collection) => {
      if (collection === 'rollbalances') return [{ _id: 'r1', rollCode: 'R1', product: 'p1' }];
      if (collection === 'products') return [{ _id: 'p1' }];
      return [];
    });

    const result = await validationService.runFullSystemCheck();

    expect(result.healthy).toBe(false);
    expect(result.journals.orphanedCount).toBe(1);
    expect(result.rollCodes.duplicateCount).toBe(0);
    expect(result.productLinks.brokenCount).toBe(0);
  });
});
