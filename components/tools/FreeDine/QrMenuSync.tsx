"use client";

// Automatic QR menu updates from Free Dine.
//
// Turning a QR menu on is a deliberate act in Settings (it creates the free
// code, or checks the premium key). From then on this provider watches the
// menu in the POS store and, a few seconds after the last edit, pushes the new
// menu to wherever the QR points. The printed QR never changes.
//
// It only pushes when the menu actually differs from the last successful push.
// That record lives in this browser's storage, keyed by destination, so a
// reload does not re-send an unchanged menu and a change of destination always
// sends one.

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
import { useDine } from "@/lib/dine/store";
import {
  checkPremiumKey,
  premiumMenuPayload,
  publishFreeMenu,
  pushPremiumMenu,
  QrSyncError,
  toFreeQrMenu,
  type DineMenuSource,
} from "@/lib/dine/qrMenuSync";
import { clearPublishedMenu, getPublishedMenu } from "@/lib/qrmenu-publish";
import {
  clearPosMenuLink,
  getPosMenuLink,
  getQrMenuBranding,
  linkedMenuPayload,
  setPosMenuLink,
  setQrMenuBranding,
  subscribePosMenuLink,
  type QrMenuBranding,
} from "@/lib/qrmenu-pos-link";
import { shortMenuUrl } from "@/lib/toolkit/shortLink";

const STORAGE_KEY = "setu-free-dine-qr-sync-v1";
/** The free QR Menu Generator's own saved menu, read once to carry its look over. */
const FREE_TOOL_MENU_KEY = "setu-qr-menu-generator-v1";
const DEBOUNCE_MS = 3000;

type SyncRecord = {
  /** "free:<code>" or "premium:<last 4 of key>". */
  target: string;
  payload: string;
  at: string;
  /** Premium only: the /m/<slug> URL the backend reported. */
  menuUrl?: string;
};

function readRecord(): SyncRecord | null {
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as SyncRecord) : null;
  } catch {
    return null;
  }
}

function writeRecord(record: SyncRecord | null): void {
  try {
    if (record) window.localStorage.setItem(STORAGE_KEY, JSON.stringify(record));
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    // Without storage the menu is simply re-sent after a reload. Harmless.
  }
}

export type QrSyncState = "off" | "pending" | "syncing" | "synced" | "error";

type QrMenuSyncValue = {
  state: QrSyncState;
  lastSyncAt: string | null;
  error: QrSyncError | null;
  /** The URL the printed QR encodes, once there is one. */
  menuUrl: string;
  /** A menu the free QR Menu Generator already published on this browser. */
  existingFreeCode: string | null;
  enableFree: (options: { adoptExisting: boolean }) => Promise<void>;
  enablePremium: (key: string) => Promise<void>;
  disable: () => Promise<void>;
  syncNow: () => void;
};

const QrMenuSyncContext = createContext<QrMenuSyncValue | null>(null);

export function useQrMenuSync(): QrMenuSyncValue {
  const value = useContext(QrMenuSyncContext);
  if (!value) throw new Error("useQrMenuSync must be used inside QrMenuSyncProvider");
  return value;
}

