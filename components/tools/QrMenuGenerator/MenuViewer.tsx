"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { QrCode } from "lucide-react";
import { decodeMenu, type QrMenuData } from "@/lib/qrmenu";
import { MenuDisplay } from "./MenuDisplay";

type ViewerState =
  | { status: "loading" }
  | { status: "empty" }
  | { status: "error" }
  | { status: "ready"; menu: QrMenuData };

export function MenuViewer() {
  const [state, setState] = useState<ViewerState>({ status: "loading" });

  useEffect(() => {
    // The menu travels in the URL fragment so the data never reaches any
    // server. Fall back to the query string in case a scanner rewrites the URL.
    const raw = window.location.hash || window.location.search;
    if (!raw || raw.length <= 1) {
      setState({ status: "empty" });
      return;
    }
    const menu = decodeMenu(raw);
    setState(menu ? { status: "ready", menu } : { status: "error" });
  }, []);

  if (state.status === "loading") {
    return (
      <div className="py-24 text-center text-sm text-muted" role="status">
        Loading menu…
      </div>
    );
  }

  if (state.status === "ready") {
    return <MenuDisplay menu={state.menu} />;
  }

  return (
    <div className="rounded-2xl border border-muted-line/30 bg-white px-6 py-16 text-center shadow-sm">
      <QrCode className="mx-auto h-10 w-10 text-muted" aria-hidden="true" />
      <h1 className="mt-4 text-xl font-bold text-ink">
        {state.status === "empty" ? "No menu found" : "This menu link is invalid"}
      </h1>
      <p className="mx-auto mt-2 max-w-md text-sm text-muted">
        {state.status === "empty"
          ? "This page shows a restaurant menu when opened from a menu QR code. Scan a menu QR code to see it here."
          : "The QR code or link appears to be damaged or incomplete. Please rescan the QR code, or ask the restaurant for a fresh one."}
      </p>
      <Link
        href="/tools/qr-menu-generator"
        className="mt-6 inline-block rounded-lg border border-indigo bg-indigo px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-indigo-700"
      >
        Create your own menu QR — free
      </Link>
    </div>
  );
}
