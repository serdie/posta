import { describe, expect, it } from "vitest";
import { ALL_ITEM_IDS, KIT, needsFor, sanitizeChecked } from "./data";

describe("needsFor", () => {
  it("3 litros por persona y día durante 3 días", () => {
    expect(needsFor(1)).toEqual({ waterLitres: 9, meals: 9 });
    expect(needsFor(4)).toEqual({ waterLitres: 36, meals: 36 });
  });

  it("suma un litro diario por mascota", () => {
    expect(needsFor(2, 1).waterLitres).toBe(21);
  });

  it("acota valores absurdos", () => {
    expect(needsFor(0).waterLitres).toBe(9);
    expect(needsFor(-5).waterLitres).toBe(9);
    expect(needsFor(Number.NaN).waterLitres).toBe(9);
    expect(needsFor(1000).waterLitres).toBe(20 * 9);
  });
});

describe("KIT", () => {
  it("los ids son únicos", () => {
    expect(new Set(ALL_ITEM_IDS).size).toBe(ALL_ITEM_IDS.length);
    expect(new Set(KIT.map((g) => g.id)).size).toBe(KIT.length);
  });
});

describe("sanitizeChecked", () => {
  it("solo conserva ids conocidos y sin duplicados", () => {
    expect(sanitizeChecked(["agua", "agua", "inventado", 3, null])).toEqual(["agua"]);
    expect(sanitizeChecked("agua")).toEqual([]);
  });
});
