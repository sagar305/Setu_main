"use client";

// ---------------------------------------------------------------------------
// The one place the site listens.
//
// Mounted once in the root layout. It turns route changes into page views and
// every click on the page into an event, without any component having to know
// analytics exists.
// ---------------------------------------------------------------------------

import { Suspense, useEffect, useRef } from "react";
import { usePathname, useSearchParams } from "next/navigation";
import { useReportWebVitals } from "next/web-vitals";
import {
  flush,
  flushOnExit,
  resetCircuit,
  trackEvent,
  trackExitEvent,
  type EventProps,
} from "@/lib/analytics";
import { gaPageView } from "@/lib/analytics/ga";

const LABEL_ATTR = "data-analytics";
const LABEL_PREFIX = "data-analytics-";

/**
 * What counts as something a person clicked, when it carries no label of its
 * own. Everything else on the page is furniture.
 */
const CLICKABLE =
  'a, button, summary, [role="button"], [role="tab"], [role="menuitem"], input[type="submit"], input[type="button"]';

/** How often to try the queue while a tab sits open. */
const FLUSH_INTERVAL_MS = 30_000;

const SCROLL_MARKS = [25, 50, 75, 100] as const;

/**
 * The Core Web Vitals PostHog reads, by the names Next reports them under.
 * TTFB is reported too, but PostHog has nowhere to show it.
 */
const WEB_VITALS = new Set(["LCP", "INP", "CLS", "FCP"]);

/**
 * Props declared on the element as `data-analytics-*`.
 *
 * Only these attributes are read. Never `textContent`, never `value` — a
 * calculator's result and a POS line item are both text inside a clickable
 * element, and neither may leave the device. A button that wants a good name
 * declares one; it does not get one scraped off the screen.
 */
function declaredProps(element: Element): EventProps {
  const props: EventProps = {};
  for (const attribute of Array.from(element.attributes)) {
    if (!attribute.name.startsWith(LABEL_PREFIX)) continue;
    const key = attribute.name.slice(LABEL_PREFIX.length).replace(/-./g, (m) => m[1].toUpperCase());
    if (key) props[key] = attribute.value;
  }
  return props;
}

/** A link's destination, with the query string and fragment removed. */
function safeHref(element: Element): string | null {
  const raw = element.getAttribute("href");
  if (!raw) return null;
  try {
    const url = new URL(raw, window.location.origin);
    // The /menu and /view routes carry a whole document in the fragment, and a
    // query string can carry anything. Keep the shape of the destination only.
    return `${url.origin}${url.pathname}`;
  } catch {
    return null;
  }
}

/** An accessible name, from attributes a developer wrote rather than page content. */
function declaredName(element: Element): string {
  const label =
    element.getAttribute("aria-label") ??
    element.getAttribute("title") ??
    element.querySelector("img[alt]")?.getAttribute("alt") ??
    "";
  return label.slice(0, 80);
}

function isExternal(href: string): boolean {
  return !href.startsWith(window.location.origin);
}

/**
 * Work out what was clicked.
 *
 * The first entry of the composed path, not `event.target`: a click on a
 * button containing a Lucide icon lands on the `<path>` inside the `<svg>`,
 * and composedPath also stays correct for anything inside a shadow root.
 */
function resolveClick(event: MouseEvent): { name: string; props: EventProps } | null {
  const path = typeof event.composedPath === "function" ? event.composedPath() : [];
  const origin = (path[0] as Element | undefined) ?? (event.target as Element | null);
  if (!origin || typeof origin.closest !== "function") return null;

  const labelled = origin.closest(`[${LABEL_ATTR}]`);
  const target = labelled ?? origin.closest(CLICKABLE);
  if (!target) return null;

  const href = safeHref(target);
  const props: EventProps = {
    tag: target.tagName.toLowerCase(),
    ...(href ? { href, external: isExternal(href) } : {}),
    ...(declaredName(target) ? { label: declaredName(target) } : {}),
    // A middle- or modifier-click opens a new tab: the same intent, a
    // different outcome, and worth being able to tell apart.
    ...(event.type === "auxclick" || event.metaKey || event.ctrlKey ? { newTab: true } : {}),
  };

  if (labelled) {
    const name = labelled.getAttribute(LABEL_ATTR)?.trim();
    if (!name) return null;
    return { name, props: { ...props, ...declaredProps(labelled) } };
  }

  return { name: "element_clicked", props };
}

/**
 * Props for `$pageleave`, in PostHog's own names: without a leave event per
 * page view its bounce rate and session duration are guesses.
 */
function leaveProps(path: string, startedAt: number, maxScroll: number): EventProps {
  return {
    $prev_pageview_pathname: path,
    $prev_pageview_duration: Math.max(0, (Date.now() - startedAt) / 1000),
    $prev_pageview_max_scroll_percentage: maxScroll,
    $prev_pageview_max_content_percentage: maxScroll,
  };
}

/**
 * Page views.
 *
 * Split out and wrapped in Suspense by the provider because `useSearchParams`
 * opts the whole subtree into client-side rendering otherwise, which fails the
 * build for every statically rendered page on the site.
 */
