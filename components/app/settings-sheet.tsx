"use client";

import { useRef, useState } from "react";
import { Download, Trash2, Upload } from "lucide-react";
import type { AppState } from "@/lib/domain/types";
import { parseBackup, serializeBackup } from "@/lib/storage/binder-storage";
import { clearPriceCache } from "@/lib/storage/price-cache";
import { useApp } from "./app-context";
import { Sheet } from "./ui";

export function SettingsSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { state, dispatch, toast } = useApp();
  const fileInput = useRef<HTMLInputElement>(null);
  const [pending, setPending] = useState<AppState | null>(null);
  const [error, setError] = useState<string | null>(null);

  const close = () => { setPending(null); setError(null); onClose(); };

  function exportBackup() {
    const blob = new Blob([serializeBackup(state)], { type: "application/json" });
    const link = document.createElement("a");
    link.href = URL.createObjectURL(blob);
    link.download = `tcg-binder-${new Date().toISOString().slice(0, 10)}.json`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(link.href), 1000);
  }

  async function chooseFile(file: File | undefined) {
    if (!file) return;
    setError(null);
    try {
      if (file.size > 20 * 1024 * 1024) throw new Error("Fichier trop volumineux.");
      setPending(parseBackup(await file.text()));
    } catch (caught) {
      setPending(null);
      setError(caught instanceof Error ? caught.message : "Import impossible.");
    }
    if (fileInput.current) fileInput.current.value = "";
  }

  return (
    <Sheet open={open} onClose={close} title="Réglages">
      <div className="form-stack">
        <label className="switch-row">
          <span>
            <strong>Afficher les prix sur les cartes</strong>
            <small className="muted">Pastille en bas à droite de chaque carte du binder.</small>
          </span>
          <input type="checkbox" role="switch" checked={state.settings.showPrices} onChange={(event) => dispatch({ type: "settings/prices", value: event.target.checked })} />
        </label>

        <div className="field">
          <span>Sauvegarde</span>
          <p className="muted small">Vos données sont stockées sur cet appareil. Exportez-les régulièrement : vider les données du navigateur les efface.</p>
          <div className="actions">
            <button type="button" className="btn" onClick={exportBackup}>
              <Download size={17} /> Exporter (JSON)
            </button>
            <button type="button" className="btn" onClick={() => fileInput.current?.click()}>
              <Upload size={17} /> Importer
            </button>
            <input ref={fileInput} type="file" accept="application/json,.json" hidden onChange={(event) => void chooseFile(event.target.files?.[0])} />
          </div>
          {error && <p className="notice" role="alert">{error}</p>}
          {pending && (
            <div className="notice" role="alert">
              <p>
                Cette sauvegarde contient {pending.collection.length} carte(s), {pending.wishlist.length} recherchée(s), {pending.sealed.length} produit(s) scellé(s) et {pending.binders.length} binder(s). Elle <b>remplacera</b> vos données actuelles.
              </p>
              <div className="actions">
                <button type="button" className="btn danger solid" onClick={() => { dispatch({ type: "hydrate", state: pending }); toast("Sauvegarde restaurée."); close(); }}>
                  Remplacer mes données
                </button>
                <button type="button" className="btn" onClick={() => setPending(null)}>Annuler</button>
              </div>
            </div>
          )}
        </div>

        <div className="field">
          <span>Prix</span>
          <p className="muted small">Les prix sont mis en cache 4 h sur l’appareil pour économiser le quota de l’API.</p>
          <button type="button" className="btn" onClick={() => { clearPriceCache(); toast("Cache de prix vidé."); }}>
            <Trash2 size={17} /> Vider le cache de prix
          </button>
        </div>

        <p className="muted small">
          Catalogue : TCGdex. Prix : TCGGO / Cardmarket (premier prix FR en Near Mint, moyennes 7 et 30 jours ; pour les autres états, estimation = prix NM × coefficient). Estimations indicatives, sans garantie de prix de vente.
        </p>
      </div>
    </Sheet>
  );
}
