// The published-menu record for the QR Menu Generator.
//
// Publishing is optional. Without it the whole menu lives inside the QR code
// exactly as before: no server, no size beyond what a QR can hold, and a
// printed code that has to be reprinted whenever a price changes.
//
// Publishing swaps that for a ten-character code. The printed QR then points at
// /menu/<code> and never has to be reprinted again — updating the menu repoints
// the code. The price is a dependency on the network, both for the restaurant
// and for the diner scanning the table.
//
// The editToken is the only proof of ownership. It is NOT the public code —
// that one is printed on every table, so anyone who scanned a menu would be
// able to rewrite it. There is no login and no recovery: clearing this
// browser's storage means the printed QR can never be updated again.

export type PublishedMenu = {
  code: string;
  editToken: string;
  /** The exact payload behind `code`, so unsaved edits can be detected. */
  payload: string;
  publishedAt: string;
};

const KEY = "setu-qr-menu-published-v1";

export function getPublishedMenu(): PublishedMenu | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as Partial<PublishedMenu>;
    if (!parsed?.code || !parsed.editToken || typeof parsed.payload !== "string") return null;
    return parsed as PublishedMenu;
  } catch {
    return null;
  }
}

export function setPublishedMenu(record: PublishedMenu): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(KEY, JSON.stringify(record));
  } catch {
    // Storage full or blocked. The menu is published and the QR works, but this
    // browser has just lost the ability to update it — the UI says so.
  }
}

export function clearPublishedMenu(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(KEY);
  } catch {
    // Nothing to do; the record simply stays.
  }
}
