const {
  calculateInclusiveVat,
  resolvePriceByCategory,
  getLinkedInventoryCodes,
  buildSalesViewLabel
} = require("../services/business_logic");

describe("Business logic hardening", () => {
  describe("VAT formula Total * 14/114", () => {
    test.each([
      [114, 14],
      [228, 28],
      [570, 70],
      [1140, 140],
      [1710, 210]
    ])("calculates VAT correctly for total=%s", (total, expectedVat) => {
      expect(calculateInclusiveVat(total)).toBeCloseTo(expectedVat, 8);
    });
  });

  describe("Category pricing matrix", () => {
    const frontWindshieldMatrix = {
      Sedan: 4000,
      "SUV/Large Sedan": 5000,
      "Large SUV": 5000
    };

    test("returns category-specific price", () => {
      expect(resolvePriceByCategory(frontWindshieldMatrix, "Sedan")).toBe(4000);
      expect(resolvePriceByCategory(frontWindshieldMatrix, "SUV/Large Sedan")).toBe(5000);
      expect(resolvePriceByCategory(frontWindshieldMatrix, "Large SUV")).toBe(5000);
    });

    test("Sedan is different from SUV when matrix defines difference", () => {
      const sedanPrice = resolvePriceByCategory(frontWindshieldMatrix, "Sedan");
      const suvPrice = resolvePriceByCategory(frontWindshieldMatrix, "SUV/Large Sedan");
      expect(sedanPrice).not.toBe(suvPrice);
    });
  });

  describe("Linked inventory mapping", () => {
    test("returns normalized linkedInventoryCodes", () => {
      const product = {
        _id: "p-100",
        linkedInventoryCodes: [" p2 ", "p3", "p2", "", null, "P4"]
      };

      expect(getLinkedInventoryCodes(product)).toEqual(["p2", "p3", "P4"]);
    });

    test("returns empty array when missing", () => {
      expect(getLinkedInventoryCodes({ _id: "no-links" })).toEqual([]);
      expect(getLinkedInventoryCodes(null)).toEqual([]);
    });
  });

  describe("Sales view sanitization", () => {
    test("returns only category/grade/color for roll-based products", () => {
      const label = buildSalesViewLabel({
        name: "PPF رول 20 متر طولي - SKU-44",
        category: "PPF",
        grade: "Grade 5",
        color: "Black",
        unit: "ROLL"
      });

      expect(label).toBe("PPF - Grade 5 - Black");
      expect(label).not.toMatch(/رول|متر|sku/i);
    });

    test("keeps piece item names without technical terms", () => {
      const label = buildSalesViewLabel({
        name: "طقم مفكات",
        isPiece: true,
        unit: "قطعة"
      });

      expect(label).toBe("طقم مفكات");
      expect(label).not.toMatch(/رول|متر|sku/i);
    });
  });
});
