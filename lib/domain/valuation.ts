import type { BinderItem, CardPriceData, SealedItem, WishItem } from "./types";

export function calculateReferencePrice(price: CardPriceData | null): number | null {
  if (!price) return null;
  return price.trend ?? price.avg7 ?? price.avg30 ?? price.lowest ?? null;
}

export function calculateBinderTotal(items: BinderItem[]): {
  total: number;
  unknownCount: number;
} {
  return items.reduce(
    (result, item) => {
      if (item.referencePrice === null) {
        result.unknownCount += item.quantity;
      } else {
        result.total += item.referencePrice * item.quantity;
      }
      return result;
    },
    { total: 0, unknownCount: 0 },
  );
}

/** Coût pour acheter toutes les cartes recherchées + nombre d'objectifs de prix atteints. */
export function calculateWishlistTotal(items: WishItem[]): {
  total: number;
  unknownCount: number;
  targetReached: number;
} {
  return items.reduce(
    (result, item) => {
      if (item.referencePrice === null) result.unknownCount += 1;
      else result.total += item.referencePrice;
      if (isTargetReached(item)) result.targetReached += 1;
      return result;
    },
    { total: 0, unknownCount: 0, targetReached: 0 },
  );
}

export function isTargetReached(item: Pick<WishItem, "referencePrice" | "targetPrice">): boolean {
  return item.targetPrice !== null && item.referencePrice !== null && item.referencePrice <= item.targetPrice;
}

/** Valeur marché et coût d'achat des produits scellés possédés (les recherchés sont comptés à part). */
export function calculateSealedTotals(items: SealedItem[]): {
  market: number;
  cost: number;
  profit: number | null;
  units: number;
  unknownCount: number;
} {
  let market = 0;
  let cost = 0;
  let units = 0;
  let unknownCount = 0;
  let comparable = false;
  let profit = 0;
  for (const item of items) {
    units += item.quantity;
    if (item.marketPrice === null) unknownCount += item.quantity;
    else market += item.marketPrice * item.quantity;
    if (item.purchasePrice !== null) cost += item.purchasePrice * item.quantity;
    if (item.marketPrice !== null && item.purchasePrice !== null) {
      comparable = true;
      profit += (item.marketPrice - item.purchasePrice) * item.quantity;
    }
  }
  return { market, cost, profit: comparable ? profit : null, units, unknownCount };
}

/** Plus-value latente des cartes pour lesquelles un prix d'achat est renseigné. */
export function calculateCardProfit(items: BinderItem[]): number | null {
  let comparable = false;
  let profit = 0;
  for (const item of items) {
    if (item.purchasePrice == null || item.referencePrice === null) continue;
    comparable = true;
    profit += (item.referencePrice - item.purchasePrice) * item.quantity;
  }
  return comparable ? profit : null;
}
