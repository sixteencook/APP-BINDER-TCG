import type { Card } from "@/lib/domain/types";
import { thumbnail } from "@/lib/format";

/** CDN Pokémon TCG construit depuis l'identifiant d'extension (dernier recours pour les cartes sans image TCGdex). */
export function pokemonTcgImageFallback(card: Pick<Card, "extensionId" | "localId">): string {
  const setId = card.extensionId
    .toLowerCase()
    .replace(/^sv0+(\d+)/, "sv$1")
    .replace(/\.(\d+)/g, "pt$1");
  return `https://images.pokemontcg.io/${encodeURIComponent(setId)}/${encodeURIComponent(card.localId)}_hires.png`;
}

/** Sources d'image dans l'ordre : TCGdex, image du fournisseur de prix, CDN Pokémon TCG. */
export function imageSources(card: Pick<Card, "image" | "extensionId" | "localId">, size: "thumb" | "full", fallbackImage?: string | null): string[] {
  const primary = size === "thumb" ? thumbnail(card.image) : card.image;
  return [...new Set([primary, fallbackImage, pokemonTcgImageFallback(card)].filter((source): source is string => Boolean(source)))];
}
