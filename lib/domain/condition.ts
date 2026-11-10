import type { CardCondition } from "./types";

/**
 * États Cardmarket. TCGGO ne fournit le « premier prix FR » qu'en Near Mint :
 * pour les autres états, la valeur est une ESTIMATION = prix NM × coefficient (ordre de grandeur courant).
 */
export const CONDITIONS: { id: CardCondition; short: string; label: string; factor: number }[] = [
  { id: "NM", short: "NM", label: "Near Mint", factor: 1 },
  { id: "EX", short: "EX", label: "Excellent", factor: 0.85 },
  { id: "GD", short: "GD", label: "Good", factor: 0.7 },
  { id: "LP", short: "LP", label: "Light Played", factor: 0.6 },
  { id: "PL", short: "PL", label: "Played", factor: 0.45 },
  { id: "PO", short: "PO", label: "Poor", factor: 0.3 },
];

export function parseCondition(value: unknown): CardCondition {
  return CONDITIONS.find((condition) => condition.id === value)?.id ?? "NM";
}

export function conditionFactor(condition: CardCondition): number {
  return CONDITIONS.find((candidate) => candidate.id === condition)?.factor ?? 1;
}

export function conditionLabel(condition: CardCondition): string {
  return CONDITIONS.find((candidate) => candidate.id === condition)?.label ?? "Near Mint";
}

/** Prix NM → valeur estimée pour l'état (arrondie au centime). `null` reste `null`. */
export function applyCondition(price: number | null, condition: CardCondition): number | null {
  if (price === null) return null;
  return Math.round(price * conditionFactor(condition) * 100) / 100;
}
