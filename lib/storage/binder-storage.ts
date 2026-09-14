import type { BinderItem } from "@/lib/domain/types";

export interface BinderStorage {
  load(): BinderItem[];
  save(items: BinderItem[]): void;
}

const STORAGE_KEY = "tcg-binder-tracker:v0.1:binder";

export class LocalStorageBinderStorage implements BinderStorage {
  load(): BinderItem[] {
    if (typeof window === "undefined") return [];
    try {
      const raw = window.localStorage.getItem(STORAGE_KEY);
      return raw ? (JSON.parse(raw) as BinderItem[]) : [];
    } catch {
      return [];
    }
  }

  save(items: BinderItem[]) {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(items));
  }
}
