"use client";

import { useEffect, useRef, useState } from "react";

type AppStatus = "loading" | "welcome" | "setup" | "ready" | "error";

/**
 * Opens a free app straight into its full-screen view for someone who set it
 * up on an earlier visit, so a shop that uses it every day lands on the
 * counter rather than the product page around it.
 *
 * Decided once, on the first status the store settles on: only a visit that
 * opens already "ready" counts. Someone finishing setup right now stays where
 * they are, and leaving full screen is not undone by a later status change.
 *
 * Only the in-page view is opened. Browsers allow their own fullscreen only
 * from a click, so that part stays on the button.
 */
export function useAutoFullscreen(status: AppStatus, enter: () => void) {
  const decided = useRef(false);
  useEffect(() => {
    if (decided.current || status === "loading") return;
    decided.current = true;
    if (status === "ready") enter();
  }, [status, enter]);
}

/**
 * Full-screen state for a free app: the in-page view that covers the site,
 * plus the browser's own fullscreen where it is allowed. Opens by itself for a
 * returning user — see useAutoFullscreen.
 */
export function useAppFullscreen(status: AppStatus) {
  const [fullscreen, setFullscreen] = useState(false);

  const toggleFullscreen = () => {
    const next = !fullscreen;
    setFullscreen(next);
    try {
      if (next) {
        document.documentElement.requestFullscreen?.()?.catch?.(() => {});
      } else if (document.fullscreenElement) {
        document.exitFullscreen?.()?.catch?.(() => {});
      }
    } catch {
      // Full screen is best-effort.
    }
  };

  useAutoFullscreen(status, () => setFullscreen(true));

  useEffect(() => {
    const onChange = () => {
      if (!document.fullscreenElement) setFullscreen(false);
    };
    document.addEventListener("fullscreenchange", onChange);
    return () => document.removeEventListener("fullscreenchange", onChange);
  }, []);

  useEffect(() => {
    if (!fullscreen) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [fullscreen]);

  return { fullscreen, toggleFullscreen };
}
