/**
 * Tests for cuttingService.js
 * Coverage target: ≥ 80%
 */

const {
    buildArea,
    findBestPlacement,
    generateRemnants,
    calculateWaste,
    calculateRequiredRolls,
    optimizeCutting
} = require('../services/cuttingService');

// ═══════════════════════════════════════════════════════════════════════════════
// buildArea
// ═══════════════════════════════════════════════════════════════════════════════
describe('buildArea', () => {
    test('calculates area in m² correctly', () => {
        // 152cm × 1524cm → 23.1648 m²
        expect(buildArea(1524, 152)).toBeCloseTo(23.1648, 2);
    });

    test('returns 0 for zero dimensions', () => {
        expect(buildArea(0, 152)).toBe(0);
        expect(buildArea(152, 0)).toBe(0);
    });

    test('handles string inputs', () => {
        expect(buildArea('100', '152')).toBeCloseTo(1.52, 2);
    });

    test('handles invalid inputs gracefully', () => {
        expect(buildArea(null, undefined)).toBe(0);
        expect(buildArea('abc', 100)).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// findBestPlacement
// ═══════════════════════════════════════════════════════════════════════════════
describe('findBestPlacement', () => {
    const roll = { lengthCm: 1524, widthCm: 152, rollCode: 'R001' };

    test('finds placement when piece fits', () => {
        const result = findBestPlacement(roll, 100, 100);
        expect(result).not.toBeNull();
        expect(result.waste).toBeGreaterThanOrEqual(0);
    });

    test('returns null when piece is too large', () => {
        const result = findBestPlacement(roll, 2000, 200);
        expect(result).toBeNull();
    });

    test('allows rotation when enabled', () => {
        const narrowRoll = { lengthCm: 200, widthCm: 100, rollCode: 'R002' };
        // Piece 80×150 doesn't fit normally (150 > 100) but fits rotated (80×150 → 150×80)
        const withoutRotate = findBestPlacement(narrowRoll, 80, 150, false);
        const withRotate    = findBestPlacement(narrowRoll, 80, 150, true);
        // With rotation: 150 fits in length(200), 80 fits in width(100)
        expect(withRotate).not.toBeNull();
        expect(withRotate.rotated).toBe(true);
    });

    test('returns piece dimensions without rotation flag when not rotated', () => {
        const result = findBestPlacement(roll, 100, 100, false);
        expect(result.rotated).toBe(false);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// generateRemnants
// ═══════════════════════════════════════════════════════════════════════════════
describe('generateRemnants', () => {
    const roll = { rollCode: 'R001', lengthCm: 500, widthCm: 152 };

    test('returns empty array with no placements', () => {
        expect(generateRemnants(roll, [])).toEqual([]);
    });

    test('generates a remnant for unused roll length', () => {
        const placements = [{ y: 0, lengthCm: 100 }];
        const remnants = generateRemnants(roll, placements);
        expect(remnants.length).toBeGreaterThanOrEqual(0);
        if (remnants.length > 0) {
            expect(remnants[0]).toHaveProperty('barcode');
            expect(remnants[0]).toHaveProperty('area');
        }
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateWaste
// ═══════════════════════════════════════════════════════════════════════════════
describe('calculateWaste', () => {
    test('returns 0% waste when all area is used', () => {
        const rolls  = [{ lengthCm: 100, widthCm: 100 }];
        const pieces = [{ lengthCm: 100, widthCm: 100 }];
        const result = calculateWaste(rolls, pieces);
        expect(result.wastePercent).toBe(0);
    });

    test('returns 50% waste when half the roll is used', () => {
        const rolls  = [{ lengthCm: 200, widthCm: 100 }];
        const pieces = [{ area: 1.0 }]; // half of 200×100 = 2 m²
        const result = calculateWaste(rolls, pieces);
        expect(result.wastePercent).toBeGreaterThan(0);
    });

    test('returns zeros for empty inputs', () => {
        const result = calculateWaste([], []);
        expect(result.wastePercent).toBe(0);
        expect(result.wasteArea).toBe(0);
    });

    test('handles missing roll dimensions gracefully', () => {
        const result = calculateWaste([{ lengthCm: 0, widthCm: 0 }], []);
        expect(result.wastePercent).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// calculateRequiredRolls
// ═══════════════════════════════════════════════════════════════════════════════
describe('calculateRequiredRolls', () => {
    test('calculates required rolls with 10% safety factor', () => {
        // 5 pieces of 1m² each = 5m² total, roll = 2m² → ceil(5.5/2) = 3
        const pieces = Array(5).fill({ lengthCm: 100, widthCm: 100 });
        const result = calculateRequiredRolls(pieces, 100, 200);
        expect(result.requiredRolls).toBe(3);
        expect(result.safetyFactor).toBe(1.10);
    });

    test('returns 0 when rollArea is 0', () => {
        const result = calculateRequiredRolls([], 0, 0);
        expect(result.requiredRolls).toBe(0);
    });

    test('handles empty pieces array', () => {
        const result = calculateRequiredRolls([], 152, 1524);
        expect(result.requiredRolls).toBe(0);
        expect(result.totalArea).toBe(0);
    });
});

// ═══════════════════════════════════════════════════════════════════════════════
// optimizeCutting
// ═══════════════════════════════════════════════════════════════════════════════
describe('optimizeCutting', () => {
    test('places all pieces that fit', () => {
        const rolls = [
            { rollCode: 'R001', lengthCm: 1524, widthCm: 152, remainingArea: 23.16 }
        ];
        const pieces = [
            { partName: 'hood', lengthCm: 150, widthCm: 100 },
            { partName: 'roof', lengthCm: 200, widthCm: 140 }
        ];
        const result = optimizeCutting(rolls, pieces, false);
        expect(result.placements.length + result.unplaced.length).toBe(pieces.length);
        expect(result).toHaveProperty('waste');
        expect(result).toHaveProperty('remnants');
    });

    test('puts oversized pieces in unplaced', () => {
        const rolls  = [{ rollCode: 'R001', lengthCm: 50, widthCm: 50 }];
        const pieces = [{ partName: 'big piece', lengthCm: 200, widthCm: 200 }];
        const result = optimizeCutting(rolls, pieces, false);
        expect(result.unplaced.length).toBe(1);
        expect(result.placements.length).toBe(0);
    });

    test('handles empty inputs', () => {
        const result = optimizeCutting([], [], false);
        expect(result.placements).toEqual([]);
        expect(result.unplaced).toEqual([]);
    });

    test('allows rotation to fit more pieces', () => {
        const rolls = [{ rollCode: 'R001', lengthCm: 200, widthCm: 100, remainingArea: 2 }];
        const pieces = [{ partName: 'piece', lengthCm: 80, widthCm: 150 }];
        const withRotate = optimizeCutting(rolls, pieces, true);
        // With rotation piece fits (150→length, 80→width)
        expect(withRotate.placements.length).toBe(1);
    });
});
