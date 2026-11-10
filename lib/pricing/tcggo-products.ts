import type { SealedProductHit } from "@/lib/domain/types";

const DEFAULT_HOST = "cardmarket-api-tcg.p.rapidapi.com";
const CACHE_TTL_MS = Number(process.env.PRICE_CACHE_TTL_MS ?? 4 * 60 * 60 * 1000);

type TcggoProduct = {
  id?: number | string;
  name?: string;
  image?: string | null;
  episode?: { name?: string | null } | null;
  prices?: {
    cardmarket?: {
      lowest?: number | null;
      lowest_FR?: number | null;
      "7d_average"?: number | null;
      "30d_average"?: number | null;
    };
  };
};

type TcggoResponse = { data?: TcggoProduct[] | TcggoProduct };

const searchCache = new Map<string, { expires: number; value: SealedProductHit[] }>();
const priceCache = new Map<number, { expires: number; value: SealedProductHit }>();

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

export function mapTcggoProduct(product: TcggoProduct, updatedAt = new Date().toISOString()): SealedProductHit | null {
  const id = Number(product.id);
  if (!Number.isInteger(id) || id <= 0 || !product.name) return null;
  const market = product.prices?.cardmarket;
  const lowestFR = nullableNumber(market?.lowest_FR);
  const lowest = nullableNumber(market?.lowest);
  const avg7 = nullableNumber(market?.["7d_average"]);
  const avg30 = nullableNumber(market?.["30d_average"]);
  return {
    productId: id,
    name: String(product.name).slice(0, 120),
    image: typeof product.image === "string" && product.image.startsWith("https://") ? product.image : null,
    setName: typeof product.episode?.name === "string" ? product.episode.name.slice(0, 120) : null,
    // Premier prix vendeur France (lowest_FR), sinon le plus bas toutes origines = prix réellement payable ; les moyennes 7/30 j sont faussées sur les produits rares (2-3 ventes).
    price: lowestFR ?? lowest ?? avg7 ?? avg30,
    lowest: lowestFR ?? lowest,
    avg7,
    avg30,
    updatedAt,
  };
}

export class TCGGOProductProvider {
  constructor(
    private readonly apiKey = process.env.TCGGO_API_KEY,
    private readonly host = process.env.TCGGO_API_HOST ?? DEFAULT_HOST,
  ) {}

  private async request(params: URLSearchParams): Promise<SealedProductHit[]> {
    const response = await fetch(`https://${this.host}/pokemon/products/search?${params}`, {
      headers: { "x-rapidapi-key": this.apiKey!, "x-rapidapi-host": this.host },
      signal: AbortSignal.timeout(12_000),
    });
    if (response.status === 429) throw new Error("RATE_LIMITED");
    if (!response.ok) throw new Error(`PRICE_PROVIDER_${response.status}`);
    const payload = (await response.json()) as TcggoResponse;
    const list = Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
    return list.map((product) => mapTcggoProduct(product)).filter((hit): hit is SealedProductHit => hit !== null);
  }

  /** Recherche libre (« prismatic evolutions etb »…) — 20 premiers résultats. */
  async search(query: string): Promise<SealedProductHit[]> {
    if (!this.apiKey) throw new Error("PRICE_NOT_CONFIGURED");
    const key = query.trim().toLowerCase();
    const cached = searchCache.get(key);
    if (cached && cached.expires > Date.now()) return cached.value;
    const hits = await this.request(new URLSearchParams({ search: query.trim(), sort: "relevance" }));
    searchCache.set(key, { value: hits, expires: Date.now() + CACHE_TTL_MS });
    return hits;
  }

  /** Prix actuels d'un lot de produits (max 20 par requête, batch `ids=`). */
  async prices(ids: number[]): Promise<SealedProductHit[]> {
    if (!this.apiKey) throw new Error("PRICE_NOT_CONFIGURED");
    const now = Date.now();
    const wanted = [...new Set(ids)].filter((id) => Number.isInteger(id) && id > 0);
    const results: SealedProductHit[] = [];
    const missing: number[] = [];
    for (const id of wanted) {
      const cached = priceCache.get(id);
      if (cached && cached.expires > now) results.push(cached.value);
      else missing.push(id);
    }
    for (let start = 0; start < missing.length; start += 20) {
      const batch = missing.slice(start, start + 20);
      const hits = await this.request(new URLSearchParams({ ids: batch.join(",") }));
      for (const hit of hits) {
        priceCache.set(hit.productId, { value: hit, expires: now + CACHE_TTL_MS });
        results.push(hit);
      }
    }
    return results;
  }
}
