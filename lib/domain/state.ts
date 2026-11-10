import type {
  AppState,
  Binder,
  BinderItem,
  Card,
  CardPriceData,
  Placement,
  SealedItem,
  WishItem,
} from "./types";
import { calculateReferencePrice } from "./valuation";

export const MAX_QUANTITY = 99;
export const LAYOUTS: ReadonlyArray<{ cols: number; rows: number }> = [
  { cols: 3, rows: 3 },
  { cols: 4, rows: 3 },
  { cols: 3, rows: 4 },
  { cols: 4, rows: 4 },
];

export function newId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

export function createBinder(name = "Mon binder", cols = 4, rows = 4): Binder {
  return { id: newId(), name, cols, rows, pages: 1 };
}

export function emptyState(): AppState {
  const binder = createBinder();
  return {
    version: 2,
    binders: [binder],
    activeBinderId: binder.id,
    collection: [],
    placements: [],
    wishlist: [],
    sealed: [],
    settings: { showPrices: true },
  };
}

/* ---------- lectures ---------- */

export const perPage = (binder: Binder) => binder.cols * binder.rows;

export function getActiveBinder(state: AppState): Binder {
  return state.binders.find((binder) => binder.id === state.activeBinderId) ?? state.binders[0];
}

export function pageCount(state: AppState, binder: Binder): number {
  const size = perPage(binder);
  let max = -1;
  for (const placement of state.placements) {
    if (placement.binderId === binder.id && placement.position > max) max = placement.position;
  }
  return Math.max(binder.pages, Math.floor(max / size) + 1, 1);
}

export function placedCount(state: AppState, cardId: string): number {
  let count = 0;
  for (const placement of state.placements) if (placement.cardId === cardId) count += 1;
  return count;
}

export function unplacedCount(state: AppState, item: BinderItem): number {
  return Math.max(0, item.quantity - placedCount(state, item.id));
}

export function placementMap(state: AppState, binderId: string): Map<number, Placement> {
  const map = new Map<number, Placement>();
  for (const placement of state.placements) if (placement.binderId === binderId) map.set(placement.position, placement);
  return map;
}

export function firstFreePosition(state: AppState, binderId: string): number {
  const taken = placementMap(state, binderId);
  let position = 0;
  while (taken.has(position)) position += 1;
  return position;
}

function localIdOrder(a: string, b: string): number {
  const na = parseInt(a.replace(/\D/g, ""), 10);
  const nb = parseInt(b.replace(/\D/g, ""), 10);
  if (Number.isFinite(na) && Number.isFinite(nb) && na !== nb) return na - nb;
  return a.localeCompare(b, "fr", { numeric: true });
}

/** Ordre « binder » : par extension puis par numéro. */
export function compareCards(a: Card, b: Card): number {
  return a.extensionId.localeCompare(b.extensionId, "fr", { numeric: true }) || localIdOrder(a.localId, b.localId);
}

/** Valeurs primitives du binder actif (pratique pour les composants : rien à muter par erreur). */
export function binderGeometry(state: AppState): { binderId: string; name: string; cols: number; rows: number; size: number; total: number } {
  const binder = getActiveBinder(state);
  return { binderId: binder.id, name: binder.name, cols: binder.cols, rows: binder.rows, size: perPage(binder), total: pageCount(state, binder) };
}

/** Valeur (€) des cartes posées sur une page donnée, ou sur tout le binder si `page` est omis. */
export function placedValue(state: AppState, binder: Binder, page?: number): number {
  return placedValueFor(state, binder.id, perPage(binder), page);
}

export function placedValueFor(state: AppState, binderId: string, size: number, page?: number): number {
  const prices = new Map(state.collection.map((item) => [item.id, item.referencePrice]));
  let total = 0;
  for (const placement of state.placements) {
    if (placement.binderId !== binderId) continue;
    if (page !== undefined && Math.floor(placement.position / size) !== page) continue;
    total += prices.get(placement.cardId) ?? 0;
  }
  return total;
}

/* ---------- actions ---------- */

export type Action =
  | { type: "hydrate"; state: AppState }
  | { type: "collection/add"; card: Card; price: CardPriceData | null; place?: boolean }
  | { type: "collection/quantity"; id: string; quantity: number }
  | { type: "collection/remove"; id: string }
  | { type: "collection/purchase"; id: string; value: number | null }
  | { type: "price/set"; kind: "collection" | "wishlist"; id: string; price: CardPriceData }
  | { type: "binder/place"; position: number; cardId: string }
  | { type: "binder/unplace"; position: number }
  | { type: "binder/move"; from: number; to: number }
  | { type: "binder/autofill" }
  | { type: "binder/add-page" }
  | { type: "binder/remove-page" }
  | { type: "binder/layout"; cols: number; rows: number }
  | { type: "binder/create"; name: string }
  | { type: "binder/rename"; name: string }
  | { type: "binder/delete" }
  | { type: "binder/select"; id: string }
  | { type: "wish/add"; card: Card; price: CardPriceData | null }
  | { type: "wish/remove"; id: string }
  | { type: "wish/target"; id: string; value: number | null }
  | { type: "wish/acquire"; id: string }
  | { type: "sealed/upsert"; item: SealedItem }
  | { type: "sealed/remove"; id: string }
  | { type: "sealed/acquire"; id: string }
  | { type: "settings/prices"; value: boolean };

