function toNumber(value) {
    const n = Number(value);
    return Number.isFinite(n) ? n : 0;
}

function normalizeNumber(value) {
    const text = String(value ?? '').trim().replace(',', '.');
    const n = Number(text);
    return Number.isFinite(n) ? n : 0;
}

function buildArea(lengthCm, widthCm) {
    return Number(((toNumber(lengthCm) * toNumber(widthCm)) / 10000).toFixed(4));
}

function cleanText(value = '') {
    return String(value || '').replace(/^\uFEFF/, '').trim();
}

function repairArabicMojibake(value = '') {
    const text = cleanText(value);
    if (!text) return '';
    if (/[ÃØÙ]/.test(text)) {
        try {
            return Buffer.from(text, 'latin1').toString('utf8').trim();
        } catch (error) {
            return text;
        }
    }
    return text;
}

module.exports = {
    toNumber,
    normalizeNumber,
    buildArea,
    cleanText,
    repairArabicMojibake
};
