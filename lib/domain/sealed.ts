import type { SealedType } from "./types";

export const SEALED_TYPES: { id: SealedType; label: string; short: string }[] = [
  { id: "display", label: "Display (36 boosters)", short: "Display" },
  { id: "etb", label: "ETB (Coffret Dresseur d’élite)", short: "ETB" },
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

/** Nom proposé par défaut : « ETB · Évolutions Prismatiques ». */
export function defaultSealedName(type: SealedType, setName: string | null): string {
  const base = sealedTypeLabel(type, true);
  return setName ? `${base} · ${setName}` : base;
}

/** Devine le type d'un produit TCGGO à partir de son nom (anglais le plus souvent). */
export function guessSealedType(name: string): SealedType {
  const n = name.toLowerCase();
  if (/(booster box|display)/.test(n)) return "display";
  if (/(elite trainer box|\betb\b)/.test(n)) return "etb";
  if (/ultra.?premium/.test(n)) return "upc";
  if (/bundle/.test(n)) return "bundle";
  if (/(tri.?pack|3.?pack|three booster)/.test(n)) return "tripack";
  if (/(sleeved booster|booster pack|\bbooster\b)/.test(n)) return "booster";
  if (/(collection|box|tin|coffret|premium)/.test(n)) return "coffret";
  return "autre";
}

/** Lien de recherche Cardmarket (simple lien sortant, aucune donnée récupérée). */
export function cardmarketSearchUrl(name: string): string {
  return `https://www.cardmarket.com/fr/Pokemon/Products/Search?searchString=${encodeURIComponent(name)}`;
}
