// ---------------------------------------------------------------------------
// The GA4 bridge.
//
// GA4 stays for continuity — it holds the site's history and its console is
// already part of how the business looks at traffic. But its default install
// fires exactly one page view, on the first hard load. Every `<Link>`
// navigation after that is a `history.pushState` that GA4 only notices if an
// Enhanced Measurement toggle happens to be on in the console, and even then
// it can double-count against the initial load.
//
// So the tag is configured with `send_page_view: false` in the layout and page
// views are fired from here instead: one per route change, no console toggle
// to forget, and the same count the first-party pipeline sees.
// ---------------------------------------------------------------------------

type Gtag = (command: string, ...args: unknown[]) => void;

export const GA_MEASUREMENT_ID = "G-0FTL28EE7E";

function gtag(): Gtag | null {
  if (typeof window === "undefined") return null;
  const fn = (window as unknown as { gtag?: Gtag }).gtag;
  return typeof fn === "function" ? fn : null;
}

/** Tell GA4 about a route change. */
export function gaPageView(path: string): void {
  gtag()?.("event", "page_view", {
    page_path: path,
    page_location: window.location.href,
    page_title: document.title,
  });
}

/**
 * Mirror an event into GA4.
 *
 * Only the handful worth having in both places — conversions and the review
 * funnel. Sending everything would duplicate the whole stream into a tool
 * whose data model is a poor fit for it.
 */
export function gaEvent(name: string, props: Record<string, string | number | boolean>): void {
  gtag()?.("event", name, props);
}
