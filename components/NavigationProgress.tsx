"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { usePathname, useSearchParams } from "next/navigation";

/**
 * A thin bar across the top of the page between clicking an internal link and
 * the next page appearing.
 *
 * Links are not prefetched everywhere (to keep CDN and ISR usage down), so a
 * click can take a moment to fetch the next page. Without this the page looks
 * frozen for that moment; with it the click is visibly acknowledged at once.
 *
 * It starts from a document-level click on any same-origin link and finishes
 * when the pathname or query string changes. It never blocks anything: links
 * that turn out not to navigate are covered by a timeout.
 */
export function NavigationProgress() {
  return (
    // useSearchParams would otherwise opt every static page into client
    // rendering — see AnalyticsProvider.
    <Suspense fallback={null}>
      <ProgressBar />
    </Suspense>
  );
}

/** Gives up on a navigation that never completes, e.g. a link that was cancelled. */
const GIVE_UP_MS = 10_000;

function ProgressBar() {
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const [progress, setProgress] = useState<number | null>(null);
  const trickle = useRef<number | undefined>(undefined);
  const giveUp = useRef<number | undefined>(undefined);
  const hide = useRef<number | undefined>(undefined);

  const clearTimers = () => {
    window.clearInterval(trickle.current);
    window.clearTimeout(giveUp.current);
    window.clearTimeout(hide.current);
  };

  const finish = () => {
    clearTimers();
    setProgress((value) => (value === null ? null : 100));
    hide.current = window.setTimeout(() => setProgress(null), 250);
  };

  useEffect(() => {
    const onClick = (event: MouseEvent) => {
      if (event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) {
        return;
      }
      const anchor = (event.target as Element | null)?.closest?.("a");
      if (!anchor || anchor.hasAttribute("download")) return;
      if (anchor.target && anchor.target !== "_self") return;

      const href = anchor.getAttribute("href");
      if (!href || href.startsWith("#")) return;
      const url = new URL(anchor.href, window.location.href);
      if (url.origin !== window.location.origin) return;
      // Same page, or only the #fragment differs: nothing to load.
      if (url.pathname === window.location.pathname && url.search === window.location.search) {
        return;
      }

      clearTimers();
      setProgress(15);
      // Creep towards 90% while waiting; the real end comes from the route change.
      trickle.current = window.setInterval(() => {
        setProgress((value) => (value === null ? null : value + (90 - value) * 0.1));
      }, 200);
      giveUp.current = window.setTimeout(finish, GIVE_UP_MS);
    };

    document.addEventListener("click", onClick);
    return () => {
      document.removeEventListener("click", onClick);
      clearTimers();
    };
    // finish and clearTimers only touch refs and state setters.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // The new page is on screen.
  useEffect(() => {
    finish();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pathname, searchParams]);

  if (progress === null) return null;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full bg-saffron shadow-[0_0_8px_rgba(0,0,0,0.15)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}
