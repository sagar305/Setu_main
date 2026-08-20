// The three looks the waiting-room display can wear.
//
// Plain hex rather than Tailwind classes, because this screen is the one place
// on the site that is not read at arm's length. It is a 55" TV across a room,
// or a 15" monitor on a wall, and the contrast it needs is decided by the room
// rather than by the site's palette. High contrast in particular is
// deliberately outside the brand: pure black behind pure white, with the
// accent in amber, because a cheap panel in daylight loses everything else.

import type { QueueTheme } from "@/lib/queue/types";

export type DisplayPalette = {
  background: string;
  panel: string;
  text: string;
  muted: string;
  accent: string;
  line: string;
  flash: string;
};

export const DISPLAY_PALETTES: Record<QueueTheme, DisplayPalette> = {
  light: {
    background: "#F2EFE7",
    panel: "#FFFFFF",
    text: "#0E1124",
    muted: "#5F6478",
    accent: "#26306B",
    line: "rgba(183, 174, 153, 0.35)",
    flash: "rgba(38, 48, 107, 0.16)",
  },
  dark: {
    background: "#0E1124",
    panel: "#181C33",
    text: "#FFFFFF",
    muted: "#9BA0B5",
    accent: "#F2A03D",
    line: "rgba(255, 255, 255, 0.12)",
    flash: "rgba(242, 160, 61, 0.22)",
  },
  "high-contrast": {
    background: "#000000",
    panel: "#000000",
    text: "#FFFFFF",
    muted: "#FFFFFF",
    accent: "#FFD400",
    line: "#FFFFFF",
    flash: "rgba(255, 212, 0, 0.35)",
  },
};

/**
 * The size of the number being called.
 *
 * `clamp` rather than a breakpoint, because this screen has no idea what it is
 * on: the same markup has to fill a 55" TV and a 15" monitor, and there is
 * nobody standing there to adjust it. 22vw keeps it proportional to whatever
 * it landed on; the floor stops it collapsing on a phone held sideways to
 * check the queue, and the ceiling stops it overflowing a very wide screen.
 */
export const TOKEN_CLAMP = "clamp(4rem, 22vw, 20rem)";
export const COUNTER_CLAMP = "clamp(1.5rem, 5vw, 4.5rem)";
export const TITLE_CLAMP = "clamp(1rem, 2.6vw, 2.25rem)";
export const NEXT_CLAMP = "clamp(1.25rem, 3.4vw, 3rem)";
export const RECENT_CLAMP = "clamp(1.1rem, 2.8vw, 2.5rem)";
export const TICKER_CLAMP = "clamp(0.9rem, 2vw, 1.75rem)";
