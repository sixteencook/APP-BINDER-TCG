import { NextResponse } from "next/server";
import { z } from "zod";
import { TCGGOPriceProvider } from "@/lib/pricing/tcggo";

const cardSchema = z.object({
  id: z.string().regex(/^[A-Za-z0-9.-]{2,40}$/),
  game: z.literal("pokemon"),
  name: z.string().min(1).max(100),
  localId: z.string().min(1).max(20),
  printedTotal: z.number().int().positive().nullable(),
  extensionId: z.string().min(1).max(40),
  extension: z.string().min(1).max(120),
  series: z.string().max(120).nullable(),
  image: z.string().url().nullable(),
  rarity: z.string().max(120).nullable(),
});

export async function POST(request: Request) {
  const parsed = cardSchema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Carte invalide." }, { status: 400 });
  try {
    const price = await new TCGGOPriceProvider().getPrice(parsed.data);
    return NextResponse.json({ price });
  } catch (error) {
    const code = error instanceof Error ? error.message : "UNKNOWN";
    if (code === "PRICE_NOT_CONFIGURED")
      return NextResponse.json({ error: "Source de prix non configurée", code }, { status: 503 });
    if (code === "RATE_LIMITED")
      return NextResponse.json({ error: "Limite de requêtes atteinte. Réessayez plus tard.", code }, { status: 429 });
    if (code === "PRICE_NOT_FOUND")
      return NextResponse.json({ error: "Aucun prix Cardmarket correspondant n’a été trouvé.", code }, { status: 404 });
    return NextResponse.json({ error: "La source de prix est momentanément indisponible.", code }, { status: 502 });
  }
}
