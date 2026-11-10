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

/** Une carte de la collection (stock). Les emplacements dans les binders sont dans `Placement`. */
export interface BinderItem extends Card {
  language: CardLanguage;
  condition: CardCondition;
  quantity: number;
  prices: CardPriceData | null;
  referencePrice: number | null;
  lastPriceUpdate: string | null;
  /** Prix d'achat unitaire, facultatif (sert au calcul de plus-value). */
  purchasePrice?: number | null;
  addedAt?: string;
}

/** Une carte recherchée (wishlist). */
export interface WishItem extends Card {
  prices: CardPriceData | null;
  referencePrice: number | null;
  lastPriceUpdate: string | null;
  /** Prix cible : l'objectif est « atteint » quand le prix de référence passe en dessous. */
  targetPrice: number | null;
  addedAt: string;
}

export type SealedType =
  | "display"
  | "etb"
  | "etb-pc"
  | "upc"
  | "coffret"
  | "bundle"
  | "tripack"
  | "booster"
  | "autre";

export type SealedStatus = "owned" | "wanted";

export interface SealedItem {
  id: string;
  name: string;
  type: SealedType;
  setId: string | null;
  setName: string | null;
  /** Logo de l'extension (TCGdex) ou null. */
  image: string | null;
  status: SealedStatus;
  quantity: number;
  /** Prix d'achat unitaire (produits possédés). */
  purchasePrice: number | null;
  /** Prix de marché saisi à la main : aucune source de prix scellé n'est branchée. */
  marketPrice: number | null;
  priceUpdatedAt: string | null;
  note: string;
  addedAt: string;
}

export interface Binder {
  id: string;
  name: string;
  cols: number;
  rows: number;
  /** Nombre minimal de pages (les pages vides ajoutées à la main). */
  pages: number;
}

/**
 * Position globale dans le binder : `page * (cols*rows) + emplacement`.
 * Changer la grille (4×4 → 3×3) ne casse donc aucun placement.
 */
export interface Placement {
  binderId: string;
  position: number;
  cardId: string;
}

export interface Settings {
  showPrices: boolean;
}

export interface AppState {
  version: 2;
  binders: Binder[];
  activeBinderId: string;
  collection: BinderItem[];
  placements: Placement[];
  wishlist: WishItem[];
  sealed: SealedItem[];
  settings: Settings;
}

export interface CardPriceProvider {
  getPrice(card: Card): Promise<CardPriceData>;
}

export interface CardCatalogProvider {
  search(query: string): Promise<Card[]>;
}

export interface SetSummary {
  id: string;
  name: string;
  logo: string | null;
  cardCount: number | null;
}
