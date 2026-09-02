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
