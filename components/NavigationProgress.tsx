"use client";

import { Suspense, useEffect, useRef, useState, type CSSProperties } from "react";
import { usePathname, useSearchParams } from "next/navigation";
// TEMPORARY — DIWALI 2026: remove after Diwali, see lib/festive.ts.
import { currentFestival, type Festival } from "@/lib/festive";

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
  // TEMPORARY — DIWALI 2026: remove after Diwali. Checked per navigation.
  const [festival, setFestival] = useState<Festival | null>(null);
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
    // TEMPORARY — DIWALI 2026: leave time for the crackers to go off. After Diwali put back
    // `window.setTimeout(() => setProgress(null), 250)`.
    hide.current = window.setTimeout(() => setProgress(null), currentFestival() ? 700 : 250);
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
      setFestival(currentFestival()); // TEMPORARY — DIWALI 2026: remove after Diwali.
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

  // TEMPORARY — DIWALI 2026: remove after Diwali.
  if (festival === "diwali") return <DiwaliBar progress={progress} />;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      <div
        className="h-full bg-saffron shadow-[0_0_8px_rgba(0,0,0,0.15)] transition-[width] duration-200 ease-out"
        style={{ width: `${progress}%` }}
      />
    </div>
  );
}

/* ---------------------------------------------------------------------------
 * TEMPORARY — DIWALI 2026. Remove after Diwali (after 13 Nov 2026), together
 * with lib/festive.ts and the Diwali block in app/globals.css.
 *
 * Diwali: the bar is a phuljhadi (sparkler) fuse burning across the top, and a
 * ladi of small crackers pops along it when the page arrives. Pure CSS
 * animation (keyframes in globals.css), switched off by reduced motion.
 * ------------------------------------------------------------------------- */

const SPARK_COLOURS = ["#FFE08A", "#FFC24B", "#FFFFFF", "#F2A03D"];
const BURST_COLOURS = ["#FFD36E", "#FF5E7E", "#7CE38B", "#6EC8FF", "#F2A03D", "#FFFFFF"];

/** Sparks thrown off the burning tip: [dx, dy, delay ms]. Fixed, so renders match. */
const SPARKS: [number, number, number][] = [
  [-14, 10, 0], [12, 14, 60], [-6, 18, 120], [16, 6, 180], [-18, 4, 240],
  [4, 20, 300], [10, -4, 360], [-10, -2, 420], [18, 16, 90], [-16, 14, 270],
];

/** Where crackers go off along the bar when it completes, as % of width. */
const BURSTS = [18, 46, 74, 94];
const BURST_PARTICLES = 12;

function DiwaliBar({ progress }: { progress: number }) {
  const done = progress >= 100;

  return (
    <div aria-hidden="true" className="pointer-events-none fixed inset-x-0 top-0 z-[100] h-[3px]">
      {/* The fuse: burnt ember at the start, glowing gold at the tip. */}
      <div
        className="relative h-full transition-[width] duration-200 ease-out"
        style={{
          width: `${progress}%`,
          background: "linear-gradient(90deg, #8A2E0B 0%, #E2622B 35%, #F2A03D 75%, #FFE08A 100%)",
          boxShadow: "0 0 10px rgba(242, 160, 61, 0.7)",
        }}
      >
        {!done && (
          <span className="diwali-tip absolute right-0 top-1/2">
            {SPARKS.map(([dx, dy, delay], i) => (
              <span
                key={i}
                className="diwali-spark"
                style={
                  {
                    "--dx": `${dx}px`,
                    "--dy": `${dy}px`,
                    animationDelay: `${delay}ms`,
                    background: SPARK_COLOURS[i % SPARK_COLOURS.length],
                    color: SPARK_COLOURS[i % SPARK_COLOURS.length],
                  } as CSSProperties
                }
              />
            ))}
          </span>
        )}
      </div>

      {done &&
        BURSTS.map((left, b) => (
          <span
            key={b}
            className="absolute top-[2px]"
            style={{ left: `${left}%` }}
          >
            <span className="diwali-flash" style={{ animationDelay: `${b * 90}ms` }} />
            {Array.from({ length: BURST_PARTICLES }, (_, i) => {
              // Mostly downwards, since the top of the screen is just above.
              const angle = (Math.PI * (i + 0.5)) / BURST_PARTICLES - Math.PI * 0.05;
              const distance = 22 + ((i * 7 + b * 5) % 14);
              return (
                <span
                  key={i}
                  className="diwali-burst"
                  style={
                    {
                      "--dx": `${Math.cos(angle) * distance}px`,
                      "--dy": `${Math.sin(angle) * distance}px`,
                      animationDelay: `${b * 90}ms`,
                      background: BURST_COLOURS[(i + b) % BURST_COLOURS.length],
                      color: BURST_COLOURS[(i + b) % BURST_COLOURS.length],
                    } as CSSProperties
                  }
                />
              );
            })}
          </span>
        ))}
    </div>
  );
}
