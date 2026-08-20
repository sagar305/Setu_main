"use client";

// Client-side store for the Free Token System.
//
// Two things make this different from the other Setu stores.
//
// It is shared by two surfaces. The counter writes and the waiting-room
// display reads, in separate tabs, against one database — so every write
// broadcasts what it touched, and the display re-reads. The database is the
// only truth; nothing is mirrored between tabs.
//
// And it has a clock. A queue is one business day wide, and the day rolls over
// at an hour the owner picks, under tabs that have been open since morning. So
// the store owns the rollover: at the reset hour it re-derives today, closes
// out yesterday's stragglers, and the screens follow.

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { dbBatch, dbGetAll } from "@/lib/pos/db";
import { nowIso as posNowIso, type Business } from "@/lib/pos/types";
import {
  allocateToken,
  tokenBatch,
  tokenClearAll,
  tokenGetAll,
  type TokenStoreName,
} from "./db";
import { createTokenBroadcast, POLL_MS, STALE_MS, type TokenBroadcast } from "./sync";
import { restoreBackup, type TokenBackup } from "./backup";
import { ALL_SYNC_SLICES, buildTabPayloads, isValidSyncUrl, pushToSheet } from "./sheetSync";
import {
  businessDate,
  counterServes,
  nextInQueue,
  nextResetAt,
  retentionCutoff,
  tokensPastDeadline,
} from "./calc";
import {
  DEFAULT_SETTINGS,
  SERVICE_COLOURS,
  TOKEN_RETENTION_DAYS,
  generateId,
  nowIso,
  type Counter,
  type TokenSettings,
  type Service,
  type Token,
} from "./types";

export type AppStatus = "loading" | "welcome" | "setup" | "ready" | "error";

export type ServiceInput = Omit<Service, "id" | "createdAt">;
export type CounterInput = Omit<Counter, "id" | "createdAt">;

export type IssueTokenInput = {
  serviceId: string;
  customerName?: string;
  phone?: string;
  note?: string;
  priority?: boolean;
  selfIssued?: boolean;
  /** Set when this token replaces one that was skipped. */
  reissuedFromId?: string | null;
};

type TokenContextValue = {
  status: AppStatus;
  errorMessage: string;
  business: Business | null;
  settings: TokenSettings;
  services: Service[];
  counters: Counter[];
  /** Every retained token, up to the ninety-day window. Reports reads this. */
  tokens: Token[];
  /** Today's tokens. Every screen but Reports reads this. */
  todayTokens: Token[];
  /** The current business day, "YYYY-MM-DD". */
  today: string;

  startSetup: () => void;
  backToWelcome: () => void;
  createQueue: (
    profile: Omit<Business, "id" | "createdAt">,
    serviceName: string,
    counterName: string
  ) => Promise<void>;
  updateBusiness: (updates: Partial<Omit<Business, "id" | "createdAt">>) => Promise<void>;
  updateSettings: (updates: Partial<Omit<TokenSettings, "id">>) => Promise<void>;

  saveService: (input: ServiceInput, id?: string) => Promise<Service>;
  deleteService: (id: string) => Promise<void>;
  saveCounter: (input: CounterInput, id?: string) => Promise<Counter>;
  deleteCounter: (id: string) => Promise<void>;

  issueToken: (input: IssueTokenInput) => Promise<Token>;
  /** Take the next waiting token for this counter. Null when nobody is waiting. */
  callNext: (counterId: string) => Promise<Token | null>;
  /** Call a specific waiting token, jumping the queue. */
  callToken: (tokenId: string, counterId: string) => Promise<Token | null>;
  recallToken: (tokenId: string) => Promise<void>;
  startServing: (tokenId: string) => Promise<void>;
  completeToken: (tokenId: string) => Promise<void>;
  skipToken: (tokenId: string) => Promise<void>;
  /** Re-issue a skipped token as a fresh number at the back of the line. */
  markCameBack: (tokenId: string) => Promise<Token | null>;
  cancelToken: (tokenId: string) => Promise<void>;
  transferToken: (
    tokenId: string,
    target: { serviceId?: string; counterId?: string | null }
  ) => Promise<void>;

  /** Start a fresh day now, without waiting for the reset hour. */
  resetDayNow: () => Promise<void>;
  /** Wipe the queue database. Does not touch the shared workspace. */
  clearAllData: () => Promise<void>;
  /** Replace the queue with a backup file's contents and re-read everything. */
  applyRestoredBackup: (backup: TokenBackup) => Promise<void>;
  /** Push the current snapshot to the owner's Google Sheet. */
  syncToSheet: () => Promise<void>;
  reloadAll: () => Promise<void>;

  serviceById: (id: string) => Service | undefined;
  counterById: (id: string) => Counter | undefined;
};

