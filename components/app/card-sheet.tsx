"use client";

import { useState } from "react";
import { ArrowRightLeft, ExternalLink, RefreshCw, Trash2, Undo2 } from "lucide-react";
import { placedCount } from "@/lib/domain/state";
import type { BinderItem } from "@/lib/domain/types";
import { dateTime, money, signedMoney } from "@/lib/format";
import { useApp } from "./app-context";
import { CardImage, MoneyInput, PriceMetrics, Sheet, Stepper } from "./ui";

/** Fiche d'une carte de la collection (depuis un emplacement ou la barre latérale). */
export function CardSheet({ item, position, onClose, onMove }: { item: BinderItem | null; position: number | null; onClose: () => void; onMove?: (cardId: string) => void }) {
  const { state, dispatch, refreshOne } = useApp();
  const [busy, setBusy] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const close = () => {
    setConfirmDelete(false);
    onClose();
  };
  const profit = item && item.purchasePrice != null && item.referencePrice !== null ? (item.referencePrice - item.purchasePrice) * item.quantity : null;

  return (
    <Sheet open={item !== null} onClose={close} title={item?.name ?? "Carte"}>
      {item && (
        <div className="detail-layout">
          <CardImage card={item} size="full" className="detail-img" />
          <div className="detail-info">
            <p className="eyebrow">{item.extension}</p>
            <p className="detail-number">
              {item.localId}/{item.printedTotal ?? "?"}
              {item.rarity && <span className="rarity"> · {item.rarity}</span>}
            </p>
            <PriceMetrics price={item.prices} />
            <p className="muted small">Cardmarket · FR · Near Mint — actualisé {dateTime(item.lastPriceUpdate)}</p>

            <div className="row">
              <span className="row-label">Quantité</span>
              <Stepper label="Quantité" value={item.quantity} onChange={(value) => dispatch({ type: "collection/quantity", id: item.id, quantity: value })} />
              <span className="muted small">{placedCount(state, item.id)} dans un binder</span>
            </div>
            <MoneyInput label="Prix d’achat (unité)" value={item.purchasePrice ?? null} onCommit={(value) => dispatch({ type: "collection/purchase", id: item.id, value })} />
            {profit !== null && (
              <p className={`profit ${profit >= 0 ? "up" : "down"}`}>
                Plus-value latente : {signedMoney(profit)} · valeur {money((item.referencePrice ?? 0) * item.quantity)}
              </p>
            )}

            <div className="actions">
              {position !== null && (
                <>
                  <button type="button" className="btn" onClick={() => { onMove?.(item.id); dispatch({ type: "binder/unplace", position }); close(); }}>
                    <ArrowRightLeft size={17} /> Déplacer
                  </button>
                  <button type="button" className="btn" onClick={() => { dispatch({ type: "binder/unplace", position }); close(); }}>
                    <Undo2 size={17} /> Retirer de l’emplacement
                  </button>
                </>
              )}
              <button
                type="button"
                className="btn"
                disabled={busy}
                onClick={async () => {
                  setBusy(true);
                  await refreshOne("collection", item);
                  setBusy(false);
                }}
              >
                <RefreshCw size={17} className={busy ? "spin" : ""} /> Actualiser le prix
              </button>
              <a
                className="btn"
                target="_blank"
                rel="noreferrer noopener"
                href={`https://www.cardmarket.com/fr/Pokemon/Products/Singles?searchString=${encodeURIComponent(`${item.name} ${item.localId}`)}`}
              >
                <ExternalLink size={17} /> Cardmarket
              </a>
              {confirmDelete ? (
                <button type="button" className="btn danger solid" onClick={() => { dispatch({ type: "collection/remove", id: item.id }); close(); }}>
                  <Trash2 size={17} /> Confirmer la suppression
                </button>
              ) : (
                <button type="button" className="btn danger" onClick={() => setConfirmDelete(true)}>
                  <Trash2 size={17} /> Supprimer de la collection
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </Sheet>
  );
}
