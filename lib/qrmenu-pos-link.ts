// A free QR menu that Free Dine keeps up to date.
//
// When Free Dine publishes its menu through the free QR Menu Generator's
// permanent link, the two tools share one printed QR and have to agree on who
// owns what:
//
// - Free Dine owns the dishes, prices, restaurant name, phone and address. It
//   writes them here after every push, along with the code and edit token.
// - The QR Menu Generator owns the look: tagline and brand colour. It writes
//   those to the branding record and publishes them itself, so a colour change
//   reaches diners even when Free Dine is not open.
//
// Both sides publish `withBranding(link.menu, branding)`, so whichever one
// writes last, the diner sees the same menu. Both records live in this
// browser's localStorage — the same place each tool already keeps its own
// edit token — and nothing about them is sent anywhere but the shortener.

import { encodeMenu, type QrMenuData } from "./qrmenu";

export type PosMenuLink = {
  source: "free-dine";
  code: string;
  editToken: string;
  /** The menu as Free Dine last published it, before branding is applied. */
  menu: QrMenuData;
  updatedAt: string;
};

export type QrMenuBranding = { tagline: string; accent: string };

const LINK_KEY = "setu-qr-menu-pos-link-v1";
const BRANDING_KEY = "setu-qr-menu-pos-branding-v1";
/** Same-tab notification; other tabs hear the browser's own `storage` event. */
const CHANGE_EVENT = "setu-qr-menu-pos-link-change";

export const DEFAULT_BRANDING: QrMenuBranding = { tagline: "", accent: "#26306B" };

function read<T>(key: string): T | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(key);
    return raw ? (JSON.parse(raw) as T) : null;
  } catch {
    return null;
  }
}

function write(key: string, value: unknown): void {
  if (typeof window === "undefined") return;
  try {
    if (value === null) window.localStorage.removeItem(key);
    else window.localStorage.setItem(key, JSON.stringify(value));
    window.dispatchEvent(new Event(CHANGE_EVENT));
  } catch {
    // Storage blocked: each tool still works on its own, they just stop sharing.
  }
}

export function getPosMenuLink(): PosMenuLink | null {
  const link = read<PosMenuLink>(LINK_KEY);
  if (!link?.code || !link.editToken || !Array.isArray(link.menu?.categories)) return null;
  return link;
}

export function setPosMenuLink(link: PosMenuLink): void {
  write(LINK_KEY, link);
}

export function clearPosMenuLink(): void {
  if (read(LINK_KEY) !== null) write(LINK_KEY, null);
}

export function getQrMenuBranding(): QrMenuBranding {
  const stored = read<Partial<QrMenuBranding>>(BRANDING_KEY);
  return {
    tagline: typeof stored?.tagline === "string" ? stored.tagline : DEFAULT_BRANDING.tagline,
    accent: typeof stored?.accent === "string" && stored.accent ? stored.accent : DEFAULT_BRANDING.accent,
  };
}

export function setQrMenuBranding(branding: QrMenuBranding): void {
  write(BRANDING_KEY, branding);
}

export function withBranding(menu: QrMenuData, branding: QrMenuBranding): QrMenuData {
  return { ...menu, tagline: branding.tagline.trim().slice(0, 100), accent: branding.accent };
}

/** The exact payload both tools publish for a linked menu. */
export function linkedMenuPayload(menu: QrMenuData, branding: QrMenuBranding): string {
  return encodeMenu(withBranding(menu, branding));
}

/** Calls `handler` whenever either record changes, in this tab or another. */
export function subscribePosMenuLink(handler: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  const onStorage = (event: StorageEvent) => {
    if (event.key === LINK_KEY || event.key === BRANDING_KEY || event.key === null) handler();
  };
  window.addEventListener("storage", onStorage);
  window.addEventListener(CHANGE_EVENT, handler);
  return () => {
    window.removeEventListener("storage", onStorage);
    window.removeEventListener(CHANGE_EVENT, handler);
  };
}
