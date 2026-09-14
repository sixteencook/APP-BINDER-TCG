"use client";
/* eslint-disable @next/next/no-img-element -- les URLs TCGdex sont dynamiques et déjà optimisées en WebP */

import { FormEvent, useEffect, useMemo, useState } from "react";
import { BookOpen, RefreshCw, Search, Trash2 } from "lucide-react";
import type { BinderItem, Card, CardPriceData } from "@/lib/domain/types";
import { calculateBinderTotal, calculateReferencePrice } from "@/lib/domain/valuation";
import { LocalStorageBinderStorage } from "@/lib/storage/binder-storage";

type View = "search" | "binder";
const storage = new LocalStorageBinderStorage();
const money = (value: number | null) => value === null ? "N/A" : new Intl.NumberFormat("fr-FR", { style: "currency", currency: "EUR" }).format(value);
const dateTime = (value: string | null) => value ? new Intl.DateTimeFormat("fr-FR", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)) : "N/A";

async function fetchPrice(card: Card): Promise<CardPriceData> {
  const response = await fetch("/api/prices", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(card) });
  const payload = (await response.json()) as { price?: CardPriceData; error?: string };
  if (!response.ok || !payload.price) throw new Error(payload.error ?? "Prix indisponible.");
  return payload.price;
}

function PriceMetrics({ price }: { price: CardPriceData | null }) {
  const values = [["Lowest FR NM", price?.lowest ?? null], ["Trend", price?.trend ?? null], ["Moyenne 7 jours", price?.avg7 ?? null], ["Moyenne 30 jours", price?.avg30 ?? null]] as const;
  return <dl className="metrics">{values.map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{money(value)}</dd></div>)}</dl>;
}

function CardImage({ card, large = false }: { card: Card; large?: boolean }) {
  const [failed, setFailed] = useState(false);
  return card.image && !failed
    ? <img className={large ? "card-image card-image-large" : "card-image"} src={card.image} alt={`${card.name}, ${card.localId}`} onError={() => setFailed(true)} />
    : <div className={large ? "image-missing card-image-large" : "image-missing"} aria-label="Image indisponible">Image indisponible</div>;
}

