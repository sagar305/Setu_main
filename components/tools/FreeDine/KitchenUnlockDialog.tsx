"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Delete, Lock } from "lucide-react";
import { verifyPin } from "@/lib/dine/pin";
import { Modal, primaryBtnClass, secondaryBtnClass, tapTargetClass } from "./ui";

const KEYS = ["1", "2", "3", "4", "5", "6", "7", "8", "9"];

/**
 * PIN prompt for taking the kitchen screen out of kiosk mode.
 *
 * Separate from the counter's LockScreen because the two lock different
 * things. The counter's lock hides the till until someone proves they belong
 * there; this one leaves the orders fully visible and usable — a cook must
 * still be able to work — and only gates getting *out* of the screen.
 */
export function KitchenUnlockDialog({
  open,
  onClose,
  onUnlocked,
  pinHash,
  pinSalt,
}: {
  open: boolean;
  onClose: () => void;
  onUnlocked: () => void;
  pinHash: string;
  pinSalt: string;
}) {
  const [pin, setPin] = useState("");
  const [error, setError] = useState("");
  const [checking, setChecking] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!open) return;
    setPin("");
    setError("");
    const timer = window.setTimeout(() => inputRef.current?.focus(), 50);
    return () => window.clearTimeout(timer);
  }, [open]);

  const submit = useCallback(
    async (value: string) => {
      if (checking || value.length === 0) return;
      setChecking(true);
      const ok = await verifyPin(value, pinSalt, pinHash);
      setChecking(false);
      if (ok) {
        setPin("");
        setError("");
        onUnlocked();
      } else {
        setError("Wrong PIN.");
        setPin("");
      }
    },
    [checking, onUnlocked, pinHash, pinSalt]
  );

  const press = (key: string) => {
    setError("");
    setPin((previous) => (previous.length >= 8 ? previous : previous + key));
  };

  return (
    <Modal open={open} onClose={onClose} title="Unlock the kitchen screen">
      <p className="text-sm text-muted">
        Enter the counter PIN. The counter can also unlock this screen from its Settings.
      </p>

      <form
        className="mt-4"
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
          aria-label="Counter PIN"
          className="w-full rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-center text-2xl tracking-[0.4em] text-ink focus:border-indigo focus:outline-none"
        />

        <div className="mx-auto mt-4 grid max-w-[260px] grid-cols-3 gap-2">
          {KEYS.map((key) => (
            <button
              key={key}
              type="button"
              onClick={() => press(key)}
              className={`${tapTargetClass} rounded-xl border border-muted-line/40 bg-white py-3 text-lg font-bold text-ink transition hover:border-indigo/50`}
            >
              {key}
            </button>
          ))}
          <button
            type="button"
            onClick={() => setPin("")}
            className={`${tapTargetClass} rounded-xl border border-muted-line/40 bg-white text-xs font-semibold text-muted`}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => press("0")}
            className={`${tapTargetClass} rounded-xl border border-muted-line/40 bg-white py-3 text-lg font-bold text-ink transition hover:border-indigo/50`}
          >
            0
          </button>
          <button
            type="button"
            onClick={() => setPin((previous) => previous.slice(0, -1))}
            aria-label="Delete last digit"
            className={`${tapTargetClass} flex items-center justify-center rounded-xl border border-muted-line/40 bg-white text-muted`}
          >
            <Delete className="h-5 w-5" />
          </button>
        </div>

        {error && <p className="mt-3 text-center text-sm font-semibold text-red-600">{error}</p>}

        <div className="mt-5 flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Stay locked
          </button>
          <button
            type="submit"
            disabled={checking || pin.length === 0}
            className={`${primaryBtnClass} ${tapTargetClass}`}
          >
            <Lock className="h-4 w-4" />
            {checking ? "Checking…" : "Unlock"}
          </button>
        </div>
      </form>
    </Modal>
  );
}
