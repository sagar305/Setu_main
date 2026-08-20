"use client";

// The waiting-room screen.
//
// Opened once on a TV or a second monitor and left running for a whole shift,
// with nobody watching it for faults. Three things follow from that and shape
// everything here:
//
//   * It must not grow. No accumulating lists, no timers that outlive what
//     they were for, no DOM that gets longer as the day goes on. The two
//     animations are pure CSS.
//   * It must not overflow. The layout is a fixed three-row grid and every
//     type size is a clamp(), so the same markup fills a 55" TV and a 15"
//     monitor without a breakpoint and without a scrollbar.
//   * It must not go quiet without saying so. Voice degrades to the chime,
//     the chime degrades to the flash, and the flash is CSS — so something
//     always changes on screen when a number is called, even on a smart TV
//     browser with no speech engine and no audio context.

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Maximize2, Volume2 } from "lucide-react";
import { QueueProvider, useQueue } from "@/lib/queue/store";
import { compareQueue, spokenToken } from "@/lib/queue/calc";
import { chimeSupported, chooseVoice, loadVoices, playChime, speakAnnouncement, speechSupported, unlockAudio } from "@/lib/queue/voice";
import { tokenLabel, type Token } from "@/lib/queue/types";
import {
  COUNTER_CLAMP,
  DISPLAY_PALETTES,
  NEXT_CLAMP,
  RECENT_CLAMP,
  TICKER_CLAMP,
  TITLE_CLAMP,
  TOKEN_CLAMP,
} from "./theme";

/** How many previously called tokens stay on screen under the big one. */
const RECENT_COUNT = 3;

