import type { Card, CardPriceData, CardPriceProvider } from "@/lib/domain/types";

const DEFAULT_HOST = "cardmarket-api-tcg.p.rapidapi.com";
const CACHE_TTL_MS = Number(process.env.PRICE_CACHE_TTL_MS ?? 4 * 60 * 60 * 1000);

type TcggoCard = {
  id?: number | string;
  name?: string;
  card_number?: number | string;
  tcgid?: string;
  episode?: { name?: string; code?: string };
  prices?: {
    cardmarket?: {
      currency?: string;
      lowest_near_mint_FR?: number | null;
      trend?: number | null;
      trend_price?: number | null;
      "7d_average"?: number | null;
      "30d_average"?: number | null;
    };
  };
};

type TcggoResponse = { data?: TcggoCard[] | TcggoCard };
const cache = new Map<string, { expires: number; value: CardPriceData }>();

function nullableNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function normalizeId(value: string) {
  return value.toLowerCase().replace(/([a-z]+)0+(\d+)/g, "$1$2").replace(/[^a-z0-9]/g, "");
}

export function toTcggoId(catalogId: string) {
  return catalogId.toLowerCase().replace(/^([a-z]+)0+(\d+)/, "$1$2");
}

export function mapTcggoPrice(card: TcggoCard, updatedAt = new Date().toISOString()): CardPriceData {
  const market = card.prices?.cardmarket;
  return {
    currency: "EUR",
    language: "FR",
    condition: "NM",
    lowest: nullableNumber(market?.lowest_near_mint_FR),
    trend: nullableNumber(market?.trend ?? market?.trend_price),
    avg7: nullableNumber(market?.["7d_average"]),
    avg30: nullableNumber(market?.["30d_average"]),
    updatedAt,
    source: "TCGGO / Cardmarket",
    providerProductId: card.id === undefined ? null : String(card.id),
  };
}

function chooseMatch(candidates: TcggoCard[], card: Card): TcggoCard | null {
  const exactId = candidates.find((candidate) => candidate.tcgid && normalizeId(candidate.tcgid) === normalizeId(card.id));
  if (exactId) return exactId;
  const wantedNumber = card.localId.replace(/^0+/, "").toLowerCase();
  const byNumber = candidates.filter(
    (candidate) => String(candidate.card_number ?? "").replace(/^0+/, "").toLowerCase() === wantedNumber,
  );
  return (
    byNumber.find((candidate) => {
      const haystack = `${candidate.episode?.name ?? ""} ${candidate.episode?.code ?? ""}`.toLowerCase();
      return haystack.includes(card.extension.toLowerCase()) || haystack.includes(card.extensionId.toLowerCase());
    }) ??
    byNumber[0] ??
    null
  );
}

export class TCGGOPriceProvider implements CardPriceProvider {
  constructor(
    private readonly apiKey = process.env.TCGGO_API_KEY,
    private readonly host = process.env.TCGGO_API_HOST ?? DEFAULT_HOST,
  ) {}

  async getPrice(card: Card): Promise<CardPriceData> {
    if (!this.apiKey) throw new Error("PRICE_NOT_CONFIGURED");
    const cached = cache.get(card.id);
    if (cached && cached.expires > Date.now()) return cached.value;

    const request = async (params: URLSearchParams) => {
      const response = await fetch(`https://${this.host}/pokemon/cards/search?${params}`, {
        headers: { "x-rapidapi-key": this.apiKey!, "x-rapidapi-host": this.host },
        signal: AbortSignal.timeout(12_000),
      });
      if (response.status === 429) throw new Error("RATE_LIMITED");
      if (!response.ok) throw new Error(`PRICE_PROVIDER_${response.status}`);
      const payload = (await response.json()) as TcggoResponse;
      return Array.isArray(payload.data) ? payload.data : payload.data ? [payload.data] : [];
    };

    let candidates = await request(new URLSearchParams({ tcgid: toTcggoId(card.id), sort: "relevance" }));
    let match = chooseMatch(candidates, card);
    if (!match) {
      candidates = await request(new URLSearchParams({ search: `${card.name} ${card.localId}`, sort: "relevance" }));
      match = chooseMatch(candidates, card);
    }
    if (!match) throw new Error("PRICE_NOT_FOUND");
    const value = mapTcggoPrice(match);
    cache.set(card.id, { value, expires: Date.now() + CACHE_TTL_MS });
    return value;
  }
}
