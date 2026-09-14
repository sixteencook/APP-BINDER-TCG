import { describe, expect, it } from "vitest";
import { mapTcggoPrice, toTcggoId } from "@/lib/pricing/tcggo";

describe("mapping TCGGO", () => {
  it("normalise l'identifiant TCGdex pour la recherche TCGGO", () => {
    expect(toTcggoId("sv01-210")).toBe("sv1-210");
    expect(toTcggoId("sv08-219")).toBe("sv8-219");
  });
  it("mappe uniquement les métriques Cardmarket garanties", () => {
    const mapped = mapTcggoPrice({ id: 21007, prices: { cardmarket: {
      currency: "EUR", lowest_near_mint_FR: 27, "7d_average": 29.5, "30d_average": 28.8,
    } } }, "2026-09-13T10:00:00.000Z");
    expect(mapped).toMatchObject({ lowest: 27, trend: null, avg7: 29.5, avg30: 28.8, language: "FR", condition: "NM" });
  });
  it("convertit les métriques absentes en null, jamais en zéro", () => {
    expect(mapTcggoPrice({ prices: { cardmarket: {} } })).toMatchObject({ lowest: null, trend: null, avg7: null, avg30: null });
  });
});
