"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { Check, ExternalLink, Package, Plus, RefreshCw, Search, Trash2 } from "lucide-react";
import { SEALED_TYPES, cardmarketSearchUrl, defaultSealedName, guessSealedType, sealedTypeLabel } from "@/lib/domain/sealed";
import { newId } from "@/lib/domain/state";
import type { SealedItem, SealedProductHit, SealedStatus, SealedType, SetSummary } from "@/lib/domain/types";
import { calculateSealedTotals } from "@/lib/domain/valuation";
import { dateTime, money, signedMoney } from "@/lib/format";
import { useApp } from "./app-context";
import { MoneyInput, PriceTag, Segmented, Sheet, Stepper } from "./ui";

let setsPromise: Promise<SetSummary[]> | null = null;
function loadSets(): Promise<SetSummary[]> {
  setsPromise ??= fetch("/api/sets")
    .then((response) => (response.ok ? (response.json() as Promise<{ sets: SetSummary[] }>) : Promise.reject(new Error("sets"))))
    .then((payload) => payload.sets)
    .catch(() => {
      setsPromise = null;
      return [];
    });
  return setsPromise;
}

async function fetchProductPrices(ids: number[]): Promise<SealedProductHit[]> {
  const response = await fetch("/api/products/prices", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ids }),
  });
  const payload = (await response.json().catch(() => null)) as { products?: SealedProductHit[]; error?: string } | null;
  if (!response.ok || !payload?.products) throw new Error(payload?.error ?? "La source de prix est injoignable.");
  return payload.products;
}

type Editing = SealedItem | "new" | null;

