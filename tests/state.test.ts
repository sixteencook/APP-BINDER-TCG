import { describe, expect, it } from "vitest";
import {
  emptyState,
  firstFreePosition,
  getActiveBinder,
  pageCount,
  placedValue,
  reduce,
  unplacedCount,
} from "@/lib/domain/state";
import type { AppState, Card, CardPriceData } from "@/lib/domain/types";
import { calculateSealedTotals, calculateWishlistTotal, isTargetReached } from "@/lib/domain/valuation";
import { migrateLegacy, parseBackup, sanitizeState, serializeBackup } from "@/lib/storage/binder-storage";

const card = (n: number, extensionId = "sv01"): Card => ({
  id: `${extensionId}-${String(n).padStart(3, "0")}`,
  game: "pokemon",
  name: `Carte ${n}`,
  localId: String(n).padStart(3, "0"),
  printedTotal: 198,
  extensionId,
  extension: "Écarlate et Violet",
  series: "Écarlate et Violet",
  image: `https://assets.tcgdex.net/fr/sv/${extensionId}/${n}/high.webp`,
  rarity: null,
});

const price = (trend: number): CardPriceData => ({
  currency: "EUR", language: "FR", condition: "NM", lowest: trend - 1, trend, avg7: null, avg30: null,
  updatedAt: "2026-11-10T08:00:00.000Z", source: "TCGGO / Cardmarket", providerProductId: "1", fallbackImage: null,
});

const run = (state: AppState, ...actions: Parameters<typeof reduce>[1][]) => actions.reduce(reduce, state);

describe("collection et placements", () => {
  it("ajoute une carte, incrémente la quantité et calcule le prix de référence", () => {
    const state = run(emptyState(), { type: "collection/add", card: card(1), price: price(10) }, { type: "collection/add", card: card(1), price: null });
    expect(state.collection).toHaveLength(1);
    expect(state.collection[0].quantity).toBe(2);
    expect(state.collection[0].referencePrice).toBe(10);
  });

  it("« ajouter au binder » place la carte sur le premier emplacement libre", () => {
    const state = run(
      emptyState(),
      { type: "collection/add", card: card(1), price: null, place: true },
      { type: "collection/add", card: card(2), price: null, place: true },
    );
    expect(state.placements.map((p) => p.position)).toEqual([0, 1]);
    expect(firstFreePosition(state, state.activeBinderId)).toBe(2);
  });

  it("ne place jamais plus d'exemplaires que la quantité possédée", () => {
    let state = run(emptyState(), { type: "collection/add", card: card(1), price: null });
    state = run(state, { type: "binder/place", position: 0, cardId: "sv01-001" }, { type: "binder/place", position: 1, cardId: "sv01-001" });
    expect(state.placements).toHaveLength(1);
    state = run(state, { type: "collection/add", card: card(1), price: null }, { type: "binder/place", position: 1, cardId: "sv01-001" });
    expect(state.placements).toHaveLength(2);
    expect(unplacedCount(state, state.collection[0])).toBe(0);
  });

  it("retirer d'un emplacement renvoie la carte dans la barre latérale", () => {
    let state = run(emptyState(), { type: "collection/add", card: card(1), price: null, place: true });
    expect(unplacedCount(state, state.collection[0])).toBe(0);
    state = run(state, { type: "binder/unplace", position: 0 });
    expect(unplacedCount(state, state.collection[0])).toBe(1);
  });

  it("placer sur un emplacement occupé remplace l'occupant", () => {
    const state = run(
      emptyState(),
      { type: "collection/add", card: card(1), price: null, place: true },
      { type: "collection/add", card: card(2), price: null },
      { type: "binder/place", position: 0, cardId: "sv01-002" },
    );
    expect(state.placements).toEqual([expect.objectContaining({ position: 0, cardId: "sv01-002" })]);
  });

  it("déplace une carte vers un emplacement vide et échange deux cartes", () => {
    let state = run(
      emptyState(),
      { type: "collection/add", card: card(1), price: null, place: true },
      { type: "collection/add", card: card(2), price: null, place: true },
      { type: "binder/move", from: 0, to: 5 },
    );
    expect(state.placements.find((p) => p.cardId === "sv01-001")?.position).toBe(5);
    state = run(state, { type: "binder/move", from: 1, to: 5 });
    expect(state.placements.find((p) => p.cardId === "sv01-001")?.position).toBe(1);
    expect(state.placements.find((p) => p.cardId === "sv01-002")?.position).toBe(5);
  });

  it("réduire la quantité retire les emplacements en trop, en commençant par la fin", () => {
    let state = run(
      emptyState(),
      { type: "collection/add", card: card(1), price: null },
      { type: "collection/add", card: card(1), price: null },
      { type: "collection/add", card: card(1), price: null },
      { type: "binder/autofill" },
    );
    expect(state.placements).toHaveLength(3);
    state = run(state, { type: "collection/quantity", id: "sv01-001", quantity: 1 });
    expect(state.placements.map((p) => p.position)).toEqual([0]);
  });

  it("supprimer une carte de la collection libère ses emplacements", () => {
    const state = run(emptyState(), { type: "collection/add", card: card(1), price: null, place: true }, { type: "collection/remove", id: "sv01-001" });
    expect(state.collection).toHaveLength(0);
    expect(state.placements).toHaveLength(0);
  });

  it("le remplissage automatique suit l'ordre extension puis numéro et comble les trous", () => {
    const state = run(
      emptyState(),
      { type: "collection/add", card: card(10, "sv02"), price: null },
      { type: "collection/add", card: card(3), price: null },
      { type: "collection/add", card: card(2), price: null },
      { type: "collection/add", card: card(1), price: null, place: true },
      { type: "binder/move", from: 0, to: 1 },
      { type: "binder/autofill" },
    );
    const byPosition = [...state.placements].sort((a, b) => a.position - b.position).map((p) => p.cardId);
    expect(byPosition).toEqual(["sv01-002", "sv01-001", "sv01-003", "sv02-010"]);
  });

  it("une carte achetée sort de la liste des recherchées", () => {
    const state = run(emptyState(), { type: "wish/add", card: card(1), price: price(5) }, { type: "wish/acquire", id: "sv01-001" });
    expect(state.wishlist).toHaveLength(0);
    expect(state.collection[0]).not.toHaveProperty("targetPrice");
    expect(state.collection[0].referencePrice).toBe(5);
  });
});

