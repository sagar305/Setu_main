"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { decodeMenu, type QrMenuData } from "@/lib/qrmenu";
import { resolveShortLink } from "@/lib/toolkit/shortLink";
import { MenuDisplay } from "./MenuDisplay";

type ViewerState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "expired" }
  | { status: "offline" }
  | { status: "ready"; menu: QrMenuData };

/**
 * @param code Present when the QR pointed at a published /menu/<code>. Absent
 *             when the whole menu travelled inside the QR code itself.
 */
export function MenuViewer({ code }: { code?: string } = {}) {
  const [state, setState] = useState<ViewerState>({ status: "loading" });
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (code) return;
    // The menu travels in the URL fragment so the data never reaches any
    // server. Fall back to the query string in case a scanner rewrites the URL.
    const raw = window.location.hash || window.location.search;
    if (!raw || raw.length <= 1) {
      setState({ status: "empty" });
      return;
    }
    const menu = decodeMenu(raw);
    setState(menu ? { status: "ready", menu } : { status: "error" });
  }, [code]);

  // A published menu has to be fetched. A diner in a basement with no signal is
  // the realistic failure here, so it gets its own message and a retry rather
  // than the generic "damaged QR code" one.
  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;

    setState({ status: "loading" });
    resolveShortLink(code)
      .then((link) => {
        if (cancelled) return;
        if (!link) {
          setState({ status: "expired" });
          return;
        }
        const menu = decodeMenu(link.payload);
        setState(menu ? { status: "ready", menu } : { status: "error" });
      })
      .catch(() => {
        if (!cancelled) setState({ status: "offline" });
      });

    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  if (state.status === "loading") {
    return (
      <div className="py-24 text-center text-sm text-muted" role="status">
        Loading menu…
      </div>
    );
  }

  if (state.status === "ready") {
    // On /menu the restaurant name is the page's main heading.
    return <MenuDisplay menu={state.menu} nameHeadingLevel="h1" />;
  }

  const heading =
    state.status === "empty"
      ? "No menu found"
      : state.status === "offline"
        ? "Can\u2019t load this menu"
        : state.status === "expired"
          ? "This menu is no longer available"
          : "This menu link is invalid";

  const body =
    state.status === "empty"
      ? "This page shows a restaurant menu when opened from a menu QR code. Scan a menu QR code to see it here."
      : state.status === "offline"
        ? "This QR code points to a menu stored online, so it needs an internet connection. Check your connection and try again."
        : state.status === "expired"
          ? "A published menu is removed 180 days after the last time anyone opened it. Ask the restaurant for an up-to-date QR code."
          : "The QR code or link appears to be damaged or incomplete. Please rescan the QR code, or ask the restaurant for a fresh one.";

  return (
    <div className="rounded-2xl border border-muted-line/30 bg-white px-6 py-16 text-center shadow-sm">
      <QrCode className="mx-auto h-10 w-10 text-muted" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold text-ink">{heading}</h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">{body}</p>

      {state.status === "offline" ? (
        <button
          type="button"
          onClick={() => setAttempt((n) => n + 1)}
          className="mt-6 inline-block rounded-lg border border-indigo bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Try again
        </button>
      ) : (
        <Link
          href="/tools/qr-menu-generator"
          className="mt-6 inline-block rounded-lg border border-indigo bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
        >
          Create your own menu QR — free
        </Link>
      )}
    </div>
  );
}