function PageViews() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const lastPath = useRef<string | null>(null);
  const seenMarks = useRef<Set<number>>(new Set());
  // What the leave event reports about the page being left.
  const pageStartedAt = useRef(0);
  const maxScroll = useRef(0);
  const leaveSent = useRef(false);

  useEffect(() => {
    if (pathname === null || lastPath.current === pathname) return;

    // A client-side navigation leaves the previous page without unloading it.
    // The URL has already changed, so the leave names its page explicitly.
    const previous = lastPath.current;
    if (previous !== null && !leaveSent.current) {
      trackEvent("page_leave", leaveProps(previous, pageStartedAt.current, maxScroll.current), { path: previous });
    }

    lastPath.current = pathname;
    seenMarks.current = new Set();
    pageStartedAt.current = Date.now();
    maxScroll.current = 0;
    leaveSent.current = false;

    trackEvent("page_view", {
      // Only whether a query string existed, never what was in it.
      hasQuery: (searchParams?.toString().length ?? 0) > 0,
    });
    gaPageView(pathname);
  }, [pathname, searchParams]);

  // Leaving the site, closing the tab, or reloading.
  useEffect(() => {
    const onPageHide = () => {
      const path = lastPath.current;
      if (path === null || leaveSent.current) return;
      leaveSent.current = true;
      trackExitEvent("page_leave", leaveProps(path, pageStartedAt.current, maxScroll.current));
    };
    // Back from the back/forward cache: the same page view is live again.
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) leaveSent.current = false;
    };
    window.addEventListener("pagehide", onPageHide);
    window.addEventListener("pageshow", onPageShow);
    return () => {
      window.removeEventListener("pagehide", onPageHide);
      window.removeEventListener("pageshow", onPageShow);
    };
  }, []);

  // Scroll depth, once per mark per page.
  useEffect(() => {
    const onScroll = () => {
      const scrollable = document.documentElement.scrollHeight - window.innerHeight;
      if (scrollable <= 0) return;
      const fraction = Math.min(1, window.scrollY / scrollable);
      maxScroll.current = Math.max(maxScroll.current, fraction);
      const percent = (fraction * 100).toFixed(0);
      for (const mark of SCROLL_MARKS) {
        if (Number(percent) >= mark && !seenMarks.current.has(mark)) {
          seenMarks.current.add(mark);
          trackEvent("scroll_depth", { percent: mark });
        }
      }
    };
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return null;
}

/**
 * Core Web Vitals, one event per metric as the browser settles it.
 *
 * Next measures the initial load only; client-side navigations have no LCP of
 * their own. Numbers only — the metric's `entries` name DOM nodes and stay
 * here.
 */
function WebVitals() {
  useReportWebVitals((metric) => {
    const { name, value, rating } = metric;
    if (!WEB_VITALS.has(name)) return;
    trackEvent("web_vitals", {
      [`$web_vitals_${name}_value`]: value,
      [`$web_vitals_${name}_rating`]: rating,
    });
  });
  return null;
}

/** Clicks, errors, and the flush schedule. */
function Interactions() {
  useEffect(() => {
    /**
     * Capture phase, deliberately. A component calling `stopPropagation` in
     * its own handler would make a bubble-phase listener never fire, and the
     * review dialog's backdrop is already doing something close to that.
     * Capture runs before the target's own handlers, so nothing can hide.
     */
    const onClick = (event: Event) => {
      const resolved = resolveClick(event as MouseEvent);
      if (resolved) trackEvent(resolved.name, resolved.props);
    };

    document.addEventListener("click", onClick, { capture: true });
    // `auxclick` is a separate event: middle-click and cmd-click never fire
    // `click`, so without this every link opened in a background tab is
    // invisible.
    document.addEventListener("auxclick", onClick, { capture: true });

    return () => {
      document.removeEventListener("click", onClick, { capture: true });
      document.removeEventListener("auxclick", onClick, { capture: true });
    };
  }, []);

  useEffect(() => {
    const onError = (event: ErrorEvent) => {
      trackEvent("js_error", {
        // The message only. A stack trace can carry values from the frames it
        // unwound through.
        message: String(event.message).slice(0, 200),
      });
    };
    window.addEventListener("error", onError);
    return () => window.removeEventListener("error", onError);
  }, []);

  useEffect(() => {
    void flush();
    const timer = window.setInterval(() => void flush(), FLUSH_INTERVAL_MS);

    const onOnline = () => {
      // Being offline was never a failure, so the circuit starts clean.
      resetCircuit();
      void flush();
    };

    // A hidden tab may never come back. Beacon whatever is queued; nothing is
    // deleted, so anything that also arrives later is deduplicated server-side.
    const onHide = () => {
      if (document.visibilityState === "hidden") void flushOnExit();
    };

    window.addEventListener("online", onOnline);
    document.addEventListener("visibilitychange", onHide);
    window.addEventListener("pagehide", () => void flushOnExit());

    return () => {
      window.clearInterval(timer);
      window.removeEventListener("online", onOnline);
      document.removeEventListener("visibilitychange", onHide);
    };
  }, []);

  return null;
}

export function AnalyticsProvider() {
  return (
    <>
      <Suspense fallback={null}>
        <PageViews />
      </Suspense>
      <Interactions />
      <WebVitals />
    </>
  );
}
