"use client";

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import { BookOpen, Heart, Library, Search } from "lucide-react";
import type { Card, CardCondition, CardPriceData } from "@/lib/domain/types";
import { loadPrice } from "@/lib/storage/price-cache";
import { useApp } from "./app-context";
import { CardImage, ConditionPicker, PriceMetrics, Sheet } from "./ui";

const RECENT_KEY = "tcg-binder-tracker:v2:recent-searches";

function readRecent(): string[] {
  try {
    const parsed: unknown = JSON.parse(window.localStorage.getItem(RECENT_KEY) ?? "[]");
    return Array.isArray(parsed) ? parsed.filter((value): value is string => typeof value === "string").slice(0, 8) : [];
  } catch {
    return [];
  }
}

export function SearchView() {
  const { state } = useApp();
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Card[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [selected, setSelected] = useState<Card | null>(null);
  const [recent, setRecent] = useState<string[]>([]);
  const abort = useRef<AbortController | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => setRecent(readRecent()));
    return () => cancelAnimationFrame(frame);
  }, []);

  async function run(text: string) {
    const q = text.trim();
    if (q.length < 2) return;
    abort.current?.abort();
    const controller = new AbortController();
    abort.current = controller;
    setBusy(true);
    setError(null);
    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(q)}`, { signal: controller.signal });
      const payload = (await response.json()) as { cards?: Card[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Recherche impossible.");
      setResults(payload.cards ?? []);
      const next = [q, ...readRecent().filter((value) => value.toLowerCase() !== q.toLowerCase())].slice(0, 8);
      setRecent(next);
      try { window.localStorage.setItem(RECENT_KEY, JSON.stringify(next)); } catch { /* optionnel */ }
    } catch (caught) {
      if (controller.signal.aborted) return;
      setResults(null);
      setError(caught instanceof Error ? caught.message : "Recherche impossible.");
    } finally {
      if (abort.current === controller) setBusy(false);
    }
  }

  const submit = (event: FormEvent) => { event.preventDefault(); void run(query); };
  const owned = new Map(state.collection.map((item) => [item.id, item.quantity]));
  const wished = new Set(state.wishlist.map((item) => item.id));

  return (
    <section className="view search-view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Catalogue français</p>
          <h1>Recherche</h1>
        </div>
      </header>
      <form className="search-form" onSubmit={submit}>
        <label htmlFor="card-search" className="sr-only">Rechercher une carte</label>
        <input id="card-search" type="search" value={query} onChange={(event) => setQuery(event.target.value)} placeholder="Nom + numéro, ex. Soporifik 210/198" autoComplete="off" enterKeyHint="search" />
        <button className="btn primary" disabled={busy || query.trim().length < 2}>
          <Search size={17} /> {busy ? "Recherche…" : "Rechercher"}
        </button>
      </form>
      <p className="muted small">Le numéro imprimé (ex. 210/198) permet d’identifier l’impression exacte.</p>

      {recent.length > 0 && results === null && !busy && (
        <div className="chips" aria-label="Recherches récentes">
          {recent.map((value) => (
            <button key={value} type="button" className="chip" onClick={() => { setQuery(value); void run(value); }}>
              {value}
            </button>
          ))}
        </div>
      )}

      {error && <div className="notice" role="alert">{error}</div>}
      {results && results.length === 0 && <div className="notice" role="status">Aucune carte trouvée. Vérifiez le nom et le numéro.</div>}

      <ul className="grid results-grid">
        {busy && !results && Array.from({ length: 6 }, (_, index) => <li key={index} className="skeleton tile-skeleton" aria-hidden />)}
        {results?.map((card) => (
          <li key={card.id}>
            <button type="button" className="result-tile" onClick={() => setSelected(card)}>
              <div className="tile-img">
                <CardImage card={card} />
                {owned.has(card.id) && <span className="badge ok"><Library size={12} /> ×{owned.get(card.id)}</span>}
                {wished.has(card.id) && <span className="badge wish"><Heart size={12} /></span>}
              </div>
              <strong>{card.name}</strong>
              <span className="muted small">
                {card.localId}/{card.printedTotal ?? "?"} · {card.extension}
              </span>
            </button>
          </li>
        ))}
      </ul>

      {selected && <CardDetailSheet key={selected.id} card={selected} onClose={() => setSelected(null)} />}
    </section>
  );
}

function CardDetailSheet({ card, onClose }: { card: Card; onClose: () => void }) {
  const { state, dispatch, toast, setView } = useApp();
  const [price, setPrice] = useState<CardPriceData | null>(null);
  const [loading, setLoading] = useState(true);
  const [problem, setProblem] = useState<string | null>(null);
  const [condition, setCondition] = useState<CardCondition>("NM");

  useEffect(() => {
    let cancelled = false;
    const controller = new AbortController();
    (async () => {
      try {
        const value = await loadPrice(card, false, controller.signal);
        if (!cancelled) setPrice(value);
      } catch (caught) {
        if (!cancelled) setProblem(caught instanceof Error ? caught.message : "Prix indisponible.");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; controller.abort(); };
  }, [card]);

  const ownedQty = state.collection.find((item) => item.id === card.id)?.quantity ?? 0;
  const wished = state.wishlist.some((item) => item.id === card.id);

  return (
    <Sheet open onClose={onClose} title={card.name}>
      <div className="detail-layout">
        <CardImage card={card} size="full" className="detail-img" fallbackImage={price?.fallbackImage} />
        <div className="detail-info">
          <p className="eyebrow">{card.extension}</p>
          <p className="detail-number">
            {card.localId}/{card.printedTotal ?? "?"}
            {card.rarity && <span className="rarity"> · {card.rarity}</span>}
          </p>
          <h3 className="sub">Cardmarket — Français · prix Near Mint</h3>
          {loading ? <div className="skeleton metrics-skeleton" aria-busy /> : <PriceMetrics price={price} condition={condition} />}
          <ConditionPicker value={condition} onChange={setCondition} />
          {problem && <p className="notice small" role="status">{problem}</p>}
          <p className="muted small">Estimation indicative, sans garantie de prix de vente.</p>
          {ownedQty > 0 && <p className="ok-text">Déjà dans votre collection : ×{ownedQty}</p>}

          <div className="actions">
            <button type="button" className="btn primary" onClick={() => { dispatch({ type: "collection/add", card, price, place: true, condition }); toast("Carte ajoutée et placée dans le binder."); onClose(); setView("binder"); }}>
              <BookOpen size={17} /> Ajouter au binder
            </button>
            <button type="button" className="btn" onClick={() => { dispatch({ type: "collection/add", card, price, condition }); toast("Carte ajoutée à « à placer »."); onClose(); }}>
              <Library size={17} /> Ajouter sans placer
            </button>
            <button type="button" className="btn" disabled={wished || ownedQty > 0} onClick={() => { dispatch({ type: "wish/add", card, price }); toast("Ajoutée aux cartes recherchées."); onClose(); }}>
              <Heart size={17} /> {wished ? "Déjà recherchée" : "Je la recherche"}
            </button>
          </div>
        </div>
      </div>
    </Sheet>
  );
}
