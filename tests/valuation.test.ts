import { describe, expect, it } from "vitest";
import type { BinderItem, CardPriceData } from "@/lib/domain/types";
import { calculateBinderTotal, calculateReferencePrice } from "@/lib/domain/valuation";

const price = (values: Partial<CardPriceData>): CardPriceData => ({
  currency: "EUR", language: "FR", condition: "NM", lowest: null, trend: null,
  avg7: null, avg30: null, updatedAt: "2026-09-13T00:00:00.000Z",
  source: "TCGGO / Cardmarket", providerProductId: "42", ...values,
});

const item = (referencePrice: number | null, quantity = 1): BinderItem => ({
  id: `sv01-${quantity}`, game: "pokemon", name: "Test", localId: "1", printedTotal: 198,
  extensionId: "sv01", extension: "Écarlate et Violet", series: "Écarlate et Violet",
  image: null, rarity: null, language: "FR", condition: "NM", quantity,
  prices: null, referencePrice, lastPriceUpdate: null,
});

describe("calculateReferencePrice", () => {
  it("privilégie trend puis les moyennes récentes puis Lowest FR NM", () => {
    expect(calculateReferencePrice(price({ trend: 45, avg7: 44, avg30: 43, lowest: 40 }))).toBe(45);
    expect(calculateReferencePrice(price({ avg7: 44, avg30: 43, lowest: 40 }))).toBe(44);
    expect(calculateReferencePrice(price({ avg30: 43, lowest: 40 }))).toBe(43);
    expect(calculateReferencePrice(price({ lowest: 40 }))).toBe(40);
  });
  it("renvoie null quand toutes les métriques sont absentes", () => {
    expect(calculateReferencePrice(price({}))).toBeNull();
    expect(calculateReferencePrice(null)).toBeNull();
  });
});

describe("calculateBinderTotal", () => {
  it("multiplie le prix par une quantité supérieure à 1", () => {
    expect(calculateBinderTotal([item(12.5, 3)])).toEqual({ total: 37.5, unknownCount: 0 });
  });
  it("ignore les prix null et les compte séparément", () => {
    expect(calculateBinderTotal([item(10), item(null, 2)])).toEqual({ total: 10, unknownCount: 2 });
  });
});