export function QrMenuSyncProvider({ children }: { children: ReactNode }) {
  const {
    business,
    settings,
    categories,
    menuItems,
    variations,
    modifierGroups,
    modifiers,
    updateSettings,
  } = useDine();
  const mode = settings.qrMenuMode;

  const [record, setRecord] = useState<SyncRecord | null>(null);
  const [state, setState] = useState<QrSyncState>("off");
  const [error, setError] = useState<QrSyncError | null>(null);
  const [origin, setOrigin] = useState("");
  const [existingFreeCode, setExistingFreeCode] = useState<string | null>(null);
  const [retryTick, setRetryTick] = useState(0);
  // Tagline and brand colour, set in the QR Menu Generator (lib/qrmenu-pos-link).
  const [branding, setBranding] = useState<QrMenuBranding>(() => getQrMenuBranding());
  const inFlight = useRef(false);

  useEffect(() => {
    setOrigin(window.location.origin);
    setRecord(readRecord());
    setExistingFreeCode(getPublishedMenu()?.code ?? null);
    setBranding(getQrMenuBranding());
    return subscribePosMenuLink(() => {
      const next = getQrMenuBranding();
      setBranding((current) =>
        current.tagline === next.tagline && current.accent === next.accent ? current : next
      );
    });
  }, []);

  const source: DineMenuSource = useMemo(
    () => ({ business, categories, menuItems, variations, modifierGroups, modifiers }),
    [business, categories, menuItems, variations, modifierGroups, modifiers]
  );

  const target =
    mode === "free" && settings.qrMenuFreeCode
      ? `free:${settings.qrMenuFreeCode}`
      : mode === "premium" && settings.qrMenuPremiumKey
        ? `premium:${settings.qrMenuPremiumKey.slice(-4)}`
        : "";

  const freeMenu = useMemo(
    () => toFreeQrMenu(source, settings.qrMenuHideUnavailable),
    [source, settings.qrMenuHideUnavailable]
  );

  const payload = useMemo(() => {
    if (mode === "free") return linkedMenuPayload(freeMenu, branding);
    if (mode === "premium") return premiumMenuPayload(source);
    return "";
  }, [mode, source, freeMenu, branding]);

  // Share the free menu with the QR Menu Generator, which shows its QR and lets
  // the owner set the tagline and colour but locks everything Free Dine owns.
  // Cleared the moment Free Dine stops owning it, so the tool becomes editable.
  useEffect(() => {
    if (mode === "free" && settings.qrMenuFreeCode && settings.qrMenuFreeEditToken) {
      const current = getPosMenuLink();
      const unchanged =
        current?.code === settings.qrMenuFreeCode &&
        current.editToken === settings.qrMenuFreeEditToken &&
        JSON.stringify(current.menu) === JSON.stringify(freeMenu);
      if (!unchanged) {
        setPosMenuLink({
          source: "free-dine",
          code: settings.qrMenuFreeCode,
          editToken: settings.qrMenuFreeEditToken,
          menu: freeMenu,
          updatedAt: new Date().toISOString(),
        });
      }
    } else {
      clearPosMenuLink();
    }
  }, [mode, settings.qrMenuFreeCode, settings.qrMenuFreeEditToken, freeMenu]);

  const upToDate = Boolean(target) && record?.target === target && record.payload === payload;

  const push = useCallback(async () => {
    if (!target || inFlight.current) return;
    inFlight.current = true;
    setState("syncing");
    try {
      let menuUrl: string | undefined;
      if (mode === "free") {
        await publishFreeMenu(payload, {
          code: settings.qrMenuFreeCode,
          editToken: settings.qrMenuFreeEditToken,
        });
      } else {
        const { pos } = await pushPremiumMenu(settings.qrMenuPremiumKey, payload);
        menuUrl = pos.menuUrl;
      }
      const next: SyncRecord = { target, payload, at: new Date().toISOString(), menuUrl };
      writeRecord(next);
      setRecord(next);
      setError(null);
      setState("synced");
    } catch (caught) {
      setError(caught instanceof QrSyncError ? caught : new QrSyncError("failed", String(caught)));
      setState("error");
    } finally {
      inFlight.current = false;
    }
  }, [mode, target, payload, settings.qrMenuFreeCode, settings.qrMenuFreeEditToken, settings.qrMenuPremiumKey]);

  // The automatic part: push a few seconds after the menu stops changing.
  useEffect(() => {
    if (!target) {
      setState("off");
      return;
    }
    if (upToDate) {
      setState("synced");
      return;
    }
    // A bad key or a lapsed plan will not fix itself; wait for the owner.
    if (error && (error.reason === "auth" || error.reason === "plan") && retryTick === 0) return;
    setState("pending");
    const timer = setTimeout(() => void push(), DEBOUNCE_MS);
    return () => clearTimeout(timer);
    // `error` is left out on purpose: a failure must not schedule its own retry
    // in a tight loop. Retries come from the next edit, reconnecting, or Update now.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [target, payload, upToDate, push, retryTick]);

  // Coming back online is the most common way a failed push gets unstuck.
  useEffect(() => {
    const onOnline = () => setRetryTick((tick) => tick + 1);
    window.addEventListener("online", onOnline);
    return () => window.removeEventListener("online", onOnline);
  }, []);

  const enableFree = useCallback(
    async ({ adoptExisting }: { adoptExisting: boolean }) => {
      let nextBranding = branding;
      if (adoptExisting && getPublishedMenu()) {
        // Keep the look of the QR that is already on the tables.
        try {
          const saved = JSON.parse(window.localStorage.getItem(FREE_TOOL_MENU_KEY) ?? "null");
          if (saved && typeof saved.accent === "string") {
            nextBranding = {
              tagline: typeof saved.tagline === "string" ? saved.tagline : "",
              accent: saved.accent || branding.accent,
            };
            setQrMenuBranding(nextBranding);
            setBranding(nextBranding);
          }
        } catch {
          // Unreadable: the default look is fine.
        }
      }
      const nextPayload = linkedMenuPayload(freeMenu, nextBranding);
      let published = settings.qrMenuFreeCode
        ? { code: settings.qrMenuFreeCode, editToken: settings.qrMenuFreeEditToken }
        : null;

      if (!published && adoptExisting) {
        const existing = getPublishedMenu();
        if (existing) published = { code: existing.code, editToken: existing.editToken };
      }

      const result = await publishFreeMenu(nextPayload, published);
      await updateSettings({
        qrMenuMode: "free",
        qrMenuFreeCode: result.code,
        qrMenuFreeEditToken: result.editToken,
      });
      if (adoptExisting) {
        // One writer per printed QR. Left in place, the QR Menu Generator would
        // keep offering to "Update" this code and overwrite the POS's menu.
        clearPublishedMenu();
        setExistingFreeCode(null);
      }
      const next: SyncRecord = {
        target: `free:${result.code}`,
        payload: nextPayload,
        at: new Date().toISOString(),
      };
      writeRecord(next);
      setRecord(next);
      setError(null);
    },
    [freeMenu, branding, settings.qrMenuFreeCode, settings.qrMenuFreeEditToken, updateSettings]
  );

  const enablePremium = useCallback(
    async (key: string) => {
      const trimmed = key.trim();
      const { pos } = await checkPremiumKey(trimmed);
      if (!pos.planActive) {
        throw new QrSyncError("plan", "Premium has ended on this QR Menu account. Redeem a license key in its Settings first.");
      }
      setError(null);
      setRetryTick(0);
      await updateSettings({ qrMenuMode: "premium", qrMenuPremiumKey: trimmed });
      // Remember the URL before the first push lands, so Settings can show it.
      setRecord((previous) =>
        previous ? { ...previous, menuUrl: pos.menuUrl } : { target: "", payload: "", at: "", menuUrl: pos.menuUrl }
      );
    },
    [updateSettings]
  );

  const disable = useCallback(async () => {
    // The free code and its token are kept: turning the sync back on later must
    // reach the same printed QR, not mint a new one.
    await updateSettings({ qrMenuMode: "off" });
    setError(null);
  }, [updateSettings]);

  const syncNow = useCallback(() => {
    setError(null);
    setRetryTick((tick) => tick + 1);
    void push();
  }, [push]);

  const menuUrl =
    mode === "free" && settings.qrMenuFreeCode && origin
      ? shortMenuUrl(settings.qrMenuFreeCode, origin)
      : mode === "premium"
        ? (record?.menuUrl ?? "")
        : "";

  const value: QrMenuSyncValue = {
    // The effect that marks a new change "pending" runs after the render that
    // carries it, so without this the card says "Up to date" for one frame.
    state: state === "synced" && !upToDate ? "pending" : state,
    lastSyncAt: record?.target === target && record.at ? record.at : null,
    error,
    menuUrl,
    existingFreeCode,
    enableFree,
    enablePremium,
    disable,
    syncNow,
  };

  return <QrMenuSyncContext.Provider value={value}>{children}</QrMenuSyncContext.Provider>;
}