/** Ne garde que les champs du catalogue (évite de recopier prix, quantité, objectifs…). */
export function toCard(card: Card): Card {
  return {
    id: card.id,
    game: card.game,
    name: card.name,
    localId: card.localId,
    printedTotal: card.printedTotal,
    extensionId: card.extensionId,
    extension: card.extension,
    series: card.series,
    image: card.image,
    rarity: card.rarity,
  };
}

const clampQuantity = (value: number) => Math.max(1, Math.min(MAX_QUANTITY, Math.round(value) || 1));

function withPrice<T extends { prices: CardPriceData | null; referencePrice: number | null; lastPriceUpdate: string | null }>(
  item: T,
  price: CardPriceData | null,
): T {
  return { ...item, prices: price, referencePrice: calculateReferencePrice(price), lastPriceUpdate: price?.updatedAt ?? null };
}

/** Retire les emplacements en trop quand la quantité d'une carte baisse (les derniers positions d'abord). */
function trimPlacements(placements: Placement[], item: BinderItem): Placement[] {
  const mine = placements.filter((placement) => placement.cardId === item.id);
  if (mine.length <= item.quantity) return placements;
  const drop = new Set(
    [...mine].sort((a, b) => b.position - a.position).slice(0, mine.length - item.quantity),
  );
  return placements.filter((placement) => !drop.has(placement));
}

