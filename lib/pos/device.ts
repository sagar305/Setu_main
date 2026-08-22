// What kind of device the POS is running on.
//
// Two things in the POS work differently on a phone or a tablet than on a
// counter PC: the camera can stand in for a barcode scanner, and printing has
// to go through a tab of its own because WebKit will not print a hidden
// iframe. Both ask the same question, so they ask it in one place.

/**
 * True on phones and tablets — a device whose primary pointer is a finger.
 * A touchscreen laptop driven by a mouse or trackpad reports a fine pointer
 * and counts as a desktop, which is what we want in both call sites.
 */
export function isHandheldDevice(): boolean {
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") return false;
  return window.matchMedia("(pointer: coarse)").matches;
}