export function SealedView() {
  const { state, dispatch, toast } = useApp();
  const [status, setStatus] = useState<SealedStatus>("owned");
  const [type, setType] = useState<SealedType | "all">("all");
  const [editing, setEditing] = useState<Editing>(null);
  const [refreshing, setRefreshing] = useState(false);

  const ofStatus = useMemo(() => state.sealed.filter((item) => item.status === status), [state.sealed, status]);
  const visible = useMemo(() => ofStatus.filter((item) => type === "all" || item.type === type), [ofStatus, type]);
  const totals = useMemo(() => calculateSealedTotals(ofStatus), [ofStatus]);
  const presentTypes = useMemo(() => SEALED_TYPES.filter((candidate) => ofStatus.some((item) => item.type === candidate.id)), [ofStatus]);
  const linkedCount = useMemo(() => state.sealed.filter((item) => item.productId !== null).length, [state.sealed]);
  const counts = {
    owned: state.sealed.filter((item) => item.status === "owned").reduce((sum, item) => sum + item.quantity, 0),
    wanted: state.sealed.filter((item) => item.status === "wanted").reduce((sum, item) => sum + item.quantity, 0),
  };

  async function refreshAll() {
    const linked = state.sealed.filter((item) => item.productId !== null);
    if (!linked.length || refreshing) return;
    setRefreshing(true);
    try {
      const hits = await fetchProductPrices(linked.map((item) => item.productId as number));
      const byProduct = new Map(hits.map((hit) => [hit.productId, hit]));
      let updated = 0;
      for (const item of linked) {
        const hit = byProduct.get(item.productId as number);
        if (!hit || hit.price === null) continue;
        dispatch({ type: "sealed/price", id: item.id, value: hit.price, updatedAt: hit.updatedAt });
        updated += 1;
      }
      toast(updated ? `${updated} prix actualisé${updated > 1 ? "s" : ""}.` : "Aucun prix renvoyé par TCGGO.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "La source de prix est injoignable.");
    } finally {
      setRefreshing(false);
    }
  }

  return (
    <section className="view">
      <header className="view-head">
        <div>
          <p className="eyebrow">Produits</p>
          <h1>Scellés</h1>
        </div>
        <div className="head-actions">
          {linkedCount > 0 && (
            <button type="button" className="btn" onClick={refreshAll} disabled={refreshing} aria-busy={refreshing}>
              <RefreshCw size={16} className={refreshing ? "spin" : undefined} /> Actualiser les prix
            </button>
          )}
          <button type="button" className="btn primary" onClick={() => setEditing("new")}>
            <Plus size={17} /> Ajouter
          </button>
        </div>
      </header>

      <Segmented
        label="Statut"
        value={status}
        onChange={(value) => { setStatus(value); setType("all"); }}
        options={[
          { id: "owned", label: `Possédés (${counts.owned})` },
          { id: "wanted", label: `Recherchés (${counts.wanted})` },
        ]}
      />

      {ofStatus.length > 0 && (
        <div className="summary">
          <div>
            <small>{status === "owned" ? "Valeur marché" : "Pour tout acheter"}</small>
            <strong>{money(totals.market)}</strong>
            {totals.unknownCount > 0 && <span className="muted small"> + {totals.unknownCount} sans prix</span>}
          </div>
          {status === "owned" && totals.cost > 0 && (
            <div>
              <small>Coût d’achat</small>
              <strong>{money(totals.cost)}</strong>
            </div>
          )}
          {status === "owned" && totals.profit !== null && (
            <div className={totals.profit >= 0 ? "good" : "bad"}>
              <small>Plus-value</small>
              <strong>{signedMoney(totals.profit)}</strong>
            </div>
          )}
          <div>
            <small>Produits</small>
            <strong>{totals.units}</strong>
          </div>
        </div>
      )}

      {presentTypes.length > 1 && (
        <div className="chips" role="group" aria-label="Filtrer par type">
          <button type="button" className={`chip ${type === "all" ? "on" : ""}`} onClick={() => setType("all")}>Tous</button>
          {presentTypes.map((candidate) => (
            <button key={candidate.id} type="button" className={`chip ${type === candidate.id ? "on" : ""}`} onClick={() => setType(candidate.id)}>
              {candidate.short}
            </button>
          ))}
        </div>
      )}

      {visible.length === 0 ? (
        <div className="empty">
          <Package size={34} />
          <h2>{status === "owned" ? "Aucun produit scellé" : "Aucun produit recherché"}</h2>
          <p>Display, ETB, UPC, coffrets… cherchez-les sur TCGGO pour récupérer l’image et le prix Cardmarket automatiquement.</p>
          <button type="button" className="btn primary" onClick={() => setEditing("new")}>
            <Plus size={17} /> Ajouter un produit
          </button>
        </div>
      ) : (
        <ul className="grid sealed-grid">
          {visible.map((item) => (
            <li key={item.id}>
              <button type="button" className="sealed-tile" onClick={() => setEditing(item)} aria-label={`${item.name}, ×${item.quantity}, ${money(item.marketPrice)}`}>
                <div className="sealed-img">
                  <SealedLogo item={item} />
                  <PriceTag value={item.marketPrice} />
                  {item.quantity > 1 && <span className="qty-badge">×{item.quantity}</span>}
                </div>
                <strong>{item.name}</strong>
                <span className="pill">{sealedTypeLabel(item.type, true)}</span>
              </button>
            </li>
          ))}
        </ul>
      )}

      <Sheet open={editing !== null} onClose={() => setEditing(null)} title={editing === "new" ? "Nouveau produit scellé" : "Produit scellé"}>
        {editing && <SealedForm key={editing === "new" ? "new" : editing.id} editing={editing === "new" ? null : editing} initialStatus={status} onClose={() => setEditing(null)} />}
      </Sheet>
    </section>
  );
}

/* eslint-disable @next/next/no-img-element -- images TCGGO / logos TCGdex dynamiques */
function SealedLogo({ item }: { item: Pick<SealedItem, "image" | "name" | "type"> }) {
  const [failed, setFailed] = useState<string | null>(null);
  if (!item.image || failed === item.image) {
    return (
      <div className="sealed-fallback" aria-hidden>
        <Package size={28} />
        <span>{sealedTypeLabel(item.type, true)}</span>
      </div>
    );
  }
  return <img src={item.image} alt="" loading="lazy" decoding="async" onError={() => setFailed(item.image)} />;
}

/** Recherche de produits scellés sur TCGGO (image + prix Cardmarket). */
function ProductSearch({ onPick }: { onPick: (hit: SealedProductHit) => void }) {
  const [query, setQuery] = useState("");
  const [hits, setHits] = useState<SealedProductHit[] | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const controller = useRef<AbortController | null>(null);

  useEffect(() => () => {
    if (timer.current) clearTimeout(timer.current);
    controller.current?.abort();
  }, []);

  function onChange(value: string) {
    setQuery(value);
    setError(null);
    if (timer.current) clearTimeout(timer.current);
    const trimmed = value.trim();
    if (trimmed.length < 2) {
      setHits(null);
      setBusy(false);
      return;
    }
    setBusy(true);
    timer.current = setTimeout(async () => {
      controller.current?.abort();
      const abort = new AbortController();
      controller.current = abort;
      try {
        const response = await fetch(`/api/products/search?q=${encodeURIComponent(trimmed)}`, { signal: abort.signal });
        const payload = (await response.json().catch(() => null)) as { products?: SealedProductHit[]; error?: string } | null;
        if (!response.ok || !payload?.products) throw new Error(payload?.error ?? "Recherche impossible.");
        setHits(payload.products.slice(0, 20));
      } catch (searchError) {
        if (abort.signal.aborted) return;
        setHits(null);
        setError(searchError instanceof Error ? searchError.message : "Recherche impossible.");
      } finally {
        if (!abort.signal.aborted) setBusy(false);
      }
    }, 450);
  }

  return (
    <div className="field">
      <span>
        <Search size={13} /> Chercher sur TCGGO <i className="muted">· image et prix Cardmarket automatiques</i>
      </span>
      <input
        value={query}
        onChange={(event) => onChange(event.target.value)}
        placeholder="Ex. prismatic evolutions elite trainer box"
        autoComplete="off"
        aria-busy={busy}
      />
      {error && <p className="muted small">{error}</p>}
      {hits && hits.length === 0 && !busy && <p className="muted small">Aucun produit trouvé (essayez le nom anglais).</p>}
      {hits && hits.length > 0 && (
        <ul className="product-hits">
          {hits.map((hit) => (
            <li key={hit.productId}>
              <button type="button" onClick={() => { onPick(hit); setHits(null); setQuery(""); }}>
                {hit.image ? <img src={hit.image} alt="" loading="lazy" decoding="async" /> : <Package size={20} aria-hidden />}
                <span className="hit-text">
                  <strong>{hit.name}</strong>
                  {hit.setName && <small className="muted">{hit.setName}</small>}
                </span>
                <span className="hit-price">
                  {money(hit.price)}
                  {hit.avg7 !== null && hit.avg7 !== hit.price && <small className="muted">moy. 7 j {money(hit.avg7)}</small>}
                </span>
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function SealedForm({ editing, initialStatus, onClose }: { editing: SealedItem | null; initialStatus: SealedStatus; onClose: () => void }) {
  const { dispatch, toast } = useApp();
  const [sets, setSets] = useState<SetSummary[]>([]);
  const [status, setStatus] = useState<SealedStatus>(editing?.status ?? initialStatus);
  const [type, setType] = useState<SealedType>(editing?.type ?? "etb");
  const [setText, setSetText] = useState(editing?.setName ?? "");
  const [customName, setCustomName] = useState<string | null>(editing?.name ?? null);
  const [quantity, setQuantity] = useState(editing?.quantity ?? 1);
  const [purchase, setPurchase] = useState<number | null>(editing?.purchasePrice ?? null);
  const [market, setMarket] = useState<number | null>(editing?.marketPrice ?? null);
  const [note, setNote] = useState(editing?.note ?? "");
  const [productId, setProductId] = useState<number | null>(editing?.productId ?? null);
  const [productImage, setProductImage] = useState<string | null>(editing?.productId ? editing.image : null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    loadSets().then((list) => { if (!cancelled) setSets(list); });
    return () => { cancelled = true; };
  }, []);

  const trimmed = setText.trim();
  const matched = sets.find((candidate) => candidate.name.toLowerCase() === trimmed.toLowerCase());
  const keptOriginal = editing && editing.setName === trimmed ? editing : null;
  const setId = matched?.id ?? keptOriginal?.setId ?? null;
  const image = productImage ?? matched?.logo ?? keptOriginal?.image ?? null;
  const name = (customName ?? defaultSealedName(type, trimmed || null)).trim();

  function pickProduct(hit: SealedProductHit) {
    setProductId(hit.productId);
    setProductImage(hit.image);
    setCustomName(hit.name);
    setType(guessSealedType(hit.name));
    if (hit.setName) setSetText(hit.setName);
    if (hit.price !== null) setMarket(hit.price);
    toast("Produit TCGGO lié : image et prix récupérés.");
  }

  async function refreshOne() {
    if (productId === null || refreshing) return;
    setRefreshing(true);
    try {
      const [hit] = await fetchProductPrices([productId]);
      if (!hit || hit.price === null) throw new Error("Aucun prix renvoyé par TCGGO.");
      setMarket(hit.price);
      if (hit.image) setProductImage(hit.image);
      toast("Prix actualisé — pensez à enregistrer.");
    } catch (error) {
      toast(error instanceof Error ? error.message : "La source de prix est injoignable.");
    } finally {
      setRefreshing(false);
    }
  }

  function save() {
    if (!name) return;
    dispatch({
      type: "sealed/upsert",
      item: {
        id: editing?.id ?? newId(),
        name: name.slice(0, 120),
        type,
        setId,
        setName: trimmed || null,
        image,
        status,
        quantity,
        purchasePrice: status === "owned" ? purchase : null,
        marketPrice: market,
        productId,
        priceUpdatedAt: market !== (editing?.marketPrice ?? null) ? new Date().toISOString() : (editing?.priceUpdatedAt ?? null),
        note,
        addedAt: editing?.addedAt ?? new Date().toISOString(),
      },
    });
    toast(editing ? "Produit mis à jour." : "Produit ajouté.");
    onClose();
  }

  return (
    <div className="form-stack">
      <ProductSearch onPick={pickProduct} />
      <Segmented
        label="Statut"
        value={status}
        onChange={setStatus}
        options={[
          { id: "owned", label: "Je le possède" },
          { id: "wanted", label: "Je le recherche" },
        ]}
      />
      <label className="field">
        <span>Type de produit</span>
        <select value={type} onChange={(event) => setType(event.target.value as SealedType)}>
          {SEALED_TYPES.map((candidate) => (
            <option key={candidate.id} value={candidate.id}>{candidate.label}</option>
          ))}
        </select>
      </label>
      <label className="field">
        <span>Extension {matched && <i className="ok-text">· reconnue</i>}</span>
        <input list="sealed-sets" value={setText} onChange={(event) => setSetText(event.target.value)} placeholder="Tapez pour chercher (ex. Évolutions Prismatiques)" autoComplete="off" />
        <datalist id="sealed-sets">
          {sets.map((candidate) => (
            <option key={candidate.id} value={candidate.name} />
          ))}
        </datalist>
      </label>
      <label className="field">
        <span>Nom affiché</span>
        <input value={customName ?? defaultSealedName(type, trimmed || null)} onChange={(event) => setCustomName(event.target.value)} maxLength={120} />
      </label>
      <div className="row">
        <span className="row-label">Quantité</span>
        <Stepper label="Quantité" value={quantity} onChange={setQuantity} />
      </div>
      <div className="two-cols">
        <MoneyInput label="Prix de marché (unité)" value={market} onCommit={setMarket} />
        {status === "owned" && <MoneyInput label="Prix d’achat (unité)" value={purchase} onCommit={setPurchase} />}
      </div>
      {productId !== null ? (
        <p className="muted small">
          Produit lié à TCGGO (prix Cardmarket).{" "}
          <button type="button" className="link-btn" onClick={refreshOne} disabled={refreshing} aria-busy={refreshing}>
            Actualiser le prix
          </button>
          {editing?.priceUpdatedAt && <> · actualisé le {dateTime(editing.priceUpdatedAt)}</>}
        </p>
      ) : (
        <p className="muted small">
          Prix saisi à la main — cherchez le produit sur TCGGO ci-dessus pour l’actualiser automatiquement.{" "}
          <a href={cardmarketSearchUrl(name || "Pokémon")} target="_blank" rel="noreferrer noopener">
            Chercher sur Cardmarket <ExternalLink size={12} />
          </a>
          {editing?.priceUpdatedAt && <> · prix saisi le {dateTime(editing.priceUpdatedAt)}</>}
        </p>
      )}
      <label className="field">
        <span>Note</span>
        <textarea value={note} onChange={(event) => setNote(event.target.value)} rows={2} maxLength={500} placeholder="Boutique, état de la boîte, scellé d’origine…" />
      </label>

      <div className="actions">
        <button type="button" className="btn primary" disabled={!name} onClick={save}>
          <Check size={17} /> {editing ? "Enregistrer" : "Ajouter"}
        </button>
        {editing && editing.status === "wanted" && (
          <button type="button" className="btn" onClick={() => { dispatch({ type: "sealed/acquire", id: editing.id }); toast("Produit passé dans « Possédés »."); onClose(); }}>
            Je l’ai eu
          </button>
        )}
        {editing &&
          (confirmDelete ? (
            <button type="button" className="btn danger solid" onClick={() => { dispatch({ type: "sealed/remove", id: editing.id }); onClose(); }}>
              <Trash2 size={17} /> Confirmer la suppression
            </button>
          ) : (
            <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={17} /> Supprimer
            </button>
          ))}
      </div>
    </div>
  );
}
