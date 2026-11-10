import { NextResponse } from "next/server";

/** Même grille d'erreurs que /api/prices, pour les produits scellés. */
export function productErrorResponse(error: unknown, where: string) {
  const code = error instanceof Error ? error.message : "UNKNOWN";
  if (code === "PRICE_NOT_CONFIGURED")
    return NextResponse.json({ error: "Source de prix non configurée", code }, { status: 503 });
  if (code === "RATE_LIMITED")
    return NextResponse.json({ error: "Limite de requêtes atteinte. Réessayez plus tard.", code }, { status: 429 });
  console.error(`[${where}] échec fournisseur :`, code);
  const status = /^PRICE_PROVIDER_(\d{3})$/.exec(code)?.[1];
  if (status === "401" || status === "403")
    return NextResponse.json({ error: `Clé RapidAPI refusée (${status}) : vérifiez TCGGO_API_KEY et l’abonnement à « CardMarket API TCG ».`, code }, { status: 502 });
  if (status)
    return NextResponse.json({ error: `La source de prix a répondu une erreur (${status}).`, code }, { status: 502 });
  return NextResponse.json({ error: "La source de prix est injoignable (réseau ou délai dépassé).", code }, { status: 502 });
}
