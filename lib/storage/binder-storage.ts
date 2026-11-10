import { SEALED_TYPES } from "@/lib/domain/sealed";
import { MAX_QUANTITY, emptyState } from "@/lib/domain/state";
import type { AppState, Binder, BinderItem, CardPriceData, Placement, SealedItem, WishItem } from "@/lib/domain/types";
import { calculateReferencePrice } from "@/lib/domain/valuation";

export interface AppStorage {
  load(): AppState;
  save(state: AppState): void;
}

const STORAGE_KEY = "tcg-binder-tracker:v2:state";
const LEGACY_KEY = "tcg-binder-tracker:v0.1:binder";

/* ---------- validation défensive (localStorage, import de sauvegarde) ---------- */

type Rec = Record<string, unknown>;
const isRecord = (value: unknown): value is Rec => typeof value === "object" && value !== null && !Array.isArray(value);
const str = (value: unknown, max = 200): string | null => (typeof value === "string" && value.length > 0 ? value.slice(0, max) : null);
const num = (value: unknown): number | null => (typeof value === "number" && Number.isFinite(value) ? value : null);
const url = (value: unknown): string | null => (typeof value === "string" && /^https:\/\//i.test(value) ? value.slice(0, 500) : null);
const clamp = (value: unknown, min: number, max: number, fallback: number) => {
  const n = num(value);
  return n === null ? fallback : Math.max(min, Math.min(max, Math.round(n)));
};
const money = (value: unknown): number | null => {
  const n = num(value);
  return n !== null && n >= 0 && n < 1_000_000 ? n : null;
};

function parsePrice(value: unknown): CardPriceData | null {
  if (!isRecord(value) || typeof value.updatedAt !== "string") return null;
  return {
    currency: "EUR",
    language: "FR",
    condition: "NM",
    lowest: num(value.lowest),
    trend: num(value.trend),
    avg7: num(value.avg7),
    avg30: num(value.avg30),
    updatedAt: value.updatedAt,
    source: "TCGGO / Cardmarket",
    providerProductId: str(value.providerProductId, 60),
  };
}

function parseCard(value: unknown) {
  if (!isRecord(value)) return null;
  const id = str(value.id, 60);
  const name = str(value.name, 120);
  const localId = str(value.localId, 20);
  if (!id || !name || !localId) return null;
  return {
    id,
    game: "pokemon" as const,
    name,
    localId,
    printedTotal: (() => { const n = num(value.printedTotal); return n !== null && n > 0 ? Math.round(n) : null; })(),
    extensionId: str(value.extensionId, 40) ?? id.split("-")[0],
    extension: str(value.extension, 120) ?? "Extension inconnue",
    series: str(value.series, 120),
    image: url(value.image),
    rarity: str(value.rarity, 120),
  };
}

function parseBinder(value: unknown): Binder | null {
  if (!isRecord(value)) return null;
  const id = str(value.id, 60);
  if (!id) return null;
  return {
    id,
    name: str(value.name, 40) ?? "Mon binder",
    cols: clamp(value.cols, 1, 6, 4),
    rows: clamp(value.rows, 1, 6, 4),
    pages: clamp(value.pages, 1, 200, 1),
  };
}

export function sanitizeState(raw: unknown): AppState | null {
  if (!isRecord(raw)) return null;
  const fallback = emptyState();

  const binders = (Array.isArray(raw.binders) ? raw.binders : []).map(parseBinder).filter((b): b is Binder => b !== null);
  const uniqueBinders = binders.filter((b, i) => binders.findIndex((o) => o.id === b.id) === i);
  if (!uniqueBinders.length) uniqueBinders.push(fallback.binders[0]);
  const activeBinderId = uniqueBinders.some((b) => b.id === raw.activeBinderId) ? (raw.activeBinderId as string) : uniqueBinders[0].id;

  const seen = new Set<string>();
  const collection: BinderItem[] = [];
  for (const entry of Array.isArray(raw.collection) ? raw.collection : []) {
    const card = parseCard(entry);
    if (!card || seen.has(card.id) || !isRecord(entry)) continue;
    seen.add(card.id);
    const prices = parsePrice(entry.prices);
    collection.push({
      ...card,
      language: "FR",
      condition: "NM",
      quantity: clamp(entry.quantity, 1, MAX_QUANTITY, 1),
      prices,
      referencePrice: calculateReferencePrice(prices),
      lastPriceUpdate: prices?.updatedAt ?? null,
      purchasePrice: money(entry.purchasePrice),
      addedAt: str(entry.addedAt, 40) ?? undefined,
    });
  }

  const quantities = new Map(collection.map((item) => [item.id, item.quantity]));
  const used = new Map<string, number>();
  const slots = new Set<string>();
  const placements: Placement[] = [];
  for (const entry of Array.isArray(raw.placements) ? raw.placements : []) {
    if (!isRecord(entry)) continue;
    const binderId = str(entry.binderId, 60);
    const cardId = str(entry.cardId, 60);
    const position = num(entry.position);
    if (!binderId || !cardId || position === null || !Number.isInteger(position) || position < 0 || position > 20_000) continue;
    if (!uniqueBinders.some((b) => b.id === binderId) || !quantities.has(cardId)) continue;
    const slotKey = `${binderId}:${position}`;
    if (slots.has(slotKey) || (used.get(cardId) ?? 0) >= (quantities.get(cardId) ?? 0)) continue;
    slots.add(slotKey);
    used.set(cardId, (used.get(cardId) ?? 0) + 1);
    placements.push({ binderId, position, cardId });
  }

  const wishSeen = new Set<string>();
  const wishlist: WishItem[] = [];
  for (const entry of Array.isArray(raw.wishlist) ? raw.wishlist : []) {
    const card = parseCard(entry);
    if (!card || wishSeen.has(card.id) || !isRecord(entry)) continue;
    wishSeen.add(card.id);
    const prices = parsePrice(entry.prices);
    wishlist.push({
      ...card,
      prices,
      referencePrice: calculateReferencePrice(prices),
      lastPriceUpdate: prices?.updatedAt ?? null,
      targetPrice: money(entry.targetPrice),
      addedAt: str(entry.addedAt, 40) ?? new Date(0).toISOString(),
    });
  }

  const sealedIds = new Set<string>();
  const sealed: SealedItem[] = [];
  for (const entry of Array.isArray(raw.sealed) ? raw.sealed : []) {
    if (!isRecord(entry)) continue;
    const id = str(entry.id, 60);
    const name = str(entry.name, 120);
    if (!id || !name || sealedIds.has(id)) continue;
    sealedIds.add(id);
    const type = SEALED_TYPES.find((t) => t.id === entry.type)?.id ?? "autre";
    sealed.push({
      id,
      name,
      type,
      setId: str(entry.setId, 40),
      setName: str(entry.setName, 120),
      image: url(entry.image),
      status: entry.status === "wanted" ? "wanted" : "owned",
      quantity: clamp(entry.quantity, 1, MAX_QUANTITY, 1),
      purchasePrice: money(entry.purchasePrice),
      marketPrice: money(entry.marketPrice),
      priceUpdatedAt: str(entry.priceUpdatedAt, 40),
      note: typeof entry.note === "string" ? entry.note.slice(0, 500) : "",
      addedAt: str(entry.addedAt, 40) ?? new Date(0).toISOString(),
    });
  }

  const settings = isRecord(raw.settings) ? raw.settings : {};
  return {
    version: 2,
    binders: uniqueBinders,
    activeBinderId,
    collection,
    placements,
    wishlist,
    sealed,
    settings: { showPrices: settings.showPrices !== false },
  };
}

/** Migration v0.1 : l'ancien binder était une simple liste de cartes → elles arrivent dans la barre latérale « à placer ». */
export function migrateLegacy(raw: unknown): AppState | null {
  if (!Array.isArray(raw)) return null;
  return sanitizeState({ version: 2, collection: raw });
}

/* ---------- sauvegarde / restauration ---------- */

export function serializeBackup(state: AppState): string {
  return JSON.stringify({ app: "tcg-binder-tracker", exportedAt: new Date().toISOString(), state }, null, 2);
}

export function parseBackup(text: string): AppState {
  let parsed: unknown;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Ce fichier n’est pas un JSON valide.");
  }
  const candidate = isRecord(parsed) && isRecord(parsed.state) ? parsed.state : parsed;
  const legacy = migrateLegacy(candidate);
  const state = legacy ?? sanitizeState(candidate);
  if (!state) throw new Error("Ce fichier n’est pas une sauvegarde de TCG Binder.");
  return state;
}

/* ---------- localStorage ---------- */

export class LocalStorageAppStorage implements AppStorage {
  load(): AppState {
    if (typeof window === "undefined") return emptyState();
    try {
      const current = window.localStorage.getItem(STORAGE_KEY);
      if (current) {
        const state = sanitizeState(JSON.parse(current));
        if (state) return state;
      }
      const legacy = window.localStorage.getItem(LEGACY_KEY);
      if (legacy) {
        const state = migrateLegacy(JSON.parse(legacy));
        if (state) return state;
      }
    } catch {
      /* données illisibles : on repart d'un état vide plutôt que de planter */
    }
    return emptyState();
  }

  save(state: AppState) {
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* quota dépassé ou stockage désactivé : l'app reste utilisable en mémoire */
    }
  }
}
