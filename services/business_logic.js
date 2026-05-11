function toNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) ? number : 0;
}

function calculateInclusiveVat(total) {
  return toNumber(total) * (14 / 114);
}

function resolvePriceByCategory(priceMatrix, category) {
  if (!priceMatrix || typeof priceMatrix !== "object") return 0;
  if (priceMatrix[category] != null) return toNumber(priceMatrix[category]);
  if (priceMatrix.Sedan != null) return toNumber(priceMatrix.Sedan);
  const firstKey = Object.keys(priceMatrix)[0];
  return firstKey ? toNumber(priceMatrix[firstKey]) : 0;
}

function getLinkedInventoryCodes(product) {
  if (!product || !Array.isArray(product.linkedInventoryCodes)) return [];
  const uniqueCodes = new Set();
  product.linkedInventoryCodes.forEach((code) => {
    const normalized = String(code || "").trim();
    if (normalized) uniqueCodes.add(normalized);
  });
  return Array.from(uniqueCodes);
}

function sanitizeSalesLabel(label) {
  const value = String(label || "");
  return value
    .replace(/\bsku\b/gi, "")
    .replace(/رول/g, "")
    .replace(/أمتار\s*طولي/g, "")
    .replace(/متر(?:\s*طولي)?/g, "")
    .replace(/\s{2,}/g, " ")
    .trim();
}

function buildSalesViewLabel(item) {
  if (!item || typeof item !== "object") return "";

  const isPiece = Boolean(item.isPiece) || /piece|قطعة/i.test(String(item.unit || ""));
  if (isPiece) {
    return sanitizeSalesLabel(item.name || item.displayName || "");
  }

  const parts = [item.category, item.grade, item.color]
    .map((part) => String(part || "").trim())
    .filter(Boolean);

  return sanitizeSalesLabel(parts.join(" - "));
}

module.exports = {
  calculateInclusiveVat,
  resolvePriceByCategory,
  getLinkedInventoryCodes,
  sanitizeSalesLabel,
  buildSalesViewLabel
};
