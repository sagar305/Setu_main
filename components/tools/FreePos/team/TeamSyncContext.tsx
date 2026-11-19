"use client";

// Runs Google Drive team sync for the POS: loads this device's membership,
// syncs on open, every 60 seconds, when the tab regains focus or the network
// returns, and a few seconds after each change. Screens read the team state
// (role, last sync, problems) from useTeam().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onCapturedWrite } from "@/lib/pos/db";
import { driveConfig } from "@/lib/pos/drive/auth";
import {
  loadTeam,
  onTeamDataChanged,
  setConnectedTools,
  signIn,
  subscribeTeam,
  syncNow,
  type TeamState,
} from "@/lib/pos/drive/engine";
import { canSeeScreen, type PosScreen } from "@/lib/pos/drive/roles";
import { usePos } from "@/lib/pos/store";

const SYNC_EVERY_MS = 60_000;
const AFTER_CHANGE_MS = 4_000;

type TeamContextValue = {
  /** Drive sync is configured on this site (env values present). */
  available: boolean;
  ready: boolean;
  team: TeamState | null;
  syncing: boolean;
  isCashier: boolean;
  canSee: (screen: PosScreen) => boolean;
  sync: () => Promise<void>;
  reconnect: () => Promise<void>;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export function TeamSyncProvider({ children }: { children: ReactNode }) {
  const { settings, reload, status } = usePos();
  const available = driveConfig() !== null;
  const [team, setTeam] = useState<TeamState | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;

  useEffect(() => {
    setConnectedTools(settings.connectedTools);
  }, [settings.connectedTools]);

  useEffect(() => subscribeTeam(setTeam), []);
  useEffect(() => onTeamDataChanged(() => void reloadRef.current()), []);

  // Load membership once the POS database is open.
  useEffect(() => {
    if (status === "loading" || status === "error") return;
    let active = true;
    loadTeam()
      .catch(() => null)
      .finally(() => active && setReady(true));
    return () => {
      active = false;
    };
  }, [status]);

  const sync = useCallback(async () => {
    setSyncing(true);
    try {
      await syncNow();
    } finally {
      setSyncing(false);
    }
  }, []);

  const inTeam = Boolean(team && !team.removed);
  useEffect(() => {
    if (!inTeam) return;
    void sync();
    const timer = window.setInterval(() => void sync(), SYNC_EVERY_MS);
    let pending: number | undefined;
    const soon = () => {
      window.clearTimeout(pending);
      pending = window.setTimeout(() => void sync(), AFTER_CHANGE_MS);
    };
    const offWrite = onCapturedWrite(soon);
    const onFocus = () => void sync();
    window.addEventListener("focus", onFocus);
    window.addEventListener("online", onFocus);
    return () => {
      window.clearInterval(timer);
      window.clearTimeout(pending);
      offWrite();
      window.removeEventListener("focus", onFocus);
      window.removeEventListener("online", onFocus);
    };
  }, [inTeam, sync]);

  const reconnect = useCallback(async () => {
    await signIn();
    await sync();
  }, [sync]);

  const value = useMemo<TeamContextValue>(() => {
    const role = team && !team.removed ? team.role : null;
    return {
      available,
      ready,
      team,
      syncing,
      isCashier: role === "cashier",
      canSee: (screen) => (role ? canSeeScreen(role, screen) : true),
      sync,
      reconnect,
    };
  }, [available, ready, team, syncing, sync, reconnect]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

export function useTeam(): TeamContextValue {
  const ctx = useContext(TeamContext);
  if (!ctx) throw new Error("useTeam must be used inside TeamSyncProvider");
  return ctx;
}

/** "12 sec ago", "5 min ago", for the sync badge. */
export function timeAgo(iso: string | null, now = Date.now()): string {
  if (!iso) return "never";
  const s = Math.max(0, Math.round((now - new Date(iso).getTime()) / 1000));
  if (s < 60) return `${s} sec ago`;
  const m = Math.round(s / 60);
  if (m < 60) return `${m} min ago`;
  const h = Math.round(m / 60);
  return h < 24 ? `${h} hr ago` : new Date(iso).toLocaleDateString();
}
