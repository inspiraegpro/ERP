const cuttingService = require('../services/cuttingService');

describe('cuttingService', () => {
  test('generateRemnantBarcode uses -P suffix format', () => {
    expect(cuttingService.generateRemnantBarcode('ROLL-1', 100, 50, 1)).toBe('ROLL-1-P1');
    expect(cuttingService.generateRemnantBarcode('ROLL-1', 100, 50, 2)).toBe('ROLL-1-P2');
  });

  test('calculateWaste supports usedArea and totalArea signature', () => {
    expect(cuttingService.calculateWaste(6, 10)).toEqual({
      wastePercent: 40,
      wasteArea: 4,
      totalArea: 10,
      usedArea: 6
    });
  });

  test('calculateWaste supports legacy rolls and pieces signature', () => {
    const result = cuttingService.calculateWaste(
      [{ lengthCm: 200, widthCm: 100 }],
      [{ lengthCm: 50, widthCm: 100 }]
    );

    expect(result.totalRollArea).toBe(2);
    expect(result.usedArea).toBe(0.5);
    expect(result.wastePercent).toBe(75);
  });

  test('optimizeCutting places larger pieces first and reports remnants', () => {
    const result = cuttingService.optimizeCutting(
      [{ rollCode: 'R1', lengthCm: 300, widthCm: 100, remainingArea: 3 }],
      [
        { id: 'small', lengthCm: 50, widthCm: 100 },
        { id: 'large', lengthCm: 150, widthCm: 100 }
      ],
      false
    );

    expect(result.unplaced).toHaveLength(0);
    expect(result.placements.map((p) => p.piece.id)).toEqual(['large', 'small']);
    expect(result.remnants[0].barcode).toBe('R1-P1');
    expect(result.waste.wastePercent).toBeCloseTo(33.33);
  });

  test('optimizeCutting can rotate and reports unplaced pieces', () => {
    const rotated = cuttingService.optimizeCutting(
      [{ rollCode: 'R2', lengthCm: 100, widthCm: 50 }],
      [{ id: 'rot', lengthCm: 50, widthCm: 100 }],
      true
    );
    expect(rotated.placements[0].rotated).toBe(true);

    const unplaced = cuttingService.optimizeCutting(
      [{ rollCode: 'R3', lengthCm: 20, widthCm: 20 }],
      [{ id: 'too-big', lengthCm: 100, widthCm: 100 }],
      false
    );
    expect(unplaced.unplaced).toHaveLength(1);
  });
});
