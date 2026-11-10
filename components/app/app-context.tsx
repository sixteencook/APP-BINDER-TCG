"use client";

import { createContext, useContext } from "react";
import type { Dispatch } from "react";
import type { Action } from "@/lib/domain/state";
import type { AppState, Card } from "@/lib/domain/types";

export type View = "binder" | "search" | "wishlist" | "sealed";

export interface AppApi {
  state: AppState;
  dispatch: Dispatch<Action>;
  view: View;
  setView: (view: View) => void;
  toast: (message: string) => void;
  /** Vrai pendant l'actualisation groupée des prix. */
  refreshing: boolean;
  refreshOne: (kind: "collection" | "wishlist", card: Card) => Promise<boolean>;
  refreshAll: (kind: "collection" | "wishlist") => Promise<void>;
  openSettings: () => void;
}

export const AppContext = createContext<AppApi | null>(null);

export function useApp(): AppApi {
  const api = useContext(AppContext);
  if (!api) throw new Error("useApp doit être utilisé dans <AppShell>.");
  return api;
}
