import { NextResponse } from "next/server";
import { z } from "zod";
import { TCGdexCatalogProvider } from "@/lib/catalog/tcgdex";

const schema = z.string().trim().min(2).max(100);

export async function GET(request: Request) {
  const parsed = schema.safeParse(new URL(request.url).searchParams.get("q"));
  if (!parsed.success) return NextResponse.json({ error: "Recherche invalide." }, { status: 400 });
  try {
    const cards = await new TCGdexCatalogProvider().search(parsed.data);
    // Les fiches du catalogue sont quasi statiques : le navigateur et le CDN peuvent les garder.
    return NextResponse.json({ cards }, { headers: { "cache-control": "public, max-age=600, s-maxage=3600, stale-while-revalidate=86400" } });
  } catch {
    return NextResponse.json({ error: "Le catalogue TCGdex est momentanément indisponible." }, { status: 502 });
  }
}
