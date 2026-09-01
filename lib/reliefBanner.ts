// ---------------------------------------------------------------------------
// The Nepal flood relief banner: whether it shows, and for how long.
//
// Three env vars drive it, all optional:
//
//   NEXT_PUBLIC_NEPAL_BANNER_ENABLED   on unless explicitly "false"
//   NEXT_PUBLIC_NEPAL_BANNER_START     don't show before this date
//   NEXT_PUBLIC_NEPAL_BANNER_END       don't show after this date
//
// NEXT_PUBLIC_* values are inlined at build time, so changing one needs a
// rebuild, not just a restart. The *dates*, though, are compared in the
// browser against the visitor's clock — see isBannerVisible below. That
// matters because almost every page here is prerendered: if the window were
// evaluated during `next build`, an end date would never arrive on its own and
// the banner would sit there until someone happened to redeploy.
// ---------------------------------------------------------------------------

/** Where "Donate" points: the Government of Nepal's official relief portal. */
export const NEPAL_DONATE_URL = "https://donate.gov.np";

/** Off only when explicitly disabled, so the banner works with no config. */
export const NEPAL_BANNER_ENABLED = process.env.NEXT_PUBLIC_NEPAL_BANNER_ENABLED !== "false";

export const NEPAL_BANNER_START = process.env.NEXT_PUBLIC_NEPAL_BANNER_START;
export const NEPAL_BANNER_END = process.env.NEXT_PUBLIC_NEPAL_BANNER_END;

const BARE_DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY_MS = 24 * 60 * 60 * 1000;

/**
 * Parse a schedule bound into a timestamp.
 *
 * A bare "2026-10-31" is read as UTC midnight. For an end date that would cut
 * the banner at the *start* of the 31st, which is not what "run it until the
 * 31st" means to anyone writing it, so bare end dates get the whole day.
 * A full ISO timestamp ("2026-10-31T18:30:00Z") is always taken literally.
 *
 * Returns null for anything unparseable — a typo drops the bound rather than
 * blanking the banner, and says so in development.
 */
export function parseBound(
  value: string | undefined,
  edge: "start" | "end",
): number | null {
  const raw = value?.trim();
  if (!raw) return null;

  const ms = Date.parse(raw);
  if (Number.isNaN(ms)) {
    if (process.env.NODE_ENV !== "production") {
      console.warn(
        `[relief banner] Ignoring unparseable ${edge} date ${JSON.stringify(raw)}. ` +
          `Use YYYY-MM-DD or a full ISO timestamp.`,
      );
    }
    return null;
  }

  return edge === "end" && BARE_DATE.test(raw) ? ms + DAY_MS : ms;
}

export type BannerSchedule = {
  enabled?: boolean;
  start?: string;
  end?: string;
};

/**
 * Whether the banner should be on screen at `now`. Pure on purpose: the
 * component passes the browser's clock in, and the tests pass fixed dates.
 */
export function isBannerVisible(now: Date, schedule: BannerSchedule = {}): boolean {
  const { enabled = NEPAL_BANNER_ENABLED, start = NEPAL_BANNER_START, end = NEPAL_BANNER_END } =
    schedule;

  if (!enabled) return false;

  const at = now.getTime();
  const from = parseBound(start, "start");
  const until = parseBound(end, "end");

  if (from !== null && at < from) return false;
  if (until !== null && at >= until) return false;
  return true;
}
