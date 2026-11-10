import { NextResponse } from "next/server";
import { TCGdexCatalogProvider } from "@/lib/catalog/tcgdex";

export async function GET() {
  try {
    const sets = await new TCGdexCatalogProvider().listSets();
    return NextResponse.json({ sets }, { headers: { "cache-control": "public, max-age=3600, s-maxage=86400, stale-while-revalidate=604800" } });
  } catch {
    return NextResponse.json({ error: "Le catalogue TCGdex est momentanément indisponible." }, { status: 502 });
  }
}