describe("binders et pages", () => {
  it("compte les pages selon la grille et les emplacements utilisés", () => {
    let state = emptyState();
    const binder = getActiveBinder(state);
    expect(pageCount(state, binder)).toBe(1);
    state = run(state, { type: "collection/add", card: card(1), price: null }, { type: "binder/place", position: 16, cardId: "sv01-001" });
    expect(pageCount(state, getActiveBinder(state))).toBe(2);
    state = run(state, { type: "binder/layout", cols: 3, rows: 3 });
    expect(pageCount(state, getActiveBinder(state))).toBe(2); // position 16 → page 2 d'une grille de 9
    state = run(state, { type: "binder/layout", cols: 4, rows: 3 });
    expect(pageCount(state, getActiveBinder(state))).toBe(2);
  });

  it("ajoute une page vide et ne supprime que la dernière page si elle est vide", () => {
    let state = run(emptyState(), { type: "collection/add", card: card(1), price: null, place: true }, { type: "binder/add-page" }, { type: "binder/add-page" });
    expect(pageCount(state, getActiveBinder(state))).toBe(3);
    state = run(state, { type: "binder/remove-page" });
    expect(pageCount(state, getActiveBinder(state))).toBe(2);
    state = run(state, { type: "binder/remove-page" }, { type: "binder/remove-page" });
    expect(pageCount(state, getActiveBinder(state))).toBe(1); // la page 1 contient une carte et reste
  });

  it("garde toujours au moins un binder et libère les placements à la suppression", () => {
    let state = run(emptyState(), { type: "collection/add", card: card(1), price: null, place: true });
    expect(run(state, { type: "binder/delete" }).binders).toHaveLength(1);
    const first = state.activeBinderId;
    state = run(state, { type: "binder/create", name: "Dracaufeu" });
    expect(state.binders).toHaveLength(2);
    expect(state.activeBinderId).not.toBe(first);
    state = run(state, { type: "binder/delete" });
    expect(state.activeBinderId).toBe(first);
    expect(state.placements).toHaveLength(1);
  });

  it("calcule la valeur d'une page", () => {
    const state = run(
      emptyState(),
      { type: "collection/add", card: card(1), price: price(10), place: true },
      { type: "collection/add", card: card(2), price: price(5) },
      { type: "binder/place", position: 16, cardId: "sv01-002" },
    );
    const binder = getActiveBinder(state);
    expect(placedValue(state, binder, 0)).toBe(10);
    expect(placedValue(state, binder, 1)).toBe(5);
    expect(placedValue(state, binder)).toBe(15);
  });
});

