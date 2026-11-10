import type { SealedType } from "./types";

export const SEALED_TYPES: { id: SealedType; label: string; short: string }[] = [
  { id: "display", label: "Display (36 boosters)", short: "Display" },
  { id: "etb", label: "ETB (Coffret Dresseur d’élite)", short: "ETB" },
  { id: "etb-pc", label: "ETB Pokémon Center", short: "ETB PC" },
  { id: "upc", label: "Collection Ultra-Premium", short: "UPC" },
  { id: "coffret", label: "Coffret / Collection", short: "Coffret" },
  { id: "bundle", label: "Bundle (6 boosters)", short: "Bundle" },
  { id: "tripack", label: "Tripack", short: "Tripack" },
  { id: "booster", label: "Booster", short: "Booster" },
  { id: "autre", label: "Autre", short: "Autre" },
];

export function sealedTypeLabel(type: SealedType, short = false): string {
  const found = SEALED_TYPES.find((candidate) => candidate.id === type);
  return found ? (short ? found.short : found.label) : type;
}

/** Nom proposé par défaut : « ETB Pokémon Center · Évolutions Prismatiques ». */
export function defaultSealedName(type: SealedType, setName: string | null): string {
  const base = sealedTypeLabel(type, true);
  return setName ? `${base} · ${setName}` : base;
}

/** Lien de recherche Cardmarket (simple lien sortant, aucune donnée récupérée). */
export function cardmarketSearchUrl(name: string): string {
  return `https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}`;
}
