import type { Card, CardCatalogProvider } from "@/lib/domain/types";

const API_ROOT = "https://api.tcgdex.net/v2/fr";
const REQUEST_TIMEOUT_MS = 12_000;

type Brief = { id: string; localId: string; name: string; image?: string };
type Detail = Brief & {
  rarity?: string;
  set?: {
    id: string;
    name: string;
    cardCount?: { official?: number; total?: number };
    serie?: { name?: string };
  };
};

function normalize(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .replace(/[-_]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .toLowerCase();
}

export function parseCardQuery(query: string) {
  const trimmed = query.trim();
  const numberMatch = trimmed.match(/\b([A-Za-z]*\d+[A-Za-z]*)\s*\/\s*(\d+)\b/);
  const localId = numberMatch?.[1] ?? null;
  const printedTotal = numberMatch ? Number(numberMatch[2]) : null;
  const name = trimmed
    .replace(/\b[A-Za-z]*\d+[A-Za-z]*\s*\/\s*\d+\b/, "")
    .replace(/\s+/g, " ")
    .trim();
  return { name, localId, printedTotal };
}

async function getJson<T>(url: string): Promise<T> {
  const response = await fetch(url, { signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS) });
  if (!response.ok) throw new Error(`TCGdex a répondu ${response.status}`);
  return response.json() as Promise<T>;
}

async function mapWithConcurrency<T, R>(values: T[], limit: number, mapper: (value: T) => Promise<R>) {
  const result: R[] = [];
  for (let index = 0; index < values.length; index += limit) {
    result.push(...(await Promise.all(values.slice(index, index + limit).map(mapper))));
  }
  return result;
}

export class TCGdexCatalogProvider implements CardCatalogProvider {
  async search(query: string): Promise<Card[]> {
    const parsed = parseCardQuery(query);
    if (!parsed.name && !parsed.localId) return [];
    const searchName = (parsed.name.replace(/\s+ex$/i, "-ex").split(/\s+/).slice(0, 3).join(" ") || parsed.localId || "");
    let briefs = await getJson<Brief[]>(`${API_ROOT}/cards?name=${encodeURIComponent(searchName)}`);
    // Repli prudent pour les différences de ponctuation du catalogue.
    if (!briefs.length && searchName.includes(" ")) {
      const broader = await getJson<Brief[]>(`${API_ROOT}/cards?name=${encodeURIComponent(searchName.split(" ")[0])}`);
      briefs = broader;
    }

    if (parsed.localId) {
      const wanted = parsed.localId.replace(/^0+/, "").toLowerCase();
      briefs = briefs.filter((card) => card.localId.replace(/^0+/, "").toLowerCase() === wanted);
    }

    const details = await mapWithConcurrency(briefs.slice(0, 24), 4, (card) =>
      getJson<Detail>(`${API_ROOT}/cards/${encodeURIComponent(card.id)}`),
    );

    return details
      .filter((card) => {
        const expectedName = normalize(parsed.name);
        const actualName = normalize(card.name);
        const nameMatches = !expectedName || actualName.includes(expectedName) || expectedName.includes(actualName);
        const totalMatches =
          parsed.printedTotal === null || card.set?.cardCount?.official === parsed.printedTotal;
        return nameMatches && totalMatches;
      })
      .map((card) => ({
        id: card.id,
        game: "pokemon" as const,
        name: card.name.replace(/-ex$/i, " ex"),
        localId: card.localId,
        printedTotal: card.set?.cardCount?.official ?? null,
        extensionId: card.set?.id ?? card.id.split("-")[0],
        extension: card.set?.name ?? "Extension inconnue",
        series: card.set?.serie?.name ?? null,
        image: card.image ? `${card.image}/high.webp` : null,
        rarity: card.rarity ?? null,
      }));
  }
}
