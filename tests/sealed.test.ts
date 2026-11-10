import { describe, expect, it } from "vitest";
import { guessSealedType } from "@/lib/domain/sealed";
import { mapTcggoProduct } from "@/lib/pricing/tcggo-products";
import { sanitizeState } from "@/lib/storage/binder-storage";

describe("produits scellés TCGGO", () => {
  it("mappe un produit (image, extension, prix le plus bas prioritaire)", () => {
    const hit = mapTcggoProduct({
      id: 51261,
      name: "Delta Reign Sleeved Booster",
      image: "https://images.tcggo.com/x.png",
      episode: { name: "Delta Reign" },
      prices: { cardmarket: { lowest: 6.99, "7d_average": 7.48, "30d_average": 7.58 } },
    });
    expect(hit).toMatchObject({
      productId: 51261,
      name: "Delta Reign Sleeved Booster",
      image: "https://images.tcggo.com/x.png",
      setName: "Delta Reign",
      price: 6.99,
      lowest: 6.99,
      avg30: 7.58,
    });
  });

  it("retombe sur 30 j puis le plus bas, et rejette les produits invalides", () => {
    expect(mapTcggoProduct({ id: 2, name: "ETB", prices: { cardmarket: { lowest: null, "30d_average": 45 } } })?.price).toBe(45);
    expect(mapTcggoProduct({ id: 3, name: "ETB", prices: { cardmarket: { lowest: null, "7d_average": 41, "30d_average": 45 } } })?.price).toBe(41);
    // moyenne 7 j aberrante (peu de ventes) : le plus bas en vente l'emporte
    expect(mapTcggoProduct({ id: 5, name: "ETB PC", prices: { cardmarket: { lowest: 130, "7d_average": 399 } } })?.price).toBe(130);
    expect(mapTcggoProduct({ name: "sans id" })).toBeNull();
    expect(mapTcggoProduct({ id: 4, name: "http image", image: "http://insecure.png" })?.image).toBeNull();
  });

  it("devine le type depuis le nom du produit", () => {
    expect(guessSealedType("Prismatic Evolutions Booster Box")).toBe("display");
    expect(guessSealedType("Prismatic Evolutions Elite Trainer Box")).toBe("etb");
    expect(guessSealedType("151 Ultra-Premium Collection")).toBe("upc");
    expect(guessSealedType("Scarlet & Violet Booster Bundle")).toBe("bundle");
    expect(guessSealedType("Delta Reign Sleeved Booster")).toBe("booster");
    expect(guessSealedType("Charizard ex Premium Collection")).toBe("coffret");
    expect(guessSealedType("Mystère total")).toBe("autre");
  });

  it("migre l'ancien type « etb-pc » vers « etb » et garde productId", () => {
    const state = sanitizeState({
      version: 2,
      sealed: [
        { id: "a", name: "ETB Pokémon Center", type: "etb-pc", quantity: 1 },
        { id: "b", name: "Display", type: "display", quantity: 2, productId: 51261 },
        { id: "c", name: "Bizarre", type: "inconnu", quantity: 1, productId: -4 },
      ],
    });
    expect(state?.sealed.map((item) => [item.id, item.type, item.productId])).toEqual([
      ["a", "etb", null],
      ["b", "display", 51261],
      ["c", "autre", null],
    ]);
  });
});