export default function Home() {
  const [view, setView] = useState<View>("search");
  const [query, setQuery] = useState("Soporifik 210/198");
  const [results, setResults] = useState<Card[]>([]);
  const [selected, setSelected] = useState<Card | null>(null);
  const [selectedPrice, setSelectedPrice] = useState<CardPriceData | null>(null);
  const [binder, setBinder] = useState<BinderItem[]>([]);
  const [ready, setReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    const frame = requestAnimationFrame(() => { setBinder(storage.load()); setReady(true); });
    return () => cancelAnimationFrame(frame);
  }, []);
  useEffect(() => { if (ready) storage.save(binder); }, [binder, ready]);
  useEffect(() => { if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined); }, []);
  const valuation = useMemo(() => calculateBinderTotal(binder), [binder]);

  async function searchCards(event: FormEvent) {
    event.preventDefault(); setBusy(true); setMessage(null); setSelected(null); setSelectedPrice(null);
    try {
      const response = await fetch(`/api/cards/search?q=${encodeURIComponent(query)}`);
      const payload = (await response.json()) as { cards?: Card[]; error?: string };
      if (!response.ok) throw new Error(payload.error ?? "Recherche impossible.");
      setResults(payload.cards ?? []);
      if (!payload.cards?.length) setMessage("Aucune carte trouvée. Vérifiez le nom et le numéro.");
    } catch (error) { setMessage(error instanceof Error ? error.message : "Recherche impossible."); }
    finally { setBusy(false); }
  }

  async function openCard(card: Card) {
    setSelected(card); setSelectedPrice(null); setMessage(null); setBusy(true);
    try { setSelectedPrice(await fetchPrice(card)); }
    catch (error) { setMessage(error instanceof Error ? error.message : "Prix indisponible."); }
    finally { setBusy(false); }
  }

  function addToBinder() {
    if (!selected) return;
    setBinder((items) => {
      const existing = items.find((item) => item.id === selected.id);
      if (existing) return items.map((item) => item.id === selected.id ? { ...item, quantity: item.quantity + 1 } : item);
      return [...items, { ...selected, language: "FR", condition: "NM", quantity: 1, prices: selectedPrice, referencePrice: calculateReferencePrice(selectedPrice), lastPriceUpdate: selectedPrice?.updatedAt ?? null }];
    });
    setMessage("Carte ajoutée au binder.");
  }

  function updateQuantity(id: string, quantity: number) {
    setBinder((items) => items.map((item) => item.id === id ? { ...item, quantity: Math.max(1, Math.min(99, quantity || 1)) } : item));
  }

  async function refreshOne(id: string) {
    const item = binder.find((candidate) => candidate.id === id); if (!item) return;
    setMessage(null);
    try {
      const price = await fetchPrice(item);
      setBinder((items) => items.map((candidate) => candidate.id === id ? { ...candidate, prices: price, referencePrice: calculateReferencePrice(price), lastPriceUpdate: price.updatedAt } : candidate));
    } catch (error) { setMessage(error instanceof Error ? error.message : "Actualisation impossible."); }
  }

  async function refreshAll() {
    setRefreshing(true); setMessage(null); let failures = 0;
    for (const item of binder) {
      try {
        const price = await fetchPrice(item);
        setBinder((items) => items.map((candidate) => candidate.id === item.id ? { ...candidate, prices: price, referencePrice: calculateReferencePrice(price), lastPriceUpdate: price.updatedAt } : candidate));
      } catch { failures += 1; }
    }
    setRefreshing(false); setMessage(failures ? `${failures} carte(s) n’ont pas pu être actualisée(s).` : "Tous les prix ont été actualisés.");
  }

  return <main className="app-shell">
    <header className="topbar"><div><p className="eyebrow">Pokémon TCG · FR</p><h1>TCG Binder Tracker</h1></div><span className="version">v0.1</span></header>
    <nav className="tabs" aria-label="Navigation principale">
      <button className={view === "search" ? "active" : ""} onClick={() => setView("search")}><Search size={19} /> Recherche</button>
      <button className={view === "binder" ? "active" : ""} onClick={() => setView("binder")}><BookOpen size={19} /> Binder <span className="count">{binder.reduce((n, item) => n + item.quantity, 0)}</span></button>
    </nav>
    {message && <div className="notice" role="status">{message}</div>}
    {view === "search" ? <section>
      <form className="search-form" onSubmit={searchCards}><label htmlFor="card-search">Rechercher une carte française</label><div><input id="card-search" value={query} onChange={(e) => setQuery(e.target.value)} placeholder="Soporifik 210/198" autoComplete="off" /><button disabled={busy}>{busy ? "Recherche…" : "Rechercher"}</button></div><small>Utilisez le nom et le numéro imprimé pour identifier précisément la carte.</small></form>
      {selected ? <article className="detail">
        <button className="back" onClick={() => { setSelected(null); setSelectedPrice(null); setMessage(null); }}>← Retour aux résultats</button>
        <div className="detail-grid"><CardImage card={selected} large /><div><p className="eyebrow">{selected.extension}</p><h2>{selected.name}</h2><p className="card-number">{selected.localId}/{selected.printedTotal ?? "?"}</p>{selected.rarity && <p className="rarity">{selected.rarity}</p>}<h3>Cardmarket — Français 🇫🇷 · Near Mint</h3><PriceMetrics price={selectedPrice} /><div className="estimate"><span>Valeur estimée</span><strong>{money(calculateReferencePrice(selectedPrice))}</strong></div><p className="disclaimer">Estimation indicative, sans garantie de prix de vente. Les moyennes Cardmarket ne sont pas étiquetées FR lorsqu’elles ne sont pas filtrées par langue.</p><button className="primary wide" onClick={addToBinder}>Ajouter au binder</button></div></div>
      </article> : <div className="results">{results.map((card) => <button className="result-card" key={card.id} onClick={() => openCard(card)}><CardImage card={card} /><span><strong>{card.name}</strong><b>{card.localId}/{card.printedTotal ?? "?"}</b><small>{card.extension}</small></span></button>)}</div>}
    </section> : <section className="binder">
      <div className="binder-summary"><p>Valeur estimée du binder</p><strong>{money(valuation.total)}</strong>{valuation.unknownCount > 0 && <span>{valuation.unknownCount} carte(s) sans estimation</span>}<button onClick={refreshAll} disabled={refreshing || !binder.length}><RefreshCw size={18} className={refreshing ? "spin" : ""} />{refreshing ? "Actualisation…" : "Actualiser les prix"}</button></div>
      {!binder.length ? <div className="empty"><BookOpen size={34} /><h2>Votre binder est vide</h2><p>Recherchez une carte puis ajoutez-la ici.</p></div> : <div className="binder-list">{binder.map((item) => <article className="binder-item" key={item.id}><CardImage card={item} /><div className="binder-main"><h2>{item.name}</h2><p>{item.localId}/{item.printedTotal ?? "?"} · {item.extension}</p><span className="pill">FR · NM</span><PriceMetrics price={item.prices} /><p className="updated">Dernière actualisation : {dateTime(item.lastPriceUpdate)}</p></div><div className="binder-actions"><strong>{money(item.referencePrice === null ? null : item.referencePrice * item.quantity)}</strong><label>Quantité<input type="number" min="1" max="99" value={item.quantity} onChange={(e) => updateQuantity(item.id, Number(e.target.value))} /></label><button onClick={() => refreshOne(item.id)}><RefreshCw size={17} /> Prix</button><button className="delete" onClick={() => setBinder((items) => items.filter((candidate) => candidate.id !== item.id))}><Trash2 size={17} /> Supprimer</button></div></article>)}</div>}
    </section>}
  </main>;
}
