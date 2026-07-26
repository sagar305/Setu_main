// ---------------------------------------------------------------------------
// Links to the premium QR Menu product.
//
// The dashboard is not live yet, so every "start now" link is routed through
// QR_MENU_APP_ENABLED. While it is off, visitors are sent to the product page
// (and from there to the demo) instead of a domain that does not resolve.
// Flip NEXT_PUBLIC_QR_MENU_APP_ENABLED to "true" on launch day.
//
// NEXT_PUBLIC_* values are inlined at build time, so changing one needs a
// rebuild, not just a restart.
// ---------------------------------------------------------------------------

export const QR_MENU_PRODUCT_PATH = "/products/qr-menu";

export const QR_MENU_DEMO_URL =
  process.env.NEXT_PUBLIC_QR_MENU_DEMO_URL || "https://demo.qr-menu.setutechnology.com/";

export const QR_MENU_APP_URL =
  process.env.NEXT_PUBLIC_QR_MENU_APP_URL || "https://app.qr-menu.setutechnology.com/";

/** Whether the real app is reachable. Off by default until launch. */
export const QR_MENU_APP_ENABLED = process.env.NEXT_PUBLIC_QR_MENU_APP_ENABLED === "true";

/**
 * Where a "get started" button should go right now: the app once it is live,
 * the product page while it is not.
 */
export const QR_MENU_SIGNUP_URL = QR_MENU_APP_ENABLED
  ? `${QR_MENU_APP_URL.replace(/\/+$/, "")}/signup`
  : QR_MENU_PRODUCT_PATH;

export const QR_MENU_SIGNUP_LABEL = QR_MENU_APP_ENABLED
  ? "Create your account"
  : "See how it works";