const TokenContext = createContext<TokenContextValue | null>(null);

export function useToken(): TokenContextValue {
  const context = useContext(TokenContext);
  if (!context) throw new Error("useToken must be used inside a TokenProvider.");
  return context;
}

/** Statuses that mean a token is still live and someone is expected to appear. */
const OPEN_STATUSES: Token["status"][] = ["waiting", "called", "serving"];

export function TokenProvider({ children }: { children: ReactNode }) {
  const [status, setStatus] = useState<AppStatus>("loading");
  const [errorMessage, setErrorMessage] = useState("");
  const [business, setBusiness] = useState<Business | null>(null);
  const [settings, setSettings] = useState<TokenSettings>(DEFAULT_SETTINGS);
  const [services, setServices] = useState<Service[]>([]);
  const [counters, setCounters] = useState<Counter[]>([]);
  const [tokens, setTokens] = useState<Token[]>([]);
  const [today, setToday] = useState<string>(() => businessDate(new Date(), 0));

  // Reads happen from timers and broadcast handlers as well as from React, so
  // the current values are mirrored into refs. Reading state inside a timer
  // that was scheduled ten minutes ago otherwise sees the state of ten minutes
  // ago, which is exactly how a rollover silently stops working.
  const tokensRef = useRef<Token[]>([]);
  const settingsRef = useRef<TokenSettings>(DEFAULT_SETTINGS);
  const countersRef = useRef<Counter[]>([]);
  useEffect(() => {
    tokensRef.current = tokens;
  }, [tokens]);
  useEffect(() => {
    settingsRef.current = settings;
  }, [settings]);
  useEffect(() => {
    countersRef.current = counters;
  }, [counters]);

  const broadcastRef = useRef<TokenBroadcast | null>(null);
  const broadcast = useRef((): TokenBroadcast => {
    if (!broadcastRef.current) broadcastRef.current = createTokenBroadcast();
    return broadcastRef.current;
  }).current;

  useEffect(() => {
    return () => {
      broadcastRef.current?.close();
      broadcastRef.current = null;
    };
  }, []);

  /** Write, then tell the other tab which stores moved. */
  const batchWithSync = useCallback(
    async (
      writes: Partial<Record<TokenStoreName, unknown[]>>,
      deletes: Partial<Record<TokenStoreName, string[]>> = {}
    ) => {
      await tokenBatch(writes, deletes);
      broadcast().post(
        Array.from(new Set([...Object.keys(writes), ...Object.keys(deletes)])) as TokenStoreName[]
      );
    },
    [broadcast]
  );

  /* ---------------------------------------------------------------------
   * Loading and the day roll
   * ------------------------------------------------------------------ */

  /**
   * Close out a day that has ended.
   *
   * Tokens left open when the reset hour passes are voided rather than carried
   * forward: the people they belong to went home hours ago, and a waiting list
   * that still shows them means the display lies to the room every morning.
   * They are marked cancelled, not served — nobody knows whether that person
   * was seen, and recording a guess would quietly corrupt the reports.
   */
  const voidStaleTokens = useCallback(
    async (rows: Token[], currentDay: string): Promise<Token[]> => {
      const stale = rows.filter(
        (token) => token.date < currentDay && OPEN_STATUSES.includes(token.status)
      );
      if (stale.length === 0) return rows;

      const closedAt = nowIso();
      const voided = stale.map((token) => ({
        ...token,
        status: "cancelled" as const,
        closedAt: token.closedAt ?? closedAt,
        note: token.note
          ? `${token.note} · Auto-voided at day close`
          : "Auto-voided at day close",
      }));
      await batchWithSync({ tokens: voided });

      const byId = new Map(voided.map((token) => [token.id, token]));
      return rows.map((token) => byId.get(token.id) ?? token);
    },
    [batchWithSync]
  );

  /** Drop tokens past the retention window. Reports never looks further back. */
  const purgeOldTokens = useCallback(
    async (rows: Token[], currentDay: string): Promise<Token[]> => {
      const cutoff = retentionCutoff(currentDay, TOKEN_RETENTION_DAYS);
      const expired = rows.filter((token) => token.date < cutoff);
      if (expired.length === 0) return rows;
      await batchWithSync({}, { tokens: expired.map((token) => token.id) });
      const expiredIds = new Set(expired.map((token) => token.id));
      return rows.filter((token) => !expiredIds.has(token.id));
    },
    [batchWithSync]
  );

  const load = useCallback(async () => {
    try {
      const [storedSettings, storedServices, storedCounters, storedTokens, workspace] =
        await Promise.all([
          tokenGetAll<TokenSettings>("settings"),
          tokenGetAll<Service>("services"),
          tokenGetAll<Counter>("counters"),
          tokenGetAll<Token>("tokens"),
          dbGetAll<Business>("business"),
        ]);

      const merged: TokenSettings = {
        ...DEFAULT_SETTINGS,
        ...(storedSettings.find((row) => row.id === "main") ?? {}),
      };
      const currentDay = businessDate(new Date(), merged.dailyResetHour);

      let rows = await purgeOldTokens(storedTokens, currentDay);
      rows = await voidStaleTokens(rows, currentDay);

      const existingBusiness = workspace.find((row) => row.id === "main") ?? null;

      setSettings(merged);
      setServices(storedServices.slice().sort((a, b) => a.sortOrder - b.sortOrder));
      setCounters(storedCounters);
      setTokens(rows);
      setToday(currentDay);
      setBusiness(existingBusiness);

      // A queue exists once it has a service to queue for. A workspace alone
      // is not enough — a shopkeeper who used the invoice tool last month has
      // a business record and no queue.
      setStatus(storedServices.length > 0 ? "ready" : "welcome");
    } catch (error) {
      setErrorMessage(
        error instanceof Error ? error.message : "Could not open the queue database."
      );
      setStatus("error");
    }
  }, [purgeOldTokens, voidStaleTokens]);

  useEffect(() => {
    void load();
  }, [load]);

  /** Re-read only the stores another tab says it changed. */
  const reloadStores = useCallback(async (stores: TokenStoreName[]) => {
    const wanted = new Set(stores);
    if (wanted.has("settings")) {
      const rows = await tokenGetAll<TokenSettings>("settings");
      setSettings({ ...DEFAULT_SETTINGS, ...(rows.find((r) => r.id === "main") ?? {}) });
    }
    if (wanted.has("services")) {
      const rows = await tokenGetAll<Service>("services");
      setServices(rows.slice().sort((a, b) => a.sortOrder - b.sortOrder));
    }
    if (wanted.has("counters")) setCounters(await tokenGetAll<Counter>("counters"));
    if (wanted.has("tokens")) setTokens(await tokenGetAll<Token>("tokens"));
  }, []);

  const reloadAll = useCallback(async () => {
    await reloadStores(["settings", "services", "counters", "tokens"]);
  }, [reloadStores]);

  // Channel 1: the instant path.
  const lastSignalRef = useRef<number>(Date.now());
  useEffect(() => {
    const unsubscribe = broadcast().subscribe((stores) => {
      lastSignalRef.current = Date.now();
      void reloadStores(stores);
    });
    return unsubscribe;
  }, [broadcast, reloadStores]);

  /**
   * Channels 2 and 3: the guarantee.
   *
   * Every two seconds the tab re-reads the tokens, and every ten it re-reads
   * everything regardless of what it thinks it knows. This exists for the
   * smart TV in the corner whose browser has no BroadcastChannel and whose
   * localStorage events never fire — and for the case nobody plans for, where
   * the channel is silently dropped and the display looks fine while showing
   * a token from an hour ago.
   */
  useEffect(() => {
    if (status !== "ready") return;
    const timer = window.setInterval(() => {
      const silentFor = Date.now() - lastSignalRef.current;
      if (silentFor >= STALE_MS) {
        lastSignalRef.current = Date.now();
        void reloadAll();
      } else {
        void reloadStores(["tokens"]);
      }
    }, POLL_MS);
    return () => window.clearInterval(timer);
  }, [status, reloadAll, reloadStores]);

  /**
   * The rollover, under a tab that has been open all night.
   *
   * Scheduled to the exact moment rather than polled, then rescheduled — a
   * setTimeout of more than a few hours is unreliable in a throttled tab, so
   * the wake also re-checks the date rather than trusting that it fired on
   * time.
   */
  useEffect(() => {
    if (status !== "ready") return;
    let timer = 0;

    const schedule = () => {
      const at = nextResetAt(new Date(), settings.dailyResetHour);
      const delay = Math.max(1000, Math.min(at.getTime() - Date.now(), 60 * 60 * 1000));
      timer = window.setTimeout(async () => {
        const currentDay = businessDate(new Date(), settingsRef.current.dailyResetHour);
        setToday((previous) => {
          if (previous === currentDay) return previous;
          void (async () => {
            const rows = await voidStaleTokens(tokensRef.current, currentDay);
            setTokens(rows);
          })();
          return currentDay;
        });
        schedule();
      }, delay);
    };

    schedule();
    return () => window.clearTimeout(timer);
  }, [status, settings.dailyResetHour, voidStaleTokens]);

  /* ---------------------------------------------------------------------
   * Setup
   * ------------------------------------------------------------------ */

  const startSetup = useCallback(() => setStatus("setup"), []);
  const backToWelcome = useCallback(() => setStatus("welcome"), []);

  const createQueue = useCallback(
    async (
      profile: Omit<Business, "id" | "createdAt">,
      serviceName: string,
      counterName: string
    ) => {
      const existing = (await dbGetAll<Business>("business")).find((row) => row.id === "main");
      // The workspace is shared. If this device already has a business — from
      // the POS, the invoice tool, anything — we take it as it is rather than
      // overwriting someone's saved details with a half-filled queue form.
      const nextBusiness: Business =
        existing ?? { ...profile, id: "main", createdAt: posNowIso() };
      if (!existing) await dbBatch({ business: [nextBusiness] });

      const service: Service = {
        id: generateId(),
        name: serviceName.trim() || "General",
        prefix: "",
        avgServiceMinutes: 5,
        colour: SERVICE_COLOURS[0],
        active: true,
        sortOrder: 0,
        createdAt: nowIso(),
      };
      const counter: Counter = {
        id: generateId(),
        name: counterName.trim() || "Counter 1",
        serviceIds: [],
        staffName: "",
        active: true,
        createdAt: nowIso(),
      };
      const nextSettings: TokenSettings = {
        ...DEFAULT_SETTINGS,
        displayTitle: profile.name ? `Welcome to ${profile.name}` : "",
      };

      await batchWithSync({
        settings: [nextSettings],
        services: [service],
        counters: [counter],
      });

      setBusiness(nextBusiness);
      setSettings(nextSettings);
      setServices([service]);
      setCounters([counter]);
      setToday(businessDate(new Date(), nextSettings.dailyResetHour));
      setStatus("ready");
    },
    [batchWithSync]
  );

  const updateBusiness = useCallback(
    async (updates: Partial<Omit<Business, "id" | "createdAt">>) => {
      const base =
        business ?? (await dbGetAll<Business>("business")).find((row) => row.id === "main");
      if (!base) return;
      const next: Business = { ...base, ...updates };
      await dbBatch({ business: [next] });
      setBusiness(next);
    },
    [business]
  );

  const updateSettings = useCallback(
    async (updates: Partial<Omit<TokenSettings, "id">>) => {
      const next: TokenSettings = { ...settingsRef.current, ...updates, id: "main" };
      setSettings(next);
      await batchWithSync({ settings: [next] });
      // A changed reset hour can move what "today" means under a running tab.
      setToday(businessDate(new Date(), next.dailyResetHour));
    },
    [batchWithSync]
  );

  /* ---------------------------------------------------------------------
   * Services and counters
   * ------------------------------------------------------------------ */

  const saveService = useCallback(
    async (input: ServiceInput, id?: string) => {
      const existing = id ? services.find((row) => row.id === id) : undefined;
      const service: Service = {
        ...input,
        id: existing?.id ?? generateId(),
        createdAt: existing?.createdAt ?? nowIso(),
      };
      await batchWithSync({ services: [service] });
      setServices((previous) => {
        const next = existing
          ? previous.map((row) => (row.id === service.id ? service : row))
          : [...previous, service];
        return next.sort((a, b) => a.sortOrder - b.sortOrder);
      });
      return service;
    },
    [batchWithSync, services]
  );

  /**
   * Deleting a service leaves its tokens alone.
   *
   * Today's queue may still hold people who took a token for it, and the
   * reports certainly do. Removing the row and orphaning the history would
   * make yesterday's numbers unexplainable, so a service that has ever been
   * used is deactivated instead — only one that never issued a token is
   * genuinely deleted.
   */
  const deleteService = useCallback(
    async (id: string) => {
      const used = tokensRef.current.some((token) => token.serviceId === id);
      if (used) {
        const service = services.find((row) => row.id === id);
        if (!service) return;
        const deactivated: Service = { ...service, active: false };
        await batchWithSync({ services: [deactivated] });
        setServices((previous) =>
          previous.map((row) => (row.id === id ? deactivated : row))
        );
        return;
      }
      await batchWithSync({}, { services: [id] });
      setServices((previous) => previous.filter((row) => row.id !== id));
    },
    [batchWithSync, services]
  );

  const saveCounter = useCallback(
    async (input: CounterInput, id?: string) => {
      const existing = id ? counters.find((row) => row.id === id) : undefined;
      const counter: Counter = {
        ...input,
        id: existing?.id ?? generateId(),
        createdAt: existing?.createdAt ?? nowIso(),
      };
      await batchWithSync({ counters: [counter] });
      setCounters((previous) =>
        existing
          ? previous.map((row) => (row.id === counter.id ? counter : row))
          : [...previous, counter]
      );
      return counter;
    },
    [batchWithSync, counters]
  );

  const deleteCounter = useCallback(
    async (id: string) => {
      await batchWithSync({}, { counters: [id] });
      setCounters((previous) => previous.filter((row) => row.id !== id));
    },
    [batchWithSync]
  );

  /* ---------------------------------------------------------------------
   * Tokens
   * ------------------------------------------------------------------ */

  /** Apply a change to one token, in the database and in state. */
  const writeToken = useCallback(
    async (token: Token) => {
      await batchWithSync({ tokens: [token] });
      setTokens((previous) => previous.map((row) => (row.id === token.id ? token : row)));
    },
    [batchWithSync]
  );

  const patchToken = useCallback(
    async (tokenId: string, patch: Partial<Token>): Promise<Token | null> => {
      const current = tokensRef.current.find((row) => row.id === tokenId);
      if (!current) return null;
      const next: Token = { ...current, ...patch };
      await writeToken(next);
      return next;
    },
    [writeToken]
  );

  const issueToken = useCallback(
    async (input: IssueTokenInput) => {
      const day = businessDate(new Date(), settingsRef.current.dailyResetHour);
      const issuedAt = nowIso();
      const token = await allocateToken<Token>(
        day,
        input.serviceId,
        settingsRef.current.lastResetAt,
        (number) => ({
        id: generateId(),
        serviceId: input.serviceId,
        number,
        date: day,
        status: "waiting",
        priority: input.priority ?? false,
        counterId: null,
        customerName: input.customerName?.trim() ?? "",
        phone: input.phone?.trim() ?? "",
        note: input.note?.trim() ?? "",
        issuedAt,
        calledAt: null,
        servingStartedAt: null,
        closedAt: null,
        recallCount: 0,
          selfIssued: input.selfIssued ?? false,
          reissuedFromId: input.reissuedFromId ?? null,
          reissuedAsId: null,
        })
      );

      broadcast().post(["tokens"]);
      setTokens((previous) => [...previous, token]);
      setToday(day);
      return token;
    },
    [broadcast]
  );

  /**
   * Close whatever this counter was doing before it calls the next person.
   *
   * A counter shows one token at a time, and in a real queue the act of
   * calling the next person *is* the act of finishing with this one — nobody
   * standing at a window taps Done first. So Call next closes the current
   * token, and how it closes says what actually happened: one that reached
   * "serving" was served, one that was only ever called never appeared and is
   * skipped. Serving is a required stop precisely so that a served token
   * always has a start time, and inventing one here would undo that.
   */
  const closeCurrentForCounter = useCallback(
    (rows: Token[], counterId: string, at: string): Token[] => {
      return rows
        .filter(
          (token) =>
            token.counterId === counterId &&
            (token.status === "serving" || token.status === "called")
        )
        .map((token) =>
          token.status === "serving"
            ? { ...token, status: "served" as const, closedAt: at }
            : { ...token, status: "skipped" as const, closedAt: at }
        );
    },
    []
  );

  const callToken = useCallback(
    async (tokenId: string, counterId: string) => {
      const rows = tokensRef.current;
      const target = rows.find((row) => row.id === tokenId);
      if (!target || target.status !== "waiting") return null;

      const at = nowIso();
      const called: Token = {
        ...target,
        status: "called",
        counterId,
        calledAt: at,
        recallCount: 0,
      };
      const closed = closeCurrentForCounter(rows, counterId, at).filter(
        (token) => token.id !== called.id
      );

      await batchWithSync({ tokens: [...closed, called] });
      const byId = new Map([...closed, called].map((token) => [token.id, token]));
      setTokens((previous) => previous.map((token) => byId.get(token.id) ?? token));
      return called;
    },
    [batchWithSync, closeCurrentForCounter]
  );

  const callNext = useCallback(
    async (counterId: string) => {
      const counter = countersRef.current.find((row) => row.id === counterId) ?? null;
      const day = businessDate(new Date(), settingsRef.current.dailyResetHour);
      const queue = tokensRef.current.filter((token) => token.date === day);
      const next = nextInQueue(queue, counter);
      if (!next) return null;
      return callToken(next.id, counterId);
    },
    [callToken]
  );

  /**
   * Re-announce. The number does not change and the counter does not change —
   * only the count of how many times this person has been asked to come,
   * which is what decides when Skip is offered.
   */
  const recallToken = useCallback(
    async (tokenId: string) => {
      const current = tokensRef.current.find((row) => row.id === tokenId);
      if (!current) return;
      await writeToken({
        ...current,
        status: "called",
        calledAt: nowIso(),
        recallCount: current.recallCount + 1,
      });
    },
    [writeToken]
  );

  const startServing = useCallback(
    async (tokenId: string) => {
      await patchToken(tokenId, { status: "serving", servingStartedAt: nowIso() });
    },
    [patchToken]
  );

  const completeToken = useCallback(
    async (tokenId: string) => {
      await patchToken(tokenId, { status: "served", closedAt: nowIso() });
    },
    [patchToken]
  );

  const skipToken = useCallback(
    async (tokenId: string) => {
      await patchToken(tokenId, { status: "skipped", closedAt: nowIso() });
    },
    [patchToken]
  );

  /**
   * Somebody who missed their call has come back.
   *
   * They do not get their old number returned to them. A number that has
   * already been called and announced to the room cannot be put back into the
   * line without the display and the people in it disagreeing about what it
   * means — so the skipped row stays skipped, exactly as it happened, and this
   * person is handed a fresh token that joins behind everyone currently
   * waiting. Their name and number come across so nobody is asked for them
   * twice, and the two rows are linked so the history still reads as one
   * person's visit.
   *
   * Priority does not carry over. Whatever earned it, they were called and did
   * not come, and jumping the line a second time is the one thing the people
   * who did wait would notice.
   */
  const markCameBack = useCallback(
    async (tokenId: string): Promise<Token | null> => {
      const skipped = tokensRef.current.find((row) => row.id === tokenId);
      if (!skipped || skipped.status !== "skipped") return null;

      const replacement = await issueToken({
        serviceId: skipped.serviceId,
        customerName: skipped.customerName,
        phone: skipped.phone,
        note: skipped.note,
        priority: false,
        reissuedFromId: skipped.id,
      });

      await patchToken(skipped.id, { reissuedAsId: replacement.id });
      return replacement;
    },
    [issueToken, patchToken]
  );

  /**
   * The grace window, enforced.
   *
   * Two things have to be true for this to be fair rather than merely tidy.
   * It has to run even when nobody is looking at the app — a counter tab that
   * was closed at 5:59 must not let a token sit "called" overnight — so the
   * sweep runs on load as well as on a timer, and skips anything already past
   * its deadline. And it has to be the same answer in every tab: both the
   * counter and the display hold this provider, so the write is idempotent
   * (only a token still at "called" is touched) and whichever tab gets there
   * first is simply the one that did it.
   */
  const sweepExpiredCalls = useCallback(async () => {
    const { autoSkipEnabled, autoSkipMinutes } = settingsRef.current;
    if (!autoSkipEnabled) return;

    const expired = tokensPastDeadline(tokensRef.current, autoSkipMinutes);
    if (expired.length === 0) return;

    const at = nowIso();
    const skipped = expired.map((token) => ({
      ...token,
      status: "skipped" as const,
      closedAt: at,
    }));
    await batchWithSync({ tokens: skipped });
    const byId = new Map(skipped.map((token) => [token.id, token]));
    setTokens((previous) => previous.map((token) => byId.get(token.id) ?? token));
  }, [batchWithSync]);

  useEffect(() => {
    if (status !== "ready" || !settings.autoSkipEnabled) return;
    // Every second, because the counter is showing a countdown from the same
    // numbers and a skip that lands visibly late reads as a bug.
    const timer = window.setInterval(() => void sweepExpiredCalls(), 1000);
    return () => window.clearInterval(timer);
  }, [status, settings.autoSkipEnabled, sweepExpiredCalls]);

  useEffect(() => {
    if (status === "ready") void sweepExpiredCalls();
  }, [status, sweepExpiredCalls]);

  const cancelToken = useCallback(
    async (tokenId: string) => {
      await patchToken(tokenId, { status: "cancelled", closedAt: nowIso() });
    },
    [patchToken]
  );

  /**
   * Move a token to another service or another counter.
   *
   * The number travels with the person. Someone holding a slip that says A-42
   * has been told to watch for A-42, and renumbering them into B-17 because a
   * staff member sent them to the right desk is how a queue loses people.
   */
  const transferToken = useCallback(
    async (tokenId: string, target: { serviceId?: string; counterId?: string | null }) => {
      const current = tokensRef.current.find((row) => row.id === tokenId);
      if (!current) return;

      const patch: Partial<Token> = {};
      if (target.serviceId && target.serviceId !== current.serviceId) {
        patch.serviceId = target.serviceId;
      }
      if (target.counterId !== undefined) patch.counterId = target.counterId;

      // Sending someone to a different desk puts them back in a line — they
      // are not "called" at the new counter until it calls. They keep the time
      // they arrived, and so their place among the people already waiting:
      // being sent to the wrong desk was not their mistake, and starting their
      // wait again would punish them for it.
      if (target.serviceId && target.serviceId !== current.serviceId) {
        patch.status = "waiting";
        patch.counterId = target.counterId ?? null;
        patch.calledAt = null;
        patch.servingStartedAt = null;
        patch.recallCount = 0;
      }
      await patchToken(tokenId, patch);
    },
    [patchToken]
  );

  /* ---------------------------------------------------------------------
   * Day and data controls
   * ------------------------------------------------------------------ */

  /**
   * Start a new day now.
   *
   * The automatic reset is right for a business with regular hours and wrong
   * for the one that has just finished a wedding-season Sunday at 2am, so the
   * hour is not the only way to draw the line.
   */
  const resetDayNow = useCallback(async () => {
    const at = nowIso();
    const open = tokensRef.current.filter((token) => OPEN_STATUSES.includes(token.status));
    const voided = open.map((token) => ({
      ...token,
      status: "cancelled" as const,
      closedAt: at,
      note: token.note ? `${token.note} \u00b7 Queue reset` : "Queue reset",
    }));
    // The boundary, not a zeroed counter: numbering is derived from the tokens
    // issued since this moment, so nothing has to be deleted for the next
    // person to be number 1, and this morning's history stays intact.
    const nextSettings: TokenSettings = { ...settingsRef.current, lastResetAt: at };

    await batchWithSync({
      tokens: voided,
      settings: [nextSettings],
    });

    const byId = new Map(voided.map((token) => [token.id, token]));
    setTokens((previous) => previous.map((token) => byId.get(token.id) ?? token));
    setSettings(nextSettings);
  }, [batchWithSync]);

  const applyRestoredBackup = useCallback(
    async (backup: TokenBackup) => {
      await restoreBackup(backup);
      broadcast().post(["settings", "services", "counters", "tokens"]);
      await load();
    },
    [broadcast, load]
  );

  /**
   * Push everything to the owner's sheet.
   *
   * One way only. Pulling would let a spreadsheet edit rewrite a live queue,
   * and a queue is the one kind of record where a stale overwrite loses a
   * person standing in the room.
   */
  const syncToSheet = useCallback(async () => {
    const url = (settingsRef.current.sheetUrl ?? "").trim();
    if (!url) throw new Error("Add your Google Sheet URL in Settings first.");
    if (!isValidSyncUrl(url)) throw new Error("That does not look like an Apps Script URL.");

    await pushToSheet(
      url,
      buildTabPayloads(ALL_SYNC_SLICES, {
        business,
        settings: settingsRef.current,
        services,
        counters: countersRef.current,
        tokens: tokensRef.current,
      })
    );
    const next: TokenSettings = { ...settingsRef.current, lastSyncAt: nowIso() };
    setSettings(next);
    await batchWithSync({ settings: [next] });
  }, [batchWithSync, business, services]);

  const clearAllData = useCallback(async () => {
    await tokenClearAll();
    broadcast().post(["settings", "services", "counters", "tokens"]);
    setSettings(DEFAULT_SETTINGS);
    setServices([]);
    setCounters([]);
    setTokens([]);
    setStatus("welcome");
  }, [broadcast]);

  /* ---------------------------------------------------------------------
   * Derived
   * ------------------------------------------------------------------ */

  const todayTokens = useMemo(
    () => tokens.filter((token) => token.date === today),
    [tokens, today]
  );

  const serviceById = useCallback(
    (id: string) => services.find((row) => row.id === id),
    [services]
  );
  const counterById = useCallback(
    (id: string) => counters.find((row) => row.id === id),
    [counters]
  );

  const value: TokenContextValue = {
    status,
    errorMessage,
    business,
    settings,
    services,
    counters,
    tokens,
    todayTokens,
    today,
    startSetup,
    backToWelcome,
    createQueue,
    updateBusiness,
    updateSettings,
    saveService,
    deleteService,
    saveCounter,
    deleteCounter,
    issueToken,
    callNext,
    callToken,
    recallToken,
    startServing,
    completeToken,
    skipToken,
    markCameBack,
    cancelToken,
    transferToken,
    resetDayNow,
    clearAllData,
    applyRestoredBackup,
    syncToSheet,
    reloadAll,
    serviceById,
    counterById,
  };

  return <TokenContext.Provider value={value}>{children}</TokenContext.Provider>;
}

/** Counters that can take a given service, for the transfer picker. */
export function countersForService(counters: Counter[], serviceId: string): Counter[] {
  return counters.filter((counter) => counter.active && counterServes(counter, serviceId));
}
