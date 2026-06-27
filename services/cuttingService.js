const { toNumber, buildArea } = require('./helpers');

function findBestPlacement(roll, pieceLength, pieceWidth, allowRotate = false) {
    const rollLength = toNumber(roll.remainingLengthCm || roll.lengthCm || roll.originalLengthCm);
    const rollWidth = toNumber(roll.widthCm || roll.width);
    const orientations = [{ l: pieceLength, w: pieceWidth }];
    if (allowRotate) orientations.push({ l: pieceWidth, w: pieceLength });

    let best = null;
    for (const { l, w } of orientations) {
        if (l <= rollLength + 0.01 && w <= rollWidth + 0.01) {
            const waste = buildArea(rollLength, rollWidth) - buildArea(l, w);
            if (!best || waste < best.waste) {
                best = { lengthCm: l, widthCm: w, waste, rotated: l !== pieceLength };
            }
        }
    }
    return best;
}

function generateRemnantBarcode(rollCode, lengthCm, widthCm, pieceNumber = 1) {
    const suffix = Math.max(1, Math.floor(toNumber(pieceNumber) || 1));
    return `${rollCode}-P${suffix}`;
}

function generateRemnants(roll, usedPlacements = []) {
    const rollLength = toNumber(roll.lengthCm || roll.remainingLengthCm || roll.originalLengthCm);
    const rollWidth = toNumber(roll.widthCm || roll.width);
    const rollCode = roll.rollCode || roll.barcode || 'ROLL';
    const remnants = [];

    if (!usedPlacements.length) {
        return remnants;
    }

    const usedLength = Math.max(...usedPlacements.map((p) => toNumber(p.y) + toNumber(p.lengthCm)));
    const remainingLength = Math.max(0, rollLength - usedLength);
    if (remainingLength > 0.5 && rollWidth > 0) {
        remnants.push({
            lengthCm: remainingLength,
            widthCm: rollWidth,
            area: buildArea(remainingLength, rollWidth),
            barcode: generateRemnantBarcode(rollCode, remainingLength, rollWidth, 1)
        });
    }

    return remnants;
}

function calculateWaste(usedAreaOrRolls, totalAreaOrPieces) {
    if (typeof usedAreaOrRolls === 'number' || typeof totalAreaOrPieces === 'number') {
        const usedArea = toNumber(usedAreaOrRolls);
        const totalArea = toNumber(totalAreaOrPieces);
        if (totalArea <= 0) return { wastePercent: 0, wasteArea: 0, totalArea, usedArea };
        const wasteArea = Math.max(0, totalArea - usedArea);
        return {
            wastePercent: Number(((wasteArea / totalArea) * 100).toFixed(2)),
            wasteArea: Number(wasteArea.toFixed(4)),
            totalArea: Number(totalArea.toFixed(4)),
            usedArea: Number(usedArea.toFixed(4))
        };
    }

    const rolls = usedAreaOrRolls;
    const pieces = totalAreaOrPieces;
    let totalRollArea = 0;
    let usedArea = 0;

    (rolls || []).forEach((roll) => {
        totalRollArea += buildArea(
            roll.lengthCm || roll.remainingLengthCm || roll.originalLengthCm,
            roll.widthCm || roll.width
        );
    });

    (pieces || []).forEach((piece) => {
        usedArea += toNumber(piece.area) || buildArea(piece.lengthCm, piece.widthCm);
    });

    if (totalRollArea <= 0) return { wastePercent: 0, wasteArea: 0, totalRollArea, usedArea };
    const wasteArea = Math.max(0, totalRollArea - usedArea);
    return {
        wastePercent: Number(((wasteArea / totalRollArea) * 100).toFixed(2)),
        wasteArea: Number(wasteArea.toFixed(4)),
        totalRollArea: Number(totalRollArea.toFixed(4)),
        usedArea: Number(usedArea.toFixed(4))
    };
}

function calculateRequiredRolls(pieces, rollWidthCm, rollLengthCm) {
    const totalArea = (pieces || []).reduce((sum, p) => {
        return sum + (toNumber(p.area) || buildArea(p.lengthCm, p.widthCm));
    }, 0);
    const rollArea = buildArea(rollLengthCm, rollWidthCm);
    if (rollArea <= 0) return { requiredRolls: 0, totalArea, rollArea };
    const withSafety = totalArea * 1.10;
    return {
        requiredRolls: Math.ceil(withSafety / rollArea),
        totalArea: Number(totalArea.toFixed(4)),
        rollArea: Number(rollArea.toFixed(4)),
        safetyFactor: 1.10
    };
}

function optimizeCutting(rolls, pieces, allowRotate = false) {
    const placements = [];
    const remainingRolls = (rolls || []).map((r) => ({
        ...r,
        remainingLengthCm: toNumber(r.remainingLengthCm || r.lengthCm || r.originalLengthCm),
        usedLengthCm: 0
    }));
    const sortedPieces = [...(pieces || [])].sort((a, b) => {
        const areaA = toNumber(a.area) || buildArea(a.lengthCm, a.widthCm);
        const areaB = toNumber(b.area) || buildArea(b.lengthCm, b.widthCm);
        return areaB - areaA;
    });
    const unplaced = [];

    for (const piece of sortedPieces) {
        const pieceLength = toNumber(piece.lengthCm);
        const pieceWidth = toNumber(piece.widthCm);
        let placed = false;

        for (const roll of remainingRolls) {
            const placement = findBestPlacement(roll, pieceLength, pieceWidth, allowRotate);
            if (placement) {
                placements.push({
                    rollCode: roll.rollCode,
                    piece,
                    x: 0,
                    y: roll.usedLengthCm,
                    ...placement
                });
                const consumedArea = buildArea(placement.lengthCm, placement.widthCm);
                roll.remainingArea = Math.max(0, toNumber(roll.remainingArea || roll.currentArea) - consumedArea);
                roll.usedLengthCm += placement.lengthCm;
                roll.remainingLengthCm = Math.max(0, roll.remainingLengthCm - placement.lengthCm);
                placed = true;
                break;
            }
        }

        if (!placed) unplaced.push(piece);
    }

    const remnants = [];
    remainingRolls.forEach((roll) => {
        const rollPlacements = placements.filter((p) => p.rollCode === roll.rollCode);
        generateRemnants(roll, rollPlacements).forEach((r) => remnants.push(r));
    });

    const totalArea = (rolls || []).reduce((sum, roll) => {
        return sum + buildArea(
            roll.lengthCm || roll.remainingLengthCm || roll.originalLengthCm,
            roll.widthCm || roll.width
        );
    }, 0);
    const usedArea = placements.reduce((sum, placement) => {
        return sum + buildArea(placement.lengthCm, placement.widthCm);
    }, 0);
    const waste = calculateWaste(usedArea, totalArea);

    return { placements, unplaced, remnants, waste };
}

module.exports = {
    buildArea,
    findBestPlacement,
    generateRemnants,
    generateRemnantBarcode,
    calculateWaste,
    calculateRequiredRolls,
    optimizeCutting
};
