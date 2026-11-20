"use client";

// Runs Google Drive team sync for the repair app: loads this device's
// membership, syncs on open, every 60 seconds, when the tab regains focus or
// the network returns, and a few seconds after each change. Screens read the
// team state (role, last sync, problems) from useRepairTeam().

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { onRepairCapturedWrite } from "@/lib/repair/db";
import { driveConfig, silentToken } from "@/lib/pos/drive/auth";
import {
  leaveTeam,
  loadTeam,
  onTeamDataChanged,
  saveTeamNotice,
  signIn,
  subscribeTeam,
  syncNow,
  type TeamState,
} from "@/lib/repair/team/engine";
import { canSeeScreen, type RepairScreen } from "@/lib/repair/team/roles";
import type { Role } from "@/lib/repair/team/ops";
import { useRepair } from "@/lib/repair/store";

const SYNC_EVERY_MS = 60_000;
const AFTER_CHANGE_MS = 4_000;

type TeamContextValue = {
  /** Drive sync is configured on this site (env values present). */
  available: boolean;
  ready: boolean;
  team: TeamState | null;
  syncing: boolean;
  /** This device's role, or null outside a team (then everything is allowed). */
  role: Role | null;
  isTechnician: boolean;
  isOwner: boolean;
  /** Technicians: their technician record. */
  technicianId: string | null;
  canSee: (screen: RepairScreen) => boolean;
  sync: () => Promise<void>;
  reconnect: () => Promise<void>;
};

const TeamContext = createContext<TeamContextValue | null>(null);

export function RepairTeamProvider({ children }: { children: ReactNode }) {
  const { reload, refreshTracking, status } = useRepair();
  const available = driveConfig() !== null;
  const [team, setTeam] = useState<TeamState | null>(null);
  const [ready, setReady] = useState(false);
  const [syncing, setSyncing] = useState(false);
  const reloadRef = useRef(reload);
  reloadRef.current = reload;
  const refreshRef = useRef(refreshTracking);
  refreshRef.current = refreshTracking;

  useEffect(() => subscribeTeam(setTeam), []);
  useEffect(
    () =>
      onTeamDataChanged((change) => {
        void (async () => {
          await reloadRef.current();
          // The main device brings customers' links up to date for jobs
          // whose status another device changed.
          if (change.jobsWithNewStatus.length) await refreshRef.current(change.jobsWithNewStatus);
        })();
      }),
    []
  );

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

  useEffect(() => {
    if (available) void silentToken();
  }, [available]);

  // Removed by the owner: this device's copy of the shop is deleted and the
  // app goes back to its welcome screen, which explains why.
  const wipingRef = useRef(false);
  useEffect(() => {
    if (!team?.removed || team.isPrimary || wipingRef.current) return;
    wipingRef.current = true;
    saveTeamNotice({ kind: "removed", shopName: team.shopName, at: new Date().toISOString() });
    void (async () => {
      try {
        await leaveTeam({ wipe: true, signOut: true });
        await reloadRef.current();
      } finally {
        wipingRef.current = false;
      }
    })();
  }, [team]);

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
    const offWrite = onRepairCapturedWrite(soon);
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
      role,
      isTechnician: role === "technician",
      isOwner: role === null || role === "owner",
      technicianId: role === "technician" ? (team?.technicianId ?? null) : null,
      canSee: (screen) => (role ? canSeeScreen(role, screen) : true),
      sync,
      reconnect,
    };
  }, [available, ready, team, syncing, sync, reconnect]);

  return <TeamContext.Provider value={value}>{children}</TeamContext.Provider>;
}

/** Outside the provider (e.g. a test render) everything is allowed. */
const OUTSIDE: TeamContextValue = {
  available: false,
  ready: true,
  team: null,
  syncing: false,
  role: null,
  isTechnician: false,
  isOwner: true,
  technicianId: null,
  canSee: () => true,
  sync: async () => undefined,
  reconnect: async () => undefined,
};

export function useRepairTeam(): TeamContextValue {
  return useContext(TeamContext) ?? OUTSIDE;
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
