// TEMPORARY — DIWALI 2026. Remove after Diwali (after 13 Nov 2026).
// It switches itself off after the window below, but the code should go too.
// Every Diwali change carries the marker "TEMPORARY — DIWALI 2026", so
//   grep -rn "TEMPORARY — DIWALI 2026" app components lib
// lists all of it. To remove, delete this file, components/Diya.tsx and:
//   - app/layout.tsx: the FESTIVE_BOOT_SCRIPT <script> and suppressHydrationWarning
//   - components/NavigationProgress.tsx: DiwaliBar and its currentFestival state
//   - components/Logo.tsx: the diya and the "Happy Diwali!" wordmark
//   - components/ReviewBanner.tsx + lib/reviewBanner.ts: the Diwali greeting,
//     lights and diyas (the review ask comes back unchanged)
//   - app/globals.css: the Diwali block at the end, down to END TEMPORARY

/**
 * Festive windows: date ranges in which the site swaps in a seasonal touch.
 *
 * Pages are rendered ahead of time, so the date cannot be checked while
 * rendering without the page flashing from the normal look to the festive one.
 * Instead FESTIVE_BOOT_SCRIPT runs before the page paints and sets
 * <html data-festive="diwali">, and the festive parts are switched on with CSS
 * from that attribute — the same trick sites use for dark mode.
 *
 * Times are India Standard Time.
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
 * Inline script for the top of <body>. Sets data-festive on <html> when a
 * window is open. `?festive=diwali` forces it on and `?festive=off` forces it
 * off, for previewing; the choice is remembered for the tab.
 */
export const FESTIVE_BOOT_SCRIPT = `(function(){try{
var w=${JSON.stringify(WINDOWS)},n=Date.now(),f=null,q=null;
for(var i=0;i<w.length;i++){if(n>=Date.parse(w[i].start)&&n<Date.parse(w[i].end)){f=w[i].festival;break}}
try{q=new URLSearchParams(location.search).get("festive");if(q)sessionStorage.setItem("setu-festive",q);else q=sessionStorage.getItem("setu-festive")}catch(e){}
if(q==="diwali")f="diwali";else if(q==="off")f=null;
if(f)document.documentElement.setAttribute("data-festive",f);
}catch(e){}})();`;

/** The festival the boot script switched on for this page, or null. Client only. */
export function currentFestival(): Festival | null {
  if (typeof document === "undefined") return null;
  return document.documentElement.getAttribute("data-festive") === "diwali" ? "diwali" : null;
}
