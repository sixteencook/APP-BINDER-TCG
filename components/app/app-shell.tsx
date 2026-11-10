"use client";

import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from "react";
import { BookOpen, Heart, Package, Search, Settings } from "lucide-react";
import { emptyState, reduce } from "@/lib/domain/state";
import type { Card } from "@/lib/domain/types";
import { LocalStorageAppStorage } from "@/lib/storage/binder-storage";
import { PRICE_TTL_MS, PriceError, loadPrice } from "@/lib/storage/price-cache";
import { AppContext } from "./app-context";
import type { AppApi, View } from "./app-context";
import { BinderView } from "./binder-view";
import { SealedView } from "./sealed-view";
import { SearchView } from "./search-view";
import { SettingsSheet } from "./settings-sheet";
import { WishlistView } from "./wishlist-view";

const storage = new LocalStorageAppStorage();
const REFRESH_CONCURRENCY = 3;

const NAV: { id: View; label: string; icon: typeof BookOpen }[] = [
  { id: "binder", label: "Binder", icon: BookOpen },
  { id: "search", label: "Recherche", icon: Search },
  { id: "wishlist", label: "Recherchées", icon: Heart },
  { id: "sealed", label: "Scellés", icon: Package },
];

export function AppShell() {
  const [state, dispatch] = useReducer(reduce, undefined, emptyState);
  const [ready, setReady] = useState(false);
  const [view, setView] = useState<View>("binder");
  const [message, setMessage] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const latest = useRef(state);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toastEl = useRef<HTMLDivElement>(null);

  useEffect(() => { latest.current = state; }, [state]);

  // Chargement après l'hydratation pour éviter tout écart serveur/client.
  useEffect(() => {
    const frame = requestAnimationFrame(() => {
      dispatch({ type: "hydrate", state: storage.load() });
      setReady(true);
    });
    return () => cancelAnimationFrame(frame);
  }, []);

  // Sauvegarde différée + vidage immédiat quand la page se cache (fermeture, changement d'app).
  useEffect(() => {
    if (!ready) return;
    const timer = setTimeout(() => storage.save(state), 250);
    return () => clearTimeout(timer);
  }, [state, ready]);
  useEffect(() => {
    if (!ready) return;
    const flush = () => storage.save(latest.current);
    const onHide = () => { if (document.visibilityState === "hidden") flush(); };
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", flush);
    return () => { document.removeEventListener("visibilitychange", onHide); window.removeEventListener("pagehide", flush); };
  }, [ready]);

  useEffect(() => {
    if ("serviceWorker" in navigator) navigator.serviceWorker.register("/sw.js").catch(() => undefined);
  }, []);

  // Le toast passe dans la « top layer » pour rester visible au-dessus des feuilles modales.
  useEffect(() => {
    const element = toastEl.current;
    if (message && element && typeof element.showPopover === "function") {
      try { element.showPopover(); } catch { /* déjà affiché */ }
    }
  }, [message]);

  const toast = useCallback((text: string) => {
    setMessage(text);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setMessage(null), 3200);
  }, []);

  const refreshOne = useCallback(
    async (kind: "collection" | "wishlist", card: Card) => {
      try {
        const price = await loadPrice(card, true);
        dispatch({ type: "price/set", kind, id: card.id, price });
        return true;
      } catch (caught) {
        toast(caught instanceof Error ? caught.message : "Actualisation impossible.");
        return false;
      }
    },
    [toast],
  );

  const refreshAll = useCallback(
    async (kind: "collection" | "wishlist") => {
      const source = kind === "collection" ? latest.current.collection : latest.current.wishlist;
      const stale = source.filter((item) => !item.lastPriceUpdate || Date.now() - Date.parse(item.lastPriceUpdate) > PRICE_TTL_MS);
      if (!stale.length) {
        toast("Tous les prix datent de moins de 4 h.");
        return;
      }
      setRefreshing(true);
      let done = 0;
      let failed = 0;
      let stopped: string | null = null;
      let next = 0;
      const worker = async () => {
        while (!stopped) {
          const card = stale[next++];
          if (!card) return;
          try {
            const price = await loadPrice(card);
            dispatch({ type: "price/set", kind, id: card.id, price });
            done += 1;
          } catch (caught) {
            failed += 1;
            // Limite de quota ou clé absente : inutile d'enchaîner les requêtes.
            if (caught instanceof PriceError && (caught.code === "RATE_LIMITED" || caught.code === "PRICE_NOT_CONFIGURED")) stopped = caught.message;
          }
        }
      };
      await Promise.all(Array.from({ length: Math.min(REFRESH_CONCURRENCY, stale.length) }, worker));
      setRefreshing(false);
      if (stopped) toast(`${stopped} (${done} prix mis à jour).`);
      else toast(failed ? `${done} prix mis à jour, ${failed} indisponible(s).` : `${done} prix mis à jour.`);
    },
    [toast],
  );

  const api = useMemo<AppApi>(
    () => ({ state, dispatch, view, setView, toast, refreshing, refreshOne, refreshAll, openSettings: () => setSettingsOpen(true) }),
    [state, view, toast, refreshing, refreshOne, refreshAll],
  );

  if (!ready) {
    return (
      <div className="boot" role="status" aria-live="polite">
        <BookOpen size={30} />
        <span>Chargement du binder…</span>
      </div>
    );
  }

  return (
    <AppContext.Provider value={api}>
      <div className="shell">
        <nav className="nav" aria-label="Navigation principale">
          <div className="nav-brand" aria-hidden>
            <BookOpen size={22} />
          </div>
          {NAV.map(({ id, label, icon: Icon }) => (
            <button key={id} type="button" className={`nav-btn ${view === id ? "active" : ""}`} aria-current={view === id ? "page" : undefined} onClick={() => setView(id)}>
              <Icon size={21} />
              <span>{label}</span>
              {id === "wishlist" && state.wishlist.length > 0 && <b className="nav-count">{state.wishlist.length}</b>}
            </button>
          ))}
          <button type="button" className="nav-btn nav-settings" onClick={() => setSettingsOpen(true)} aria-label="Réglages">
            <Settings size={21} />
            <span>Réglages</span>
          </button>
        </nav>
        <main className="main">
          {view === "binder" && <BinderView />}
          {view === "search" && <SearchView />}
          {view === "wishlist" && <WishlistView />}
          {view === "sealed" && <SealedView />}
        </main>
        {message && (
          <div ref={toastEl} popover="manual" className="toast" role="status">
            {message}
          </div>
        )}
        <SettingsSheet open={settingsOpen} onClose={() => setSettingsOpen(false)} />
      </div>
    </AppContext.Provider>
  );
}