/** A ticking wall clock, to the minute. */
function useClock(): string {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    // Aligned to the next minute rather than a 1s interval: this screen is on
    // for twelve hours, and there is no reason to wake it 43,000 times.
    let timer = 0;
    const schedule = () => {
      const at = new Date();
      const delay = (60 - at.getSeconds()) * 1000;
      timer = window.setTimeout(() => {
        setNow(new Date());
        schedule();
      }, delay);
    };
    schedule();
    return () => window.clearTimeout(timer);
  }, []);
  return now.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function DisplayBody() {
  const { status, errorMessage, settings, services, counters, todayTokens, business } = useQueue();
  const palette = DISPLAY_PALETTES[settings.theme];
  const clock = useClock();

  const [started, setStarted] = useState(false);
  const [wakeLockFailed, setWakeLockFailed] = useState(false);
  const [flashing, setFlashing] = useState(false);
  const [voices, setVoices] = useState<SpeechSynthesisVoice[]>([]);
  const rootRef = useRef<HTMLDivElement>(null);
  const flashTimer = useRef(0);

  useEffect(() => {
    void loadVoices().then(setVoices);
  }, []);

  /**
   * The card follows the most recent *call*, not the most recent Start serving.
   *
   * The display exists to tell the room who was just announced. If it followed
   * "serving", the number would change under the people watching it the moment
   * some other counter tapped a button, which is how somebody misses their turn.
   *
   * A served token still counts, which is what makes the number hold. A
   * physical token board does not go blank the second the clerk finishes with
   * someone — it keeps the last number up until there is a new one, and a
   * screen that empties itself between customers looks broken to the room.
   * A token that has gone back into the line is the one exception: it is
   * waiting again, so it is no longer the last thing that was called.
   */
  const nowServing = useMemo(() => {
    const called = todayTokens.filter(
      (token) =>
        token.calledAt &&
        (token.status === "called" || token.status === "serving" || token.status === "served")
    );
    return called.sort((a, b) => (a.calledAt! < b.calledAt! ? 1 : -1))[0] ?? null;
  }, [todayTokens]);

  const recent = useMemo(() => {
    return todayTokens
      .filter(
        (token) =>
          token.calledAt &&
          token.id !== nowServing?.id &&
          token.status !== "waiting" &&
          token.status !== "cancelled"
      )
      .sort((a, b) => (a.calledAt! < b.calledAt! ? 1 : -1))
      .slice(0, RECENT_COUNT);
  }, [todayTokens, nowServing]);

  const upNext = useMemo(() => {
    if (settings.showNextCount <= 0) return [];
    return todayTokens
      .filter((token) => token.status === "waiting")
      .sort(compareQueue)
      .slice(0, settings.showNextCount);
  }, [todayTokens, settings.showNextCount]);

  const serviceOf = useCallback(
    (token: Token | null) => (token ? services.find((row) => row.id === token.serviceId) : undefined),
    [services]
  );
  const counterOf = useCallback(
    (token: Token | null) => (token ? counters.find((row) => row.id === token.counterId) : undefined),
    [counters]
  );

  /**
   * Announce a call once.
   *
   * Keyed on the token id plus the moment it was called, so a *recall* — same
   * token, new time — announces again, which is the whole point of Recall.
   * The first value seen after the screen loads is recorded without announcing:
   * opening the display at 3pm should not shout a token called an hour ago.
   */
  const lastAnnouncedRef = useRef<string | null>(null);
  useEffect(() => {
    if (!nowServing?.calledAt) return;
    const key = `${nowServing.id}:${nowServing.calledAt}`;

    if (lastAnnouncedRef.current === null) {
      lastAnnouncedRef.current = key;
      return;
    }
    if (lastAnnouncedRef.current === key) return;
    lastAnnouncedRef.current = key;

    // The flash always runs. It is the one signal that needs neither a speech
    // engine nor an audio context, so it is what a cheap TV browser is left
    // with once the other two have failed.
    window.clearTimeout(flashTimer.current);
    setFlashing(true);
    flashTimer.current = window.setTimeout(() => setFlashing(false), 1300);

    if (!started) return;

    const service = services.find((row) => row.id === nowServing.serviceId);
    const counter = counters.find((row) => row.id === nowServing.counterId);
    if (settings.chimeEnabled) playChime(settings.chimeSound);
    if (settings.voiceEnabled) {
      speakAnnouncement(
        {
          template: settings.voiceTemplate,
          token: spokenToken(tokenLabel(nowServing, service)),
          counter: counter?.name ?? "",
          lang: settings.voiceLang,
          rate: settings.voiceRate,
          repeat: settings.announceRepeat,
        },
        chooseVoice(voices, settings.voiceLang).voice
      );
    }
  }, [nowServing, started, settings, services, counters, voices]);

  useEffect(() => () => window.clearTimeout(flashTimer.current), []);

  /**
   * Keep the screen awake.
   *
   * The lock is dropped whenever the tab is hidden and has to be retaken when
   * it comes back, which is why this re-acquires on visibilitychange rather
   * than asking once. Where the API does not exist at all — most TV browsers,
   * every iOS before 16.4 — the screen says so, because a display that goes
   * black at 3pm looks broken rather than asleep.
   */
  useEffect(() => {
    if (!started) return;
    type WakeLockSentinel = { release: () => Promise<void> };
    type WakeLockNavigator = Navigator & {
      wakeLock?: { request: (type: "screen") => Promise<WakeLockSentinel> };
    };
    const wakeLock = (navigator as WakeLockNavigator).wakeLock;
    if (!wakeLock) {
      setWakeLockFailed(true);
      return;
    }

    let sentinel: WakeLockSentinel | null = null;
    let cancelled = false;

    const acquire = async () => {
      try {
        sentinel = await wakeLock.request("screen");
        if (cancelled) void sentinel.release();
      } catch {
        setWakeLockFailed(true);
      }
    };

    const onVisibility = () => {
      if (document.visibilityState === "visible") void acquire();
    };

    void acquire();
    document.addEventListener("visibilitychange", onVisibility);
    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", onVisibility);
      void sentinel?.release().catch(() => {});
    };
  }, [started]);

  /**
   * Take the site's own header and footer out of play.
   *
   * The display covers them, but covering is not removing: their links stay in
   * the focus order, so a stray keyboard on a counter PC could Tab out of the
   * waiting-room screen and land on the marketing site. `inert` is what
   * actually removes a subtree from focus, clicks and the accessibility tree.
   */
  useEffect(() => {
    const root = rootRef.current;
    if (!root) return;
    const siblings = Array.from(document.body.children).filter(
      (node) => node !== root && !node.contains(root)
    ) as HTMLElement[];
    const previouslyInert = siblings.map((node) => node.hasAttribute("inert"));
    for (const node of siblings) node.setAttribute("inert", "");
    return () => {
      siblings.forEach((node, index) => {
        if (!previouslyInert[index]) node.removeAttribute("inert");
      });
    };
  }, [status]);

  const start = () => {
    unlockAudio();
    setStarted(true);
    try {
      void rootRef.current?.requestFullscreen?.();
    } catch {
      // Fullscreen is a nicety — some TV browsers refuse it outright.
    }
  };

  if (status === "loading") {
    return <FullScreenMessage palette={palette} message="Opening the queue…" />;
  }
  if (status === "error") {
    return <FullScreenMessage palette={palette} message={errorMessage} />;
  }
  if (status !== "ready") {
    return (
      <FullScreenMessage
        palette={palette}
        message="Set the queue up on the counter screen first, then open this display."
      />
    );
  }

  const service = serviceOf(nowServing);
  const counter = counterOf(nowServing);

  return (
    <div
      ref={rootRef}
      className="fixed inset-0 z-[60] flex flex-col overflow-hidden"
      style={{ backgroundColor: palette.background, color: palette.text }}
    >
      {/* Header: who we are, and the time. */}
      <header
        className="flex shrink-0 items-baseline justify-between gap-4 px-[3vw] pt-[2.5vh]"
        style={{ fontSize: TITLE_CLAMP }}
      >
        <h1 className="truncate font-bold tracking-tight">
          {settings.displayTitle || business?.name || "Now serving"}
        </h1>
        <span className="shrink-0 tabular-nums" style={{ color: palette.muted }}>
          {clock}
        </span>
      </header>

      {/* The number. Everything else on this screen is smaller than it.
          A section rather than a <main>: the site layout already owns the
          page's main landmark, and two of them leaves a screen reader with no
          single "skip to the content" target. */}
      <section
        data-queue-now-serving
        className={`flex min-h-0 flex-1 flex-col items-center justify-center px-[3vw] ${
          flashing ? "queue-flash" : ""
        }`}
        style={{ ["--queue-flash-colour" as string]: palette.flash }}
        aria-live="polite"
        aria-label="Now serving"
      >
        {nowServing ? (
          <>
            <p
              className="font-semibold uppercase tracking-[0.2em]"
              style={{ color: palette.muted, fontSize: TICKER_CLAMP }}
            >
              Now serving
            </p>
            <p
              className="font-extrabold leading-[0.9] tracking-tight"
              style={{ fontSize: TOKEN_CLAMP }}
            >
              {tokenLabel(nowServing, service)}
            </p>
            {counter && (
              <p className="font-bold" style={{ fontSize: COUNTER_CLAMP, color: palette.accent }}>
                {counter.name}
              </p>
            )}
            {service && (
              <p style={{ fontSize: TICKER_CLAMP, color: palette.muted }}>{service.name}</p>
            )}
          </>
        ) : (
          <p
            className="text-center font-semibold"
            style={{ fontSize: NEXT_CLAMP, color: palette.muted }}
          >
            Please wait — your number will appear here.
          </p>
        )}
      </section>

      {/* Recent calls and what is coming, side by side so neither can push the
          number off the screen. */}
      <section
        className="grid shrink-0 grid-cols-2 gap-[3vw] border-t px-[3vw] py-[2vh]"
        style={{ borderColor: palette.line }}
      >
        <div className="min-w-0">
          <p
            className="mb-[0.6vh] font-semibold uppercase tracking-[0.15em]"
            style={{ color: palette.muted, fontSize: TICKER_CLAMP }}
          >
            Just called
          </p>
          <div className="flex flex-wrap items-baseline gap-x-[2vw] gap-y-[0.5vh]">
            {recent.length === 0 ? (
              <span style={{ color: palette.muted, fontSize: RECENT_CLAMP }}>—</span>
            ) : (
              recent.map((token) => (
                <span key={token.id} className="font-bold" style={{ fontSize: RECENT_CLAMP }}>
                  {tokenLabel(token, serviceOf(token))}
                  <span
                    className="ml-[0.4em] font-semibold"
                    style={{ color: palette.muted, fontSize: "0.55em" }}
                  >
                    {counterOf(token)?.name ?? ""}
                  </span>
                </span>
              ))
            )}
          </div>
        </div>

        <div className="min-w-0">
          <p
            className="mb-[0.6vh] font-semibold uppercase tracking-[0.15em]"
            style={{ color: palette.muted, fontSize: TICKER_CLAMP }}
          >
            Next up
          </p>
          <div className="flex flex-wrap items-baseline gap-x-[2vw] gap-y-[0.5vh]">
            {upNext.length === 0 ? (
              <span style={{ color: palette.muted, fontSize: NEXT_CLAMP }}>—</span>
            ) : (
              upNext.map((token) => (
                <span key={token.id} className="font-bold" style={{ fontSize: NEXT_CLAMP }}>
                  {tokenLabel(token, serviceOf(token))}
                </span>
              ))
            )}
          </div>
        </div>
      </section>

      {settings.tickerText.trim() && (
        <div
          className="shrink-0 overflow-hidden border-t py-[1vh]"
          style={{ borderColor: palette.line, fontSize: TICKER_CLAMP, color: palette.muted }}
        >
          <span className="queue-ticker-track">{settings.tickerText}</span>
        </div>
      )}

      {/* The one interaction on the screen, and it disappears after it is used.
          Browsers will not make a sound until the page has been touched, and a
          display nobody has touched is a display that never announces. */}
      {!started && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black/70 p-6 text-center">
          <p className="max-w-md text-lg font-semibold text-white">
            Tap once to let this screen make a sound, and to fill the display.
          </p>
          <button
            type="button"
            onClick={start}
            className="inline-flex items-center gap-2 rounded-xl bg-white px-6 py-4 text-lg font-bold text-ink"
          >
            <Volume2 className="h-5 w-5" aria-hidden="true" />
            Start the display
          </button>
          <p className="max-w-md text-sm text-white/80">
            {speechSupported()
              ? "Numbers will be called out loud."
              : chimeSupported()
                ? "This browser cannot speak — it will chime and flash instead."
                : "This browser has no sound — the screen will flash on every call."}
          </p>
        </div>
      )}

      {started && wakeLockFailed && (
        <p
          className="pointer-events-none absolute bottom-2 right-3 text-xs"
          style={{ color: palette.muted }}
        >
          <Maximize2 className="mr-1 inline h-3 w-3" aria-hidden="true" />
          This browser cannot keep the screen awake — set the display to never sleep.
        </p>
      )}
    </div>
  );
}

function FullScreenMessage({
  palette,
  message,
}: {
  palette: (typeof DISPLAY_PALETTES)[keyof typeof DISPLAY_PALETTES];
  message: string;
}) {
  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center p-8 text-center"
      style={{ backgroundColor: palette.background, color: palette.muted }}
    >
      <p className="max-w-lg text-xl font-semibold">{message}</p>
    </div>
  );
}

export function DisplayApp() {
  return (
    <QueueProvider>
      <DisplayBody />
    </QueueProvider>
  );
}
