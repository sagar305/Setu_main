"use client";

// Shared CRUD-list hook for Business Toolkit tools. Loads a workspace store
// once on mount and keeps an in-memory copy in sync as the tool adds, updates
// and removes records. Every toolkit tool uses this instead of hand-rolling
// IndexedDB plumbing, so behaviour (loading, errors, refresh) stays identical
// across the ecosystem.

import { useCallback, useEffect, useState } from "react";
import { deleteRecord, listStore, putRecord } from "@/lib/toolkit/workspace";
import type { StoreName } from "@/lib/pos/db";

type WithId = { id: string };

export function useEntityList<T extends WithId>(store: StoreName) {
  const [items, setItems] = useState<T[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    try {
      setItems(await listStore<T>(store));
      setError(null);
    } catch {
      setError("Could not open the workspace database in this browser.");
    } finally {
      setLoading(false);
    }
  }, [store]);

  useEffect(() => {
    refresh();
  }, [refresh]);

  const save = useCallback(
    async (record: T) => {
      await putRecord(store, record);
      setItems((prev) => {
        const i = prev.findIndex((r) => r.id === record.id);
        if (i === -1) return [...prev, record];
        const next = [...prev];
        next[i] = record;
        return next;
      });
    },
    [store]
  );

  const remove = useCallback(
    async (id: string) => {
      await deleteRecord(store, id);
      setItems((prev) => prev.filter((r) => r.id !== id));
    },
    [store]
  );

  return { items, loading, error, refresh, save, remove };
}
