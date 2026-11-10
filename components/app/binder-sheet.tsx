"use client";

import { useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { getActiveBinder, pageCount, perPage } from "@/lib/domain/state";
import { useApp } from "./app-context";
import { Sheet } from "./ui";

/** Gestion des binders : grille, pages, création, renommage, suppression. */
export function BinderSheet({ open, onClose, layouts, total }: { open: boolean; onClose: () => void; layouts: ReadonlyArray<{ cols: number; rows: number }>; total: number }) {
  const { state, dispatch } = useApp();
  const binder = getActiveBinder(state);
  const [name, setName] = useState<string | null>(null);
  const [newName, setNewName] = useState("");
  const [confirmDelete, setConfirmDelete] = useState(false);
  const placed = state.placements.filter((placement) => placement.binderId === binder.id).length;
  const lastPageUsed = state.placements.some((placement) => placement.binderId === binder.id && Math.floor(placement.position / perPage(binder)) === pageCount(state, binder) - 1);

  const close = () => { setName(null); setConfirmDelete(false); onClose(); };

  return (
    <Sheet open={open} onClose={close} title="Mes binders">
      <div className="form-stack">
        {state.binders.length > 1 && (
          <div className="chips" role="group" aria-label="Binder actif">
            {state.binders.map((candidate) => (
              <button key={candidate.id} type="button" className={`chip ${candidate.id === binder.id ? "on" : ""}`} onClick={() => dispatch({ type: "binder/select", id: candidate.id })}>
                {candidate.name}
              </button>
            ))}
          </div>
        )}

        <label className="field">
          <span>Nom du binder</span>
          <input value={name ?? binder.name} maxLength={40} onChange={(event) => setName(event.target.value)} onBlur={() => { if (name !== null) dispatch({ type: "binder/rename", name }); setName(null); }} />
        </label>

        <div className="field">
          <span>Grille par page</span>
          <div className="layout-picker" role="group" aria-label="Grille par page">
            {layouts.map((layout) => {
              const on = layout.cols === binder.cols && layout.rows === binder.rows;
              return (
                <button key={`${layout.cols}x${layout.rows}`} type="button" aria-pressed={on} className={`layout-opt ${on ? "on" : ""}`} onClick={() => dispatch({ type: "binder/layout", cols: layout.cols, rows: layout.rows })}>
                  <i style={{ gridTemplateColumns: `repeat(${layout.cols}, 1fr)` }}>
                    {Array.from({ length: layout.cols * layout.rows }, (_, index) => (
                      <b key={index} />
                    ))}
                  </i>
                  <span>
                    {layout.cols}×{layout.rows}
                  </span>
                </button>
              );
            })}
          </div>
          <small className="muted">Changer la grille garde vos cartes dans le même ordre : elles se répartissent simplement autrement sur les pages. La grille 4×4 en paysage est la plus confortable sur téléphone.</small>
        </div>

        <p className="muted small">
          {placed} carte(s) placée(s) · {total} page(s)
        </p>
        <div className="actions">
          <button type="button" className="btn" onClick={() => dispatch({ type: "binder/add-page" })}>
            <Plus size={17} /> Ajouter une page
          </button>
          <button type="button" className="btn" disabled={total <= 1 || lastPageUsed} onClick={() => dispatch({ type: "binder/remove-page" })}>
            Supprimer la dernière page (vide)
          </button>
        </div>

        <form
          className="inline-form"
          onSubmit={(event) => {
            event.preventDefault();
            dispatch({ type: "binder/create", name: newName });
            setNewName("");
          }}
        >
          <input value={newName} onChange={(event) => setNewName(event.target.value)} placeholder="Nouveau binder (ex. Dracaufeu)" maxLength={40} aria-label="Nom du nouveau binder" />
          <button className="btn primary" type="submit">
            <Plus size={17} /> Créer
          </button>
        </form>

        {state.binders.length > 1 &&
          (confirmDelete ? (
            <button type="button" className="btn danger solid" onClick={() => { dispatch({ type: "binder/delete" }); setConfirmDelete(false); }}>
              <Trash2 size={17} /> Confirmer : les cartes retournent dans « à placer »
            </button>
          ) : (
            <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
              <Trash2 size={17} /> Supprimer ce binder
            </button>
          ))}
      </div>
    </Sheet>
  );
}
