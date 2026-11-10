import { NextResponse } from "next/server";
import { z } from "zod";
import { TCGGOProductProvider } from "@/lib/pricing/tcggo-products";
import { productErrorResponse } from "../error";

const schema = z.object({ ids: z.array(z.number().int().positive()).min(1).max(100) });

export async function POST(request: Request) {
  const parsed = schema.safeParse(await request.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "Identifiants invalides." }, { status: 400 });
  try {
    const products = await new TCGGOProductProvider().prices(parsed.data.ids);
    return NextResponse.json({ products });
  } catch (error) {
    return productErrorResponse(error, "products/prices");
  }
}
