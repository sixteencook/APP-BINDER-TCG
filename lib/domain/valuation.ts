import type { BinderItem, CardPriceData } from "./types";

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