describe("recherchées et scellés", () => {
  it("détecte l'objectif de prix atteint", () => {
    expect(isTargetReached({ referencePrice: 8, targetPrice: 10 })).toBe(true);
    expect(isTargetReached({ referencePrice: 12, targetPrice: 10 })).toBe(false);
    expect(isTargetReached({ referencePrice: null, targetPrice: 10 })).toBe(false);
    expect(isTargetReached({ referencePrice: 8, targetPrice: null })).toBe(false);
  });

  it("totalise les recherchées sans compter les prix inconnus", () => {
    const state = run(emptyState(), { type: "wish/add", card: card(1), price: price(10) }, { type: "wish/add", card: card(2), price: null }, { type: "wish/target", id: "sv01-001", value: 12 });
    expect(calculateWishlistTotal(state.wishlist)).toEqual({ total: 10, unknownCount: 1, targetReached: 1 });
  });

  it("calcule valeur, coût et plus-value des scellés", () => {
    const base = { setId: null, setName: null, image: null, status: "owned" as const, priceUpdatedAt: null, note: "", addedAt: "2026-01-01", productId: null };
    const totals = calculateSealedTotals([
      { ...base, id: "a", name: "Display", type: "display", quantity: 2, purchasePrice: 100, marketPrice: 140 },
      { ...base, id: "b", name: "ETB", type: "etb", quantity: 1, purchasePrice: 50, marketPrice: null },
    ]);
    expect(totals).toEqual({ market: 280, cost: 250, profit: 80, units: 3, unknownCount: 1 });
  });
});

describe("persistance", () => {
  it("migre l'ancien binder v0.1 vers la collection (barre latérale)", () => {
    const legacy = [{ ...card(1), language: "FR", condition: "NM", quantity: 2, prices: price(7), referencePrice: 7, lastPriceUpdate: null }];
    const state = migrateLegacy(legacy);
    expect(state?.collection[0].quantity).toBe(2);
    expect(state?.collection[0].referencePrice).toBe(7);
    expect(state?.placements).toEqual([]);
    expect(state?.binders).toHaveLength(1);
  });

  it("fait un aller-retour sauvegarde → restauration sans perte", () => {
    const state = run(
      emptyState(),
      { type: "collection/add", card: card(1), price: price(10), place: true },
      { type: "wish/add", card: card(2), price: price(4) },
    );
    const restored = parseBackup(serializeBackup(state));
    expect(restored.collection).toEqual(state.collection);
    expect(restored.placements).toEqual(state.placements);
    expect(restored.wishlist).toEqual(state.wishlist);
  });

  it("rejette ou nettoie les données invalides", () => {
    expect(() => parseBackup("pas du json")).toThrow();
    expect(() => parseBackup("42")).toThrow();
    const dirty = sanitizeState({
      version: 2,
      binders: [{ id: "b", name: "x", cols: 99, rows: 0, pages: -4 }],
      collection: [{ ...card(1), quantity: 500, image: "javascript:alert(1)" }, { id: 3 }],
      placements: [
        { binderId: "b", position: 0, cardId: "sv01-001" },
        { binderId: "b", position: 0, cardId: "sv01-001" },
        { binderId: "ghost", position: 1, cardId: "sv01-001" },
        { binderId: "b", position: -1, cardId: "sv01-001" },
      ],
    });
    expect(dirty?.binders[0]).toMatchObject({ cols: 6, rows: 1, pages: 1 });
    expect(dirty?.collection).toHaveLength(1);
    expect(dirty?.collection[0].quantity).toBe(99);
    expect(dirty?.collection[0].image).toBeNull();
    expect(dirty?.placements).toHaveLength(1);
  });
});
