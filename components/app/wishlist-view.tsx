"use client";

import { useMemo, useState } from "react";
import { Check, Heart, RefreshCw, Search, Target, Trash2 } from "lucide-react";
import type { WishItem } from "@/lib/domain/types";
import { compareCards } from "@/lib/domain/state";
import { calculateWishlistTotal, isTargetReached } from "@/lib/domain/valuation";
import { dateTime, money } from "@/lib/format";
import { useApp } from "./app-context";
import { CardImage, MoneyInput, PriceMetrics, PriceTag, Sheet } from "./ui";

type Sort = "recent" | "price-desc" | "price-asc" | "set";

export function WishlistView() {
  const { state, dispatch, toast, setView, refreshAll, refreshOne, refreshing } = useApp();
  const [sort, setSort] = useState<Sort>("recent");
  const [openId, setOpenId] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const totals = useMemo(() => calculateWishlistTotal(state.wishlist), [state.wishlist]);
  const sorted = useMemo(() => {
    const list = [...state.wishlist];
    if (sort === "price-desc") list.sort((a, b) => (b.referencePrice ?? -1) - (a.referencePrice ?? -1));
    else if (sort === "price-asc") list.sort((a, b) => (a.referencePrice ?? Infinity) - (b.referencePrice ?? Infinity));
    else if (sort === "set") list.sort(compareCards);
    else list.sort((a, b) => b.addedAt.localeCompare(a.addedAt));
    return list;
  }, [state.wishlist, sort]);
  const open: WishItem | null = openId ? (state.wishlist.find((item) => item.id === openId) ?? null) : null;

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Cartes</p>
          <h1>Recherchées</h1>
        </div>
        <div className="head-actions">
          <button type="button" className="btn" onClick={() => refreshAll("wishlist")} disabled={refreshing || !state.wishlist.length}>
            <RefreshCw size={17} className={refreshing ? "spin" : ""} /> Prix
          </button>
          <button type="button" className="btn primary" onClick={() => setView("search")}>
            <Search size={17} /> Ajouter
          </button>
        </div>
      </header>

      {state.wishlist.length === 0 ? (
        <div className="empty">
          <Heart size={34} />
          <h2>Aucune carte recherchée</h2>
          <p>Depuis la recherche, touchez « Je la recherche » pour suivre son prix ici.</p>
          <button type="button" className="btn primary" onClick={() => setView("search")}>
            <Search size={17} /> Chercher une carte
          </button>
        </div>
      ) : (
        <>
          <div className="summary">
            <div>
              <small>Pour tout acheter</small>
              <strong>{money(totals.total)}</strong>
              {totals.unknownCount > 0 && <span className="muted small"> + {totals.unknownCount} sans prix</span>}
            </div>
            <div>
              <small>Cartes</small>
              <strong>{state.wishlist.length}</strong>
            </div>
            {totals.targetReached > 0 && (
              <div className="good">
                <small>Objectifs atteints</small>
                <strong>{totals.targetReached}</strong>
              </div>
            )}
            <label className="sort">
              <span className="sr-only">Trier par</span>
              <select value={sort} onChange={(event) => setSort(event.target.value as Sort)}>
                <option value="recent">Plus récentes</option>
                <option value="price-desc">Prix décroissant</option>
                <option value="price-asc">Prix croissant</option>
                <option value="set">Extension / numéro</option>
              </select>
            </label>
          </div>

          <ul className="grid wish-grid">
            {sorted.map((item) => (
              <li key={item.id}>
                <button type="button" className="wish-tile" onClick={() => setOpenId(item.id)} aria-label={`${item.name} ${item.localId}, ${money(item.referencePrice)}`}>
                  <div className="tile-img">
                    <CardImage card={item} />
                    <PriceTag value={item.referencePrice} tone={isTargetReached(item) ? "good" : "default"} />
                    {isTargetReached(item) && <span className="badge ok"><Target size={12} /> Objectif</span>}
                  </div>
                  <strong>{item.name}</strong>
                  <span className="muted small">
                    {item.localId}/{item.printedTotal ?? "?"} · {item.extension}
                  </span>
                  {item.targetPrice !== null && <span className="muted small">Objectif ≤ {money(item.targetPrice)}</span>}
                </button>
              </li>
            ))}
          </ul>
        </>
      )}

      <Sheet open={open !== null} onClose={() => setOpenId(null)} title={open?.name ?? "Carte recherchée"}>
        {open && (
          <div className="detail-layout">
            <CardImage card={open} size="full" className="detail-img" />
            <div className="detail-info">
              <p className="eyebrow">{open.extension}</p>
              <p className="detail-number">
                {open.localId}/{open.printedTotal ?? "?"}
                {open.rarity && <span className="rarity"> · {open.rarity}</span>}
              </p>
              <PriceMetrics price={open.prices} />
              <p className="muted small">Cardmarket · FR · Near Mint — actualisé {dateTime(open.lastPriceUpdate)}</p>
              <MoneyInput label="Prix cible (je l’achète en dessous)" value={open.targetPrice} onCommit={(value) => dispatch({ type: "wish/target", id: open.id, value })} />
              {isTargetReached(open) && <p className="ok-text">Objectif atteint : le prix de référence est sous votre cible.</p>}
              <div className="actions">
                <button type="button" className="btn primary" onClick={() => { dispatch({ type: "wish/acquire", id: open.id }); toast("Carte ajoutée à votre collection."); setOpenId(null); }}>
                  <Check size={17} /> Je l’ai eue
                </button>
                <button type="button" className="btn" disabled={busy} onClick={async () => { setBusy(true); await refreshOne("wishlist", open); setBusy(false); }}>
                  <RefreshCw size={17} className={busy ? "spin" : ""} /> Actualiser le prix
                </button>
                <button type="button" className="btn danger" onClick={() => { dispatch({ type: "wish/remove", id: open.id }); setOpenId(null); }}>
                  <Trash2 size={17} /> Retirer
                </button>
              </div>
            </div>
          </div>
        )}
      </Sheet>
    </section>
  );
}
