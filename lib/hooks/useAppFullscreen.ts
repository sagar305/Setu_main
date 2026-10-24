"use client";

import { useEffect, useState } from "react";

/**
 * Full-screen state for a free app: the in-page view that covers the site,
 * plus the browser's own fullscreen where it is allowed. Opens only from the
 * button, never by itself.
 */
export function useAppFullscreen() {
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
