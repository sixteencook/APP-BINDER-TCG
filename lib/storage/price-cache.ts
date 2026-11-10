import { toCard } from "@/lib/domain/state";
import type { Card, CardPriceData } from "@/lib/domain/types";

const KEY = "tcg-binder-tracker:v2:price-cache";
export const PRICE_TTL_MS = 4 * 60 * 60 * 1000;
const MAX_ENTRIES = 400;

type Entry = { price: CardPriceData; at: number };

function read(): Record<string, Entry> {
  try {
    const raw = window.localStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Record<string, Entry>) : {};
  } catch {
    return {};
  }
}

function write(cache: Record<string, Entry>) {
  try {
    const entries = Object.entries(cache).sort((a, b) => b[1].at - a[1].at).slice(0, MAX_ENTRIES);
    window.localStorage.setItem(KEY, JSON.stringify(Object.fromEntries(entries)));
  } catch {
    /* cache best-effort */
  }
}

export function getCachedPrice(cardId: string, ttl = PRICE_TTL_MS): CardPriceData | null {
  if (typeof window === "undefined") return null;
  const entry = read()[cardId];
  return entry && Date.now() - entry.at < ttl ? entry.price : null;
}

export function setCachedPrice(cardId: string, price: CardPriceData) {
  const cache = read();
  cache[cardId] = { price, at: Date.now() };
  write(cache);
}

export function clearPriceCache() {
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    /* rien à faire */
  }
}

export class PriceError extends Error {
  constructor(message: string, readonly code: string | null) {
    super(message);
  }
}

/** Récupère un prix : cache local (4 h) d'abord, puis la route serveur. `force` ignore le cache. */
export async function loadPrice(card: Card, force = false, signal?: AbortSignal): Promise<CardPriceData> {
  if (!force) {
    const cached = getCachedPrice(card.id);
    if (cached) return cached;
  }
  const response = await fetch("/api/prices", {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify(toCard(card)),
    signal,
  });
  const payload = (await response.json().catch(() => ({}))) as { price?: CardPriceData; error?: string; code?: string };
  if (!response.ok || !payload.price) throw new PriceError(payload.error ?? "Prix indisponible.", payload.code ?? null);
  setCachedPrice(card.id, payload.price);
  return payload.price;
}
