"use client";

import { useEffect, useRef, useState } from "react";
import type { ReactNode } from "react";
import { Minus, Plus, X } from "lucide-react";
import type { Card, CardPriceData } from "@/lib/domain/types";
import { calculateReferencePrice } from "@/lib/domain/valuation";
import { money, moneyTag, thumbnail } from "@/lib/format";

/* eslint-disable @next/next/no-img-element -- images TCGdex dynamiques, déjà en WebP */
export function CardImage({ card, size = "thumb", className = "" }: { card: Pick<Card, "name" | "localId" | "image">; size?: "thumb" | "full"; className?: string }) {
  const src = size === "thumb" ? thumbnail(card.image) : card.image;
  const [failedSrc, setFailedSrc] = useState<string | null>(null);
  if (!src || failedSrc === src) {
    return (
      <div className={`img-missing ${className}`} role="img" aria-label={`${card.name}, image indisponible`}>
        <span>{card.name}</span>
        <small>{card.localId}</small>
      </div>
    );
  }
  return (
    <img
      className={`card-img ${className}`}
      src={src}
      alt={`${card.name} ${card.localId}`}
      loading="lazy"
      decoding="async"
      draggable={false}
      onError={() => setFailedSrc(src)}
    />
  );
}

export function PriceTag({ value, tone = "default", title }: { value: number | null | undefined; tone?: "default" | "good"; title?: string }) {
  return (
    <span className={`price-tag ${tone === "good" ? "price-good" : ""}`} title={title}>
      {moneyTag(value)}
    </span>
  );
}

export function PriceMetrics({ price }: { price: CardPriceData | null }) {
  const rows: [string, number | null][] = [
    ["Lowest FR NM", price?.lowest ?? null],
    ["Trend", price?.trend ?? null],
    ["Moyenne 7 jours", price?.avg7 ?? null],
    ["Moyenne 30 jours", price?.avg30 ?? null],
  ];
  return (
    <dl className="metrics">
      {rows.map(([label, value]) => (
        <div key={label}>
          <dt>{label}</dt>
          <dd>{money(value)}</dd>
        </div>
      ))}
      <div className="metrics-estimate">
        <dt>Valeur estimée</dt>
        <dd>{money(calculateReferencePrice(price))}</dd>
      </div>
    </dl>
  );
}

export function Stepper({ value, onChange, min = 1, max = 99, label }: { value: number; onChange: (value: number) => void; min?: number; max?: number; label: string }) {
  return (
    <div className="stepper" role="group" aria-label={label}>
      <button type="button" onClick={() => onChange(Math.max(min, value - 1))} disabled={value <= min} aria-label="Moins">
        <Minus size={16} />
      </button>
      <output aria-live="polite">{value}</output>
      <button type="button" onClick={() => onChange(Math.min(max, value + 1))} disabled={value >= max} aria-label="Plus">
        <Plus size={16} />
      </button>
    </div>
  );
}

export function Segmented<T extends string>({ value, options, onChange, label }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (value: T) => void; label: string }) {
  return (
    <div className="segmented" role="group" aria-label={label}>
      {options.map((option) => (
        <button key={option.id} type="button" aria-pressed={value === option.id} className={value === option.id ? "on" : ""} onClick={() => onChange(option.id)}>
          {option.label}
        </button>
      ))}
    </div>
  );
}

/** Feuille modale basée sur <dialog> : focus, Échap et fond cliquable gérés par le navigateur. */
export function Sheet({ open, onClose, title, children }: { open: boolean; onClose: () => void; title: string; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    if (!dialog) return;
    if (open && !dialog.open) dialog.showModal();
    if (!open && dialog.open) dialog.close();
  }, [open]);
  return (
    <dialog ref={ref} className="sheet" aria-label={title} onClose={onClose} onClick={(event) => { if (event.target === ref.current) onClose(); }}>
      {open && (
        <div className="sheet-body">
          <header className="sheet-head">
            <h2>{title}</h2>
            <button type="button" className="icon-btn" onClick={onClose} aria-label="Fermer">
              <X size={20} />
            </button>
          </header>
          {children}
        </div>
      )}
    </dialog>
  );
}

/** Champ prix en euros : la valeur est transmise à chaque frappe (vide = non renseigné). */
export function MoneyInput({ value, onCommit, label, placeholder = "—" }: { value: number | null; onCommit: (value: number | null) => void; label: string; placeholder?: string }) {
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? (value === null ? "" : String(value).replace(".", ","));
  return (
    <label className="field">
      <span>{label}</span>
      <div className="input-affix">
        <input
          inputMode="decimal"
          value={shown}
          placeholder={placeholder}
          onChange={(event) => {
            const text = event.target.value;
            setDraft(text);
            const parsed = Number(text.replace(",", ".").replace(/[^\d.]/g, ""));
            onCommit(text.trim() === "" || !Number.isFinite(parsed) ? null : Math.min(999_999, Math.max(0, Math.round(parsed * 100) / 100)));
          }}
          onBlur={() => setDraft(null)}
          onKeyDown={(event) => { if (event.key === "Enter") event.currentTarget.blur(); }}
        />
        <b>€</b>
      </div>
    </label>
  );
}
