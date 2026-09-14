import { describe, expect, it } from "vitest";
import { TCGdexCatalogProvider } from "@/lib/catalog/tcgdex";

const live = process.env.RUN_INTEGRATION === "1" ? describe : describe.skip;

live("TCGdex réel", () => {
  it("identifie les cinq cartes de validation par nom, numéro et extension", async () => {
    const provider = new TCGdexCatalogProvider();
    const cases = [
      ["Soporifik 210/198", "sv01-210"],
      ["Simiabraz 173/167", "sv06-173"],
      ["Caninos de Hisui 181/167", "sv06-181"],
      ["Pikachu ex 219/191", "sv08-219"],
      ["Oyacata 207/198", "sv01-207"],
    ] as const;
    for (const [query, expectedId] of cases) {
      const cards = await provider.search(query);
      expect(cards.map((card) => card.id), query).toContain(expectedId);
    }
  }, 120_000);
});
