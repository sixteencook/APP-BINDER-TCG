import { NextResponse } from "next/server";
import { TCGGOProductProvider } from "@/lib/pricing/tcggo-products";
import { productErrorResponse } from "../error";

export async function GET(request: Request) {
  const query = new URL(request.url).searchParams.get("q")?.trim() ?? "";
  if (query.length < 2 || query.length > 100)
    return NextResponse.json({ error: "Recherche invalide (2 à 100 caractères)." }, { status: 400 });
  try {
    const products = await new TCGGOProductProvider().search(query);
    return NextResponse.json({ products });
  } catch (error) {
    return productErrorResponse(error, "products/search");
  }
}
