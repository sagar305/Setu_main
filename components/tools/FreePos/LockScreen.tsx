"use client";

// Counter lock screen. While this is up nothing behind it can be reached:
// it covers the viewport at the highest z-index, swallows every pointer,
// key and context-menu event outside its own PIN pad, and keeps focus
// trapped on the PIN field. The only way past is the correct PIN.

import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { verifyPin } from "@/lib/pos/pin";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

export function LockScreen({
  businessName,
  pinHash,
  pinSalt,
  onUnlock,
}: {
  businessName: string;
  pinHash: string;
  pinSalt: string;
  onUnlock: () => void;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);

  const submit = useCallback(
    async (value: string) => {
      if (checking) return;
      setChecking(true);
      const ok = await verifyPin(value, pinSalt, pinHash);
      setChecking(false);
      if (ok) {
        setPin("");
        setError("");
        onUnlock();
      } else {
        setError("Wrong PIN — try again.");
        setPin("");
      }
    },
    [checking, pinHash, pinSalt, onUnlock]
  );

  // Block every interaction that could reach the POS behind the overlay:
  // key presses outside the panel, right-click menus, and browser shortcuts
  // that would let someone tab or scroll away.
  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      const insidePanel = panelRef.current?.contains(event.target as Node);
      if (!insidePanel) {
        event.preventDefault();
        event.stopPropagation();
        inputRef.current?.focus();
        return;
      }
      // Never let focus escape the panel.
      if (event.key === "Tab") {
        event.preventDefault();
        inputRef.current?.focus();
      }
    };
    const onContextMenu = (event: MouseEvent) => event.preventDefault();
    const onFocusIn = (event: FocusEvent) => {
      if (!panelRef.current?.contains(event.target as Node)) {
        event.stopPropagation();
        inputRef.current?.focus();
      }
    };

    document.addEventListener("keydown", onKeyDown, true);
    document.addEventListener("contextmenu", onContextMenu, true);
    document.addEventListener("focusin", onFocusIn, true);

    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    inputRef.current?.focus();

    return () => {
      document.removeEventListener("keydown", onKeyDown, true);
      document.removeEventListener("contextmenu", onContextMenu, true);
      document.removeEventListener("focusin", onFocusIn, true);
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const press = (digit: string) => {
    setError("");
    setPin((prev) => {
      const next = (prev + digit).slice(0, 8);
      return next;
    });
  };

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-ink/95 p-4 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      aria-label="POS locked — enter PIN"
      onMouseDown={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) {
          event.preventDefault();
          inputRef.current?.focus();
        }
      }}
      onTouchStart={(event) => {
        if (!panelRef.current?.contains(event.target as Node)) event.preventDefault();
      }}
    >
      <div
        ref={panelRef}
        className="w-full max-w-xs rounded-2xl bg-white p-6 text-center shadow-2xl"
      >
        <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-indigo/10 text-indigo">
          <Lock className="h-6 w-6" />
        </span>
        <h2 className="mt-3 text-lg font-bold text-ink">{businessName || "POS locked"}</h2>
        <p className="mt-1 text-sm text-muted">Enter your PIN to unlock the counter.</p>

        <form
          onSubmit={(event) => {
            event.preventDefault();
            void submit(pin);
          }}
        >
          <input
            ref={inputRef}
            type="password"
            inputMode="numeric"
            autoComplete="off"
            value={pin}
            onChange={(event) => {
              setError("");
              setPin(event.target.value.replace(/\D/g, "").slice(0, 8));
            }}
            aria-label="PIN"
            className="mt-4 w-full rounded-lg border border-muted-line/40 bg-white px-3 py-3 text-center text-2xl tracking-[0.4em] text-ink focus:border-indigo focus:outline-none focus:ring-1 focus:ring-indigo"
            placeholder="••••"
          />

          {/* On-screen keypad for touch terminals. */}
          <div className="mt-4 grid grid-cols-3 gap-2">
            {KEYS.map((k) => (
              <button
                key={k}
                type="button"
                onClick={() => press(k)}
                className="rounded-lg border border-muted-line/30 bg-cream-paper py-3 text-lg font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
              >
                {k}
              </button>
            ))}
            <button
              type="button"
              onClick={() => {
                setError("");
                setPin("");
              }}
              className="rounded-lg border border-muted-line/30 bg-cream-paper py-3 text-xs font-semibold text-muted transition hover:text-ink"
            >
              Clear
            </button>
            <button
              type="button"
              onClick={() => press("0")}
              className="rounded-lg border border-muted-line/30 bg-cream-paper py-3 text-lg font-semibold text-ink transition hover:border-indigo/40 hover:text-indigo"
            >
              0
            </button>
            <button
              type="button"
              onClick={() => {
                setError("");
                setPin((p) => p.slice(0, -1));
              }}
              aria-label="Backspace"
              className="flex items-center justify-center rounded-lg border border-muted-line/30 bg-cream-paper py-3 text-muted transition hover:text-ink"
            >
              <Delete className="h-5 w-5" />
            </button>
          </div>

          <button
            type="submit"
            disabled={pin.length < 4 || checking}
            className="mt-4 w-full rounded-lg bg-indigo px-4 py-3 text-sm font-semibold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-50"
          >
            {checking ? "Checking…" : "Unlock"}
          </button>
        </form>

        {error && <p className="mt-3 text-sm font-medium text-red-600">{error}</p>}

        <p className="mt-4 text-xs text-muted">
          Forgot the PIN? Clear the browser&apos;s site data to reset — your sales are only on this
          device, so restore a backup afterwards.
        </p>
      </div>
    </div>
  );
}
