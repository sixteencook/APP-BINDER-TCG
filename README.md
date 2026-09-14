# TCG Binder Tracker v0.1

Prototype PWA mobile-first pour rechercher précisément des cartes Pokémon TCG françaises, consulter des métriques Cardmarket et conserver un binder local avec une valeur estimée.

## Stack

- Next.js 16 / Vinext, React 19 et TypeScript strict
- routes serveur Next pour TCGdex et TCGGO
- CSS mobile-first sans kit visuel obligatoire
- `localStorage` derrière une abstraction `BinderStorage`
- Vitest pour les tests unitaires
- manifest Web App + service worker pour l'installation PWA

## Architecture

```text
app/
  api/cards/search/route.ts    validation + recherche catalogue
  api/prices/route.ts          validation + prix, clé côté serveur
  page.tsx                     interface Recherche / Binder
lib/
  catalog/tcgdex.ts            implémentation CardCatalogProvider
  pricing/tcggo.ts             implémentation CardPriceProvider + cache
  domain/types.ts              Card, CardPriceData, BinderItem, providers
  domain/valuation.ts          prix de référence et total
  storage/binder-storage.ts    abstraction + localStorage
tests/                         calculs et mapping fournisseur
public/                        manifest, service worker et icônes PWA
```

Les providers sont isolés : une future source Pokémon ou One Piece peut implémenter les mêmes interfaces sans réécrire le binder ni la logique de valorisation.

## Sources de données

### Catalogue : TCGdex v2

L'application interroge l'API REST française `https://api.tcgdex.net/v2/fr`. La recherche extrait le nom, le numéro local et le total officiel du set (par exemple `210/198`), puis charge les fiches détaillées pour confirmer l'impression. TCGdex est multilingue, en lecture seule et sans clé pour cet usage.

Documentation : https://tcgdex.dev/fr/rest

### Prix : TCGGO / CardMarket API TCG via RapidAPI

Les routes serveur interrogent l'hôte documenté `cardmarket-api-tcg.p.rapidapi.com`. TCGGO fournit notamment :

- `lowest_near_mint_FR` : seule métrique affichée comme **Lowest FR NM** ;
- `7d_average` et `30d_average` : moyennes Cardmarket globales, non présentées comme françaises ;
- un éventuel champ de tendance uniquement s'il est réellement présent dans la réponse.

La documentation et le playground consultés pour cette v0.1 ne garantissent pas actuellement un champ Cardmarket `trend`. L'interface affiche donc `N/A` quand il est absent. Aucun prix anglais, TCGPlayer ou fallback numérique n'est substitué.

Documentation : https://www.tcggo.com/api-docs/v1/ et https://www.tcggo.com/api-playground

Le service passe par RapidAPI, avec quotas selon le plan souscrit. Respectez ses conditions et limites. L'application ne scrape pas Cardmarket. L'API Cardmarket officielle n'accepte par ailleurs plus de nouvelles demandes d'accès : https://help.cardmarket.com/en/cardmarket-api

## Installation locale

Prérequis : Node.js 22.13+ et pnpm.

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

Ouvrez l'URL locale affichée. Sans clé, le catalogue et le binder fonctionnent, mais les métriques affichent `N/A` avec le message « Source de prix non configurée ».

## Variables d'environnement

```dotenv
TCGGO_API_KEY=
TCGGO_API_HOST=cardmarket-api-tcg.p.rapidapi.com
PRICE_CACHE_TTL_MS=14400000
```

`TCGGO_API_KEY` est une clé RapidAPI obtenue via TCGGO. Elle reste exclusivement côté serveur et n'est jamais incluse dans le JavaScript client. `PRICE_CACHE_TTL_MS` règle le cache mémoire (4 h par défaut).

## Commandes

```bash
pnpm dev       # développement
pnpm test      # tests unitaires
pnpm lint      # ESLint
pnpm build     # build de production
pnpm start     # prévisualisation du Worker compilé
```

## Calcul de la valeur estimée

Pour chaque carte : `trend` fiable récent, sinon moyenne 7 jours, sinon moyenne 30 jours, sinon Lowest FR NM, sinon `null`. Le total additionne `referencePrice × quantité` et exclut les cartes sans estimation. Toutes les métriques brutes restent stockées séparément.

Cette estimation est indicative : ce n'est ni une offre d'achat ni une valeur de revente garantie.

## Parcours v0.1

1. Rechercher par exemple `Soporifik 210/198`.
2. Sélectionner l'impression française confirmée par le numéro et le total du set.
3. Charger les prix TCGGO si la clé est configurée.
4. Ajouter au binder ; langue `FR`, état `NM`, quantité `1`.
5. Modifier la quantité, supprimer ou actualiser une carte.
6. Actualiser toutes les cartes séquentiellement pour éviter une rafale de requêtes.
7. Fermer et rouvrir la PWA : le binder est conservé sur le même appareil.

## Limites connues

- Les moyennes 7/30 jours de TCGGO ne sont pas annoncées comme filtrées FR/NM ; elles restent donc libellées comme moyennes Cardmarket générales.
- La tendance est `N/A` tant que le provider ne livre pas un champ explicitement documenté.
- Le cache est en mémoire du processus serveur ; un redémarrage le vide.
- Le binder est local à un navigateur/appareil et disparaît si les données du site sont effacées.
- Le rapprochement TCGdex ↔ TCGGO interroge d'abord l'identifiant TCG normalisé (`sv01-210` devient `sv1-210`), puis utilise nom + numéro + extension en repli. Un produit absent ou ambigu produit une erreur explicite.
- Hors ligne, le shell PWA peut s'ouvrir, mais recherche et prix nécessitent le réseau.

## Changer de provider de prix

1. Créer une classe implémentant `CardPriceProvider` dans `lib/pricing/`.
2. Mapper explicitement ses champs vers `CardPriceData` (`null` si absent).
3. Remplacer l'instanciation dans `app/api/prices/route.ts`.
4. Ajouter des tests de mapping et documenter les garanties de langue/état.

Pour One Piece, ajouter aussi un `CardCatalogProvider`, rendre `game` extensible dans les types et router vers le provider correspondant. Aucun code One Piece n'est inclus en v0.1.

## Pistes v0.2 (non implémentées)

Scan caméra, reconnaissance automatique, One Piece TCG, plusieurs binders, historique et graphiques de prix, variations 24 h/7 j/30 j, coût d'acquisition, profit/perte, wishlist, export CSV, compte utilisateur, synchronisation cloud, statistiques, estimation de trade, mode boutique et grading.