export function reduce(state: AppState, action: Action): AppState {
  switch (action.type) {
    case "hydrate":
      return action.state;

    case "collection/add": {
      const existing = state.collection.find((item) => item.id === action.card.id);
      const card = toCard(action.card);
      const collection = existing
        ? state.collection.map((item) => {
            if (item.id !== existing.id) return item;
            const bumped = { ...item, quantity: Math.min(MAX_QUANTITY, item.quantity + 1) };
            return item.prices ? bumped : withPrice(bumped, action.price);
          })
        : [
            ...state.collection,
            withPrice(
              { ...card, language: "FR" as const, condition: "NM" as const, quantity: 1, prices: null, referencePrice: null, lastPriceUpdate: null, purchasePrice: null, addedAt: new Date().toISOString() },
              action.price,
            ),
          ];
      let next: AppState = { ...state, collection };
      if (action.place) {
        const binder = getActiveBinder(next);
        const item = collection.find((candidate) => candidate.id === action.card.id);
        if (item && unplacedCount(next, item) > 0) {
          next = { ...next, placements: [...next.placements, { binderId: binder.id, position: firstFreePosition(next, binder.id), cardId: item.id }] };
        }
      }
      // Une carte achetée n'est plus « recherchée ».
      return { ...next, wishlist: next.wishlist.filter((item) => item.id !== action.card.id) };
    }

    case "collection/quantity": {
      const quantity = clampQuantity(action.quantity);
      let placements = state.placements;
      const collection = state.collection.map((item) => {
        if (item.id !== action.id) return item;
        const updated = { ...item, quantity };
        placements = trimPlacements(placements, updated);
        return updated;
      });
      return { ...state, collection, placements };
    }

    case "collection/remove":
      return {
        ...state,
        collection: state.collection.filter((item) => item.id !== action.id),
        placements: state.placements.filter((placement) => placement.cardId !== action.id),
      };

    case "collection/purchase":
      return {
        ...state,
        collection: state.collection.map((item) => (item.id === action.id ? { ...item, purchasePrice: action.value } : item)),
      };

    case "price/set":
      return action.kind === "collection"
        ? { ...state, collection: state.collection.map((item) => (item.id === action.id ? withPrice(item, action.price) : item)) }
        : { ...state, wishlist: state.wishlist.map((item) => (item.id === action.id ? withPrice(item, action.price) : item)) };

    case "binder/place": {
      const binder = getActiveBinder(state);
      const item = state.collection.find((candidate) => candidate.id === action.cardId);
      if (!item || action.position < 0) return state;
      const placements = state.placements.filter(
        (placement) => !(placement.binderId === binder.id && placement.position === action.position),
      );
      if (placements.filter((placement) => placement.cardId === item.id).length >= item.quantity) return state;
      return { ...state, placements: [...placements, { binderId: binder.id, position: action.position, cardId: item.id }] };
    }

    case "binder/unplace": {
      const binder = getActiveBinder(state);
      return {
        ...state,
        placements: state.placements.filter((placement) => !(placement.binderId === binder.id && placement.position === action.position)),
      };
    }

    case "binder/move": {
      const binder = getActiveBinder(state);
      if (action.from === action.to || action.to < 0) return state;
      const map = placementMap(state, binder.id);
      const source = map.get(action.from);
      if (!source) return state;
      const target = map.get(action.to);
      const others = state.placements.filter(
        (placement) => placement !== source && placement !== target,
      );
      const moved: Placement[] = [{ ...source, position: action.to }];
      if (target) moved.push({ ...target, position: action.from });
      return { ...state, placements: [...others, ...moved] };
    }

    case "binder/autofill": {
      const binder = getActiveBinder(state);
      const queue: string[] = [];
      for (const item of [...state.collection].sort(compareCards)) {
        for (let n = 0; n < unplacedCount(state, item); n += 1) queue.push(item.id);
      }
      if (!queue.length) return state;
      const taken = placementMap(state, binder.id);
      const added: Placement[] = [];
      let position = 0;
      for (const cardId of queue) {
        while (taken.has(position)) position += 1;
        added.push({ binderId: binder.id, position, cardId });
        position += 1;
      }
      return { ...state, placements: [...state.placements, ...added] };
    }

    case "binder/add-page": {
      const binder = getActiveBinder(state);
      const pages = pageCount(state, binder) + 1;
      return { ...state, binders: state.binders.map((b) => (b.id === binder.id ? { ...b, pages } : b)) };
    }

    case "binder/remove-page": {
      const binder = getActiveBinder(state);
      const total = pageCount(state, binder);
      if (total <= 1) return state;
      const size = perPage(binder);
      const lastPageUsed = state.placements.some(
        (placement) => placement.binderId === binder.id && Math.floor(placement.position / size) === total - 1,
      );
      if (lastPageUsed) return state;
      return { ...state, binders: state.binders.map((b) => (b.id === binder.id ? { ...b, pages: total - 1 } : b)) };
    }

    case "binder/layout": {
      const binder = getActiveBinder(state);
      return { ...state, binders: state.binders.map((b) => (b.id === binder.id ? { ...b, cols: action.cols, rows: action.rows } : b)) };
    }

    case "binder/create": {
      const active = getActiveBinder(state);
      const binder = createBinder(action.name.trim() || "Nouveau binder", active.cols, active.rows);
      return { ...state, binders: [...state.binders, binder], activeBinderId: binder.id };
    }

    case "binder/rename": {
      const binder = getActiveBinder(state);
      const name = action.name.trim().slice(0, 40) || binder.name;
      return { ...state, binders: state.binders.map((b) => (b.id === binder.id ? { ...b, name } : b)) };
    }

    case "binder/delete": {
      if (state.binders.length <= 1) return state;
      const binder = getActiveBinder(state);
      const binders = state.binders.filter((b) => b.id !== binder.id);
      return {
        ...state,
        binders,
        activeBinderId: binders[0].id,
        placements: state.placements.filter((placement) => placement.binderId !== binder.id),
      };
    }

    case "binder/select":
      return state.binders.some((b) => b.id === action.id) ? { ...state, activeBinderId: action.id } : state;

    case "wish/add": {
      if (state.wishlist.some((item) => item.id === action.card.id)) return state;
      const item: WishItem = withPrice(
        { ...toCard(action.card), prices: null, referencePrice: null, lastPriceUpdate: null, targetPrice: null, addedAt: new Date().toISOString() },
        action.price,
      );
      return { ...state, wishlist: [item, ...state.wishlist] };
    }

    case "wish/remove":
      return { ...state, wishlist: state.wishlist.filter((item) => item.id !== action.id) };

    case "wish/target":
      return { ...state, wishlist: state.wishlist.map((item) => (item.id === action.id ? { ...item, targetPrice: action.value } : item)) };

    case "wish/acquire": {
      const wanted = state.wishlist.find((item) => item.id === action.id);
      if (!wanted) return state;
      return reduce(state, { type: "collection/add", card: wanted, price: wanted.prices });
    }

    case "sealed/upsert": {
      const item: SealedItem = { ...action.item, quantity: clampQuantity(action.item.quantity) };
      const exists = state.sealed.some((candidate) => candidate.id === item.id);
      return { ...state, sealed: exists ? state.sealed.map((candidate) => (candidate.id === item.id ? item : candidate)) : [item, ...state.sealed] };
    }

    case "sealed/remove":
      return { ...state, sealed: state.sealed.filter((item) => item.id !== action.id) };

    case "sealed/acquire":
      return { ...state, sealed: state.sealed.map((item) => (item.id === action.id ? { ...item, status: "owned" as const } : item)) };

    case "settings/prices":
      return { ...state, settings: { ...state.settings, showPrices: action.value } };

    default:
      return state;
  }
}
