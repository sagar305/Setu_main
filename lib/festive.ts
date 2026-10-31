// TEMPORARY — DIWALI 2026. Remove after Diwali (after 13 Nov 2026).
// It switches itself off after the window below, but the code should go too.
// To remove: delete this file, the DiwaliBar part of
// components/NavigationProgress.tsx (and its currentFestival import/state),
// and the "Diwali top loader" block at the end of app/globals.css.

/**
 * Festive windows: date ranges in which the site swaps in a seasonal touch,
 * such as the Diwali "phuljhadi" top loader in components/NavigationProgress.
 *
 * Times are India Standard Time. Add next year's dates here when they are
 * known; nothing else needs to change.
 */

export type Festival = "diwali";

type FestiveWindow = {
  festival: Festival;
  /** Inclusive, ISO date-time with the +05:30 offset. */
  start: string;
  /** Exclusive, ISO date-time with the +05:30 offset. */
  end: string;
};

const WINDOWS: FestiveWindow[] = [
  // Diwali 2026 is on 8 Nov: Dhanteras 6 Nov, Bhai Dooj 10–11 Nov.
  { festival: "diwali", start: "2026-10-30T00:00:00+05:30", end: "2026-11-13T00:00:00+05:30" },
];

/**
 * The festival running right now, or null. `?festive=diwali` in the URL forces
 * it on, so the effect can be previewed outside the window.
 */
export function currentFestival(now: number = Date.now()): Festival | null {
  if (typeof window !== "undefined") {
    let forced = new URLSearchParams(window.location.search).get("festive");
    // Remember the override for the tab, since the next link drops the query.
    try {
      if (forced) window.sessionStorage.setItem("setu-festive", forced);
      else forced = window.sessionStorage.getItem("setu-festive");
    } catch {
      // Storage blocked: the override then lasts only for this URL.
    }
    if (forced === "diwali") return forced;
    if (forced === "off") return null;
  }
  const active = WINDOWS.find(
    (w) => now >= Date.parse(w.start) && now < Date.parse(w.end),
  );
  return active?.festival ?? null;
}
