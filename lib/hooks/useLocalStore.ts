"use client";

// Lightweight localStorage-backed state for standalone tools that don't need
// the shared workspace database (accounting documents, statements, reports).
// Loads once on mount (so SSR markup stays deterministic) and writes back on
// every change. Data never leaves the browser.

import { useEffect, useRef, useState, type Dispatch, type SetStateAction } from "react";

export function useLocalStore<T>(key: string, initial: T): [T, Dispatch<SetStateAction<T>>, boolean] {
  const [value, setValue] = useState<T>(initial);
  const [loaded, setLoaded] = useState(false);
  const skipWrite = useRef(true);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(key);
      if (raw !== null) setValue(JSON.parse(raw) as T);
    } catch {
      // Corrupt or inaccessible storage — fall back to the initial value.
    }
    setLoaded(true);
  }, [key]);

  useEffect(() => {
    if (!loaded) return;
    if (skipWrite.current) {
      // Skip the write immediately after load so an untouched tool doesn't
      // persist anything.
      skipWrite.current = false;
      return;
    }
    try {
      window.localStorage.setItem(key, JSON.stringify(value));
    } catch {
      // Storage full or blocked — the tool still works for the session.
    }
  }, [key, value, loaded]);

  return [value, setValue, loaded];
}

export function generateLocalId(): string {
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}
