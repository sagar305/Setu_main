// Build-time feature flags.
//
// One purpose: let a finished product sit on main, fully merged and fully
// tested, without appearing on the live site until we say so. A branch that
// waits weeks for a launch date rots — it drifts from main, its conflicts
// compound, and the longer it waits the less anyone wants to merge it.
//
// These are read at build time and never at request time, so a flagged-off
// page is not a page that renders and hides itself: it is a 404 baked into the
// output, with nothing in the sitemap pointing at it and no JavaScript in the
// bundle mentioning it. That is also the limit — flipping one on means a
// redeploy, and there is no per-visitor preview on the production domain.
// Vercel's preview deployments are where the unreleased thing is looked at.
//
// Server-only, deliberately: no NEXT_PUBLIC_ prefix, so what we have not
// launched is not readable from a browser.

/** A flag is off unless it is explicitly the string "true". */
function enabled(value: string | undefined): boolean {
  return value === "true";
}

/**
 * The Free Token System (/products/free-token-system) and its two companion
 * routes.
 *
 * Off in production until launch. Set TOKEN_SYSTEM_ENABLED=true in Vercel's
 * Preview and Development environments to work on it; add it to Production and
 * redeploy to launch. Changing the value alone does nothing — the flag is
 * inlined at build time, so the redeploy is what ships it.
 *
 * Five places read this, and they have to agree: the three routes, the
 * sitemap, the products page (its rendered list and its ItemList schema), and
 * the toolkit registry. A route that 404s while the sitemap still advertises
 * it is worse than either state on its own.
 */
export function tokenSystemEnabled(): boolean {
  return enabled(process.env.TOKEN_SYSTEM_ENABLED);
}

/**
 * The Free Rental & Hire Book (/products/free-rental-software).
 *
 * Off in production until launch. Set RENTAL_SOFTWARE_ENABLED=true in Vercel's
 * Preview and Development environments to work on it; add it to Production and
 * redeploy to launch. Changing the value alone does nothing — the flag is
 * inlined at build time, so the redeploy is what ships it.
 *
 * Four places read this, and they have to agree: the route, the sitemap, the
 * products page (its rendered list and its ItemList schema), and the toolkit
 * registry.
 */
export function rentalSoftwareEnabled(): boolean {
  return enabled(process.env.RENTAL_SOFTWARE_ENABLED);
}

/**
 * The Free Pharmacy POS (/products/free-pharmacy-software).
 *
 * Off in production until launch. Set PHARMACY_SOFTWARE_ENABLED=true in
 * Vercel's Preview and Development environments to work on it; add it to
 * Production and redeploy to launch. Changing the value alone does nothing —
 * the flag is inlined at build time, so the redeploy is what ships it.
 *
 * This one has a second reason to stay flagged. The app prints a
 * scheduled-sales register and sits closer to regulated territory than anything
 * else on the site, so the disclaimers on the marketing page, in the app and on
 * the printed register should be read by someone who knows the Drugs and
 * Cosmetics Rules before it is switched on.
 *
 * Four places read this, and they have to agree: the route, the sitemap, the
 * products page (its rendered list and its ItemList schema), and the toolkit
 * registry.
 */
export function pharmacySoftwareEnabled(): boolean {
  return enabled(process.env.PHARMACY_SOFTWARE_ENABLED);
}

/**
 * The Free Repair Job Card (/products/free-repair-shop-software).
 *
 * Off in production until launch. Set REPAIR_SOFTWARE_ENABLED=true in Vercel's
 * Preview and Development environments to work on it; add it to Production and
 * redeploy to launch. Changing the value alone does nothing — the flag is
 * inlined at build time, so the redeploy is what ships it.
 *
 * This one has a second reason to wait. The app's whole promise is that its
 * intake record settles disputes, and the terms printed on the job slip — the
 * data-loss disclaimer, the ninety-day disposal line — should be read by
 * someone who knows what a shop can actually hold a customer to before it is
 * switched on.
 *
 * Four places read this, and they have to agree: the route, the sitemap, the
 * products page (its rendered list and its ItemList schema), and the toolkit
 * registry.
 */
export function repairSoftwareEnabled(): boolean {
  return enabled(process.env.REPAIR_SOFTWARE_ENABLED);
}

/**
 * Buying Setu QR Menu time: the Buy button and buy box on /products/qr-menu,
 * the /products/qr-menu/payment return page, and the /api/qr-menu/* checkout,
 * order, region and both webhook routes.
 *
 * Off unless "true". When off the page shows no way to pay, the return page
 * 404s and the API routes answer 404 — so nothing can be charged even if
 * Cashfree or PayPal keys are present. Set QR_MENU_PAYMENTS_ENABLED=true (with
 * the Cashfree keys and QR_MENU_LICENSE_SECRET) and redeploy to start selling.
 * The pages read it at build time; the API routes at request time.
 */
export function qrMenuPaymentsEnabled(): boolean {
  return enabled(process.env.QR_MENU_PAYMENTS_ENABLED);
}

/**
 * Charging buyers outside India in US dollars, through PayPal.
 *
 * Off unless "true", and then everyone pays the Indian (INR) price through
 * Cashfree. On, buyers outside India pay the INTL price through PayPal — but
 * only once PAYPAL_CLIENT_ID and PAYPAL_CLIENT_SECRET are set too (see
 * usdCheckoutEnabled in lib/qrMenuPaymentsGate.ts). Indian buyers always pay
 * through Cashfree.
 *
 * Read at request time by the /api/qr-menu routes, so changing it needs no
 * rebuild — but redeploy anyway so every instance picks it up.
 */
export function qrMenuUsdEnabled(): boolean {
  return enabled(process.env.QR_MENU_USD_ENABLED);
}
