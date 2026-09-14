export type CardLanguage = "FR";
export type CardCondition = "NM";

export interface Card {
  id: string;
  game: "pokemon";
  name: string;
  localId: string;
  printedTotal: number | null;
  extensionId: string;
  extension: string;
  series: string | null;
  image: string | null;
  rarity: string | null;
}

export interface CardPriceData {
  currency: "EUR";
  language: CardLanguage;
  condition: CardCondition;
  lowest: number | null;
  trend: number | null;
  avg7: number | null;
  avg30: number | null;
  updatedAt: string;
  source: "TCGGO / Cardmarket";
  providerProductId: string | null;
}

export interface BinderItem extends Card {
  language: CardLanguage;
  condition: CardCondition;
  quantity: number;
  prices: CardPriceData | null;
  referencePrice: number | null;
  lastPriceUpdate: string | null;
}

export interface CardPriceProvider {
  getPrice(card: Card): Promise<CardPriceData>;
}

export interface CardCatalogProvider {
  search(query: string): Promise<Card[]>;
}
