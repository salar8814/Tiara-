"use client";

import { useCallback, useSyncExternalStore } from "react";

// Lightweight persisted stores for the cart (B2C) and inquiry list (B2B).
// Stored in localStorage so the basket survives reloads; the server
// recomputes prices, stock and quantity rules on submission.

function createStore<T>(key: string, initial: T) {
  let state: T = initial;
  let loaded = false;
  const listeners = new Set<() => void>();

  const load = () => {
    if (loaded || typeof window === "undefined") return;
    loaded = true;
    try {
      const raw = window.localStorage.getItem(key);
      if (raw) state = JSON.parse(raw) as T;
    } catch {
      /* storage unavailable — keep in memory */
    }
  };

  const emit = () => listeners.forEach((l) => l());

  const set = (next: T | ((prev: T) => T)) => {
    load();
    state = typeof next === "function" ? (next as (p: T) => T)(state) : next;
    try {
      window.localStorage.setItem(key, JSON.stringify(state));
    } catch {
      /* ignore */
    }
    emit();
  };

  const subscribe = (l: () => void) => {
    load();
    listeners.add(l);
    const onStorage = (e: StorageEvent) => {
      if (e.key === key) {
        try {
          state = e.newValue ? (JSON.parse(e.newValue) as T) : initial;
        } catch {
          state = initial;
        }
        emit();
      }
    };
    window.addEventListener("storage", onStorage);
    return () => {
      listeners.delete(l);
      window.removeEventListener("storage", onStorage);
    };
  };

  const getSnapshot = () => {
    load();
    return state;
  };

  return { set, subscribe, getSnapshot, getServerSnapshot: () => initial };
}

// ── Cart ──

export interface CartLine {
  variantId: string;
  qty: number;
}

const EMPTY_CART: CartLine[] = [];
const cartStore = createStore<CartLine[]>("tiara.cart.v1", EMPTY_CART);

export function useCart() {
  const lines = useSyncExternalStore(cartStore.subscribe, cartStore.getSnapshot, cartStore.getServerSnapshot);
  const hydrated = useHydrated();

  const add = useCallback((variantId: string, qty = 1, max = Infinity) => {
    cartStore.set((prev) => {
      const hit = prev.find((l) => l.variantId === variantId);
      if (hit) return prev.map((l) => (l.variantId === variantId ? { ...l, qty: Math.min(max, l.qty + qty) } : l));
      return [...prev, { variantId, qty: Math.min(max, qty) }];
    });
  }, []);
  const setQty = useCallback((variantId: string, qty: number) => {
    cartStore.set((prev) => (qty <= 0 ? prev.filter((l) => l.variantId !== variantId) : prev.map((l) => (l.variantId === variantId ? { ...l, qty } : l))));
  }, []);
  const remove = useCallback((variantId: string) => cartStore.set((prev) => prev.filter((l) => l.variantId !== variantId)), []);
  const clear = useCallback(() => cartStore.set([]), []);
  const merge = useCallback((incoming: CartLine[]) => {
    cartStore.set((prev) => {
      const map = new Map(prev.map((l) => [l.variantId, l.qty]));
      for (const l of incoming) map.set(l.variantId, Math.max(map.get(l.variantId) ?? 0, l.qty));
      return Array.from(map, ([variantId, qty]) => ({ variantId, qty }));
    });
  }, []);

  return { lines, hydrated, count: lines.reduce((s, l) => s + l.qty, 0), add, setQty, remove, clear, merge };
}

// ── Inquiry (RFQ basket) ──

export interface InquiryLine {
  productId: string;
  qty: number;
  customization: string[];
  note: string;
}

const EMPTY_INQ: InquiryLine[] = [];
const inquiryStore = createStore<InquiryLine[]>("tiara.inquiry.v1", EMPTY_INQ);

export function useInquiry() {
  const lines = useSyncExternalStore(inquiryStore.subscribe, inquiryStore.getSnapshot, inquiryStore.getServerSnapshot);
  const hydrated = useHydrated();

  const upsert = useCallback((line: InquiryLine) => {
    inquiryStore.set((prev) => {
      const exists = prev.some((l) => l.productId === line.productId);
      return exists ? prev.map((l) => (l.productId === line.productId ? line : l)) : [...prev, line];
    });
  }, []);
  const update = useCallback((productId: string, patch: Partial<InquiryLine>) => {
    inquiryStore.set((prev) => prev.map((l) => (l.productId === productId ? { ...l, ...patch } : l)));
  }, []);
  const remove = useCallback((productId: string) => inquiryStore.set((prev) => prev.filter((l) => l.productId !== productId)), []);
  const clear = useCallback(() => inquiryStore.set([]), []);
  const replace = useCallback((next: InquiryLine[]) => inquiryStore.set(next), []);

  return { lines, hydrated, count: lines.length, upsert, update, remove, clear, replace };
}

const noopSubscribe = () => () => {};
/** false during SSR and the hydration pass, true afterwards — avoids flashing empty-basket states. */
export function useHydrated() {
  return useSyncExternalStore(
    noopSubscribe,
    () => true,
    () => false,
  );
}
