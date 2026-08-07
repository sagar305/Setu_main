// ---------------------------------------------------------------------------
// Links to the premium QR Menu product.
//
// Every "start now" link is routed through QR_MENU_APP_ENABLED, which is on by
// default. Setting NEXT_PUBLIC_QR_MENU_APP_ENABLED to "false" sends visitors to
// the product page instead — useful if the app ever needs to be taken down
// without shipping a code change.
//
// NEXT_PUBLIC_* values are inlined at build time, so changing one needs a
// rebuild, not just a restart.
// ---------------------------------------------------------------------------

export const QR_MENU_PRODUCT_PATH = "/products/qr-menu";

export const QR_MENU_DEMO_URL =
  process.env.NEXT_PUBLIC_QR_MENU_DEMO_URL || "https://demo.qr-menu.setutechnology.com/";

export const QR_MENU_APP_URL =
  process.env.NEXT_PUBLIC_QR_MENU_APP_URL || "https://app.qr-menu.setutechnology.com/";

/** Whether the app is reachable. Only an explicit "false" turns it off. */
export const QR_MENU_APP_ENABLED = process.env.NEXT_PUBLIC_QR_MENU_APP_ENABLED !== "false";

/**
 * Where a "get started" button should go: the app's signup screen, or the
 * product page while the app is switched off.
 */
export const QR_MENU_SIGNUP_URL = QR_MENU_APP_ENABLED
  ? `${QR_MENU_APP_URL.replace(/\/+$/, "")}/signup`
  : QR_MENU_PRODUCT_PATH;

export const QR_MENU_SIGNUP_LABEL = QR_MENU_APP_ENABLED
  ? "Create your account — free for a year"
  : "See how it works";

/** Drives whether the CTA renders as an <a> or a Next <Link>. */
export const QR_MENU_SIGNUP_IS_EXTERNAL = /^https?:\/\//.test(QR_MENU_SIGNUP_URL);
