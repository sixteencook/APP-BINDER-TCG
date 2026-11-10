const eur = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" });
const eurShort = new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const dateTimeFormat = new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" });

export const money = (value: number | null | undefined) => (value === null || value === undefined ? "N/A" : eur.format(value));

/** Prix compact pour les pastilles sur les cartes : « 3,5 € », « 128 € ». */
export function moneyTag(value: number | null | undefined): string {
  if (value === null || value === undefined) return "—";
  return value >= 100 ? eurShort.format(value) : eur.format(value).replace(",00", "");
}

export const signedMoney = (value: number) => `${value > 0 ? "+" : ""}${eur.format(value)}`;

export const dateTime = (value: string | null | undefined) => (value ? dateTimeFormat.format(new Date(value)) : "N/A");

/** TCGdex expose `…/high.webp` et `…/low.webp` : les vignettes utilisent `low` (≈ 5× plus léger). */
export function thumbnail(image: string | null): string | null {
  return image ? image.replace(/\/high\.webp$/, "/low.webp") : null;
}
