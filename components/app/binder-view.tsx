"use client";

import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import type { DragEvent } from "react";
import { ChevronLeft, ChevronRight, Info, Layers, Search, Settings2, Wand2, X } from "lucide-react";
import { LAYOUTS, binderGeometry, compareCards, placedValueFor } from "@/lib/domain/state";
import type { BinderItem } from "@/lib/domain/types";
import { money } from "@/lib/format";
import { BinderSheet } from "./binder-sheet";
import { CardSheet } from "./card-sheet";
import { useApp } from "./app-context";
import { CardImage, PriceTag } from "./ui";

interface SlotProps {
  position: number;
  item: BinderItem | undefined;
  placing: boolean;
  showPrice: boolean;
  onTap: (position: number) => void;
  onDropData: (position: number, data: string) => void;
}

const Slot = memo(function Slot({ position, item, placing, showPrice, onTap, onDropData }: SlotProps) {
  const [over, setOver] = useState(false);
  const label = item ? `${item.name} ${item.localId}, emplacement ${position + 1}` : `Emplacement ${position + 1} vide`;
  return (
    <button
      type="button"
      className={`slot ${item ? "is-filled" : "is-empty"} ${placing && !item ? "is-target" : ""} ${over ? "is-over" : ""}`}
      aria-label={label}
      draggable={!!item}
      onClick={() => onTap(position)}
      onDragStart={(event: DragEvent) => {
        event.dataTransfer.setData("text/plain", `slot:${position}`);
        event.dataTransfer.effectAllowed = "move";
      }}
      onDragOver={(event) => { event.preventDefault(); event.dataTransfer.dropEffect = "move"; if (!over) setOver(true); }}
      onDragLeave={() => setOver(false)}
      onDrop={(event) => {
        event.preventDefault();
        setOver(false);
        onDropData(position, event.dataTransfer.getData("text/plain"));
      }}
    >
      {item ? (
        <>
          <CardImage card={item} />
          {showPrice && <PriceTag value={item.referencePrice} />}
        </>
      ) : (
        <span className="slot-num">{position + 1}</span>
      )}
    </button>
  );
});

export function BinderView() {
  const { state, dispatch, toast, setView, refreshAll, refreshing } = useApp();
  const { binderId, name: binderName, cols, rows, size, total } = binderGeometry(state);
  const [page, setPage] = useState(0);
  const current = Math.min(page, total - 1);

  const [armedId, setArmedId] = useState<string | null>(null);
  const [filter, setFilter] = useState("");
  const [openItemId, setOpenItemId] = useState<string | null>(null);
  const [openPosition, setOpenPosition] = useState<number | null>(null);
  const [binderSheet, setBinderSheet] = useState(false);

  const items = useMemo(() => new Map(state.collection.map((item) => [item.id, item])), [state.collection]);
  const slots = useMemo(() => {
    const map = new Map<number, string>();
    for (const placement of state.placements) if (placement.binderId === binderId) map.set(placement.position, placement.cardId);
    return map;
  }, [state.placements, binderId]);
  const placedByCard = useMemo(() => {
    const map = new Map<string, number>();
    for (const placement of state.placements) map.set(placement.cardId, (map.get(placement.cardId) ?? 0) + 1);
    return map;
  }, [state.placements]);

  const stock = useMemo(() => {
    const needle = filter.trim().toLowerCase();
    return state.collection
      .filter((item) => item.quantity - (placedByCard.get(item.id) ?? 0) > 0)
      .filter((item) => !needle || `${item.name} ${item.localId} ${item.extension}`.toLowerCase().includes(needle))
      .sort(compareCards);
  }, [state.collection, placedByCard, filter]);
  const stockCount = useMemo(
    () => state.collection.reduce((sum, item) => sum + Math.max(0, item.quantity - (placedByCard.get(item.id) ?? 0)), 0),
    [state.collection, placedByCard],
  );

  const armedLeft = armedId ? (items.get(armedId)?.quantity ?? 0) - (placedByCard.get(armedId) ?? 0) : 0;
  const armed = armedId && armedLeft > 0 ? (items.get(armedId) ?? null) : null;

  const goTo = useCallback((next: number) => setPage(Math.max(0, Math.min(total - 1, next))), [total]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null;
      if (target && (target.tagName === "INPUT" || target.tagName === "SELECT" || target.tagName === "TEXTAREA")) return;
      if (document.querySelector("dialog[open]")) return;
      if (event.key === "ArrowLeft") goTo(current - 1);
      if (event.key === "ArrowRight") goTo(current + 1);
      if (event.key === "Escape") setArmedId(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [current, goTo]);

  const onTap = useCallback(
    (position: number) => {
      const occupant = slots.get(position);
      if (armed) {
        dispatch({ type: "binder/place", position, cardId: armed.id });
        const remaining = occupant === armed.id ? armedLeft : armedLeft - 1;
        if (remaining <= 0) setArmedId(null);
      } else if (occupant) {
        setOpenItemId(occupant);
        setOpenPosition(position);
      } else if (stockCount > 0) {
        toast("Touchez une carte dans la barre latérale, puis un emplacement.");
      } else {
        toast("Aucune carte à placer : ajoutez-en depuis la recherche.");
      }
    },
    [armed, armedLeft, dispatch, slots, stockCount, toast],
  );

  const onDropData = useCallback(
    (position: number, data: string) => {
      const [kind, value] = data.split(":");
      if (kind === "card" && value) dispatch({ type: "binder/place", position, cardId: value });
      if (kind === "slot" && value !== undefined && Number.isInteger(Number(value))) dispatch({ type: "binder/move", from: Number(value), to: position });
    },
    [dispatch],
  );

  // Balayage horizontal pour tourner les pages (sans gêner les appuis sur les emplacements).
  const swipe = useRef<{ x: number; y: number } | null>(null);

  const pageStart = current * size;
  const pageValue = placedValueFor(state, binderId, size, current);
  const binderValue = placedValueFor(state, binderId, size);
  const filledOnPage = Array.from({ length: size }, (_, i) => slots.has(pageStart + i)).filter(Boolean).length;
  const emptyStock = state.collection.length === 0;

  return (
    <section className="binder-view" style={{ "--cols": cols, "--rows": rows } as React.CSSProperties}>
      <header className="binder-bar">
        <button type="button" className="binder-name" onClick={() => setBinderSheet(true)} aria-label="Gérer les binders">
          <Layers size={17} />
          <span>{binderName}</span>
          <small>
            {cols}×{rows}
          </small>
        </button>
        <div className="pager" role="group" aria-label="Pages">
          <button type="button" className="icon-btn" onClick={() => goTo(current - 1)} disabled={current === 0} aria-label="Page précédente">
            <ChevronLeft size={20} />
          </button>
          <span className="pager-count">
            Page {current + 1}/{total}
          </span>
          <button type="button" className="icon-btn" onClick={() => goTo(current + 1)} disabled={current >= total - 1} aria-label="Page suivante">
            <ChevronRight size={20} />
          </button>
        </div>
        <div className="bar-values" aria-live="polite">
          <span>
            <small>Page</small> {money(pageValue)}
          </span>
          <span>
            <small>Binder</small> <b>{money(binderValue)}</b>
          </span>
        </div>
        <div className="bar-actions">
          <button type="button" className="icon-btn" disabled={stockCount === 0} onClick={() => { dispatch({ type: "binder/autofill" }); toast("Cartes rangées par extension et numéro."); }} aria-label="Remplir automatiquement" title="Remplir automatiquement">
            <Wand2 size={19} />
          </button>
          <button type="button" className="icon-btn" disabled={refreshing || state.collection.length === 0} onClick={() => refreshAll("collection")} aria-label="Actualiser les prix" title="Actualiser les prix">
            <span className={refreshing ? "spin" : ""}>↻</span>
          </button>
          <button type="button" className="icon-btn" onClick={() => setBinderSheet(true)} aria-label="Réglages du binder" title="Réglages du binder">
            <Settings2 size={19} />
          </button>
        </div>
      </header>

      {armed && (
        <div className="place-banner" role="status">
          <CardImage card={armed} className="mini" />
          <span>
            <b>{armed.name}</b> ×{armedLeft} — touchez un emplacement
          </span>
          <button type="button" className="icon-btn" onClick={() => setArmedId(null)} aria-label="Annuler le placement">
            <X size={18} />
          </button>
        </div>
      )}

      <div className="binder-body">
        <aside className="stock" aria-label="Cartes à placer">
          <div className="stock-head">
            <strong>À placer</strong>
            <span className="count-pill">{stockCount}</span>
            <label className="stock-filter">
              <Search size={14} />
              <input value={filter} onChange={(event) => setFilter(event.target.value)} placeholder="Filtrer" aria-label="Filtrer les cartes à placer" />
            </label>
          </div>
          {stock.length === 0 ? (
            <div className="stock-empty">
              {emptyStock ? (
                <>
                  <p>Votre collection est vide.</p>
                  <button type="button" className="btn primary" onClick={() => setView("search")}>
                    <Search size={16} /> Rechercher une carte
                  </button>
                </>
              ) : filter ? (
                <p>Aucune carte ne correspond.</p>
              ) : (
                <p>Tout est rangé 🎉</p>
              )}
            </div>
          ) : (
            <ul className="stock-list">
              {stock.map((item) => {
                const left = item.quantity - (placedByCard.get(item.id) ?? 0);
                return (
                  <li key={item.id} className={`stock-card ${armed?.id === item.id ? "armed" : ""}`}>
                    <button
                      type="button"
                      className="stock-btn"
                      aria-pressed={armed?.id === item.id}
                      aria-label={`${item.name} ${item.localId}, ${left} à placer`}
                      draggable
                      onDragStart={(event) => { event.dataTransfer.setData("text/plain", `card:${item.id}`); event.dataTransfer.effectAllowed = "move"; }}
                      onClick={() => setArmedId((id) => (id === item.id ? null : item.id))}
                    >
                      <CardImage card={item} />
                      <PriceTag value={item.referencePrice} />
                      {left > 1 && <span className="qty-badge">×{left}</span>}
                    </button>
                    <button type="button" className="info-btn" aria-label={`Détails de ${item.name}`} onClick={() => { setOpenItemId(item.id); setOpenPosition(null); }}>
                      <Info size={14} />
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        <div
          className="page-wrap"
          onTouchStart={(event) => { const t = event.touches[0]; swipe.current = { x: t.clientX, y: t.clientY }; }}
          onTouchEnd={(event) => {
            const start = swipe.current;
            swipe.current = null;
            if (!start) return;
            const t = event.changedTouches[0];
            const dx = t.clientX - start.x;
            if (Math.abs(dx) > 70 && Math.abs(t.clientY - start.y) < 50) goTo(current + (dx < 0 ? 1 : -1));
          }}
        >
          <div className="page" aria-label={`Page ${current + 1}`}>
            {Array.from({ length: size }, (_, index) => {
              const position = pageStart + index;
              const cardId = slots.get(position);
              return <Slot key={position} position={position} item={cardId ? items.get(cardId) : undefined} placing={!!armed} showPrice={state.settings.showPrices} onTap={onTap} onDropData={onDropData} />;
            })}
          </div>
          <p className="page-foot">
            {filledOnPage}/{size} emplacements
          </p>
        </div>
      </div>

      <p className="rotate-hint">Astuce : tournez le téléphone en paysage pour voir le binder en grand.</p>

      <CardSheet
        item={openItemId ? (items.get(openItemId) ?? null) : null}
        position={openPosition}
        onClose={() => { setOpenItemId(null); setOpenPosition(null); }}
        onMove={(cardId) => setArmedId(cardId)}
      />
      <BinderSheet open={binderSheet} onClose={() => setBinderSheet(false)} layouts={LAYOUTS} total={total} />
    </section>
  );
}
