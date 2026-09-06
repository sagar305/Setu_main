"use client";

// Intake photos, full size.
//
// A thumbnail proves a photo exists; only the full frame settles whether the
// mark was there when the device came in. So the lightbox exists for exactly one
// moment — the counter and the customer looking at the same picture together —
// and it does nothing else: no zoom, no rotate, no editing. Editing an intake
// photo is the one thing this record must never allow.

import { useCallback, useEffect } from "react";
import { ChevronLeft, ChevronRight, X } from "lucide-react";

export function PhotoLightbox({
  photos,
  index,
  onClose,
  onIndexChange,
}: {
  photos: string[];
  index: number;
  onClose: () => void;
  onIndexChange: (index: number) => void;
}) {
  const open = index >= 0 && index < photos.length;

  const step = useCallback(
    (delta: number) => {
      if (photos.length === 0) return;
      onIndexChange((index + delta + photos.length) % photos.length);
    },
    [index, onIndexChange, photos.length]
  );

  useEffect(() => {
    if (!open) return;
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
      if (event.key === "ArrowRight") step(1);
      if (event.key === "ArrowLeft") step(-1);
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [open, onClose, step]);

  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex flex-col bg-ink/90 p-4"
      role="dialog"
      aria-modal="true"
      aria-label="Intake photo"
    >
      <div className="flex items-center justify-between text-white">
        <span className="text-sm font-semibold">
          Photo {index + 1} of {photos.length}
        </span>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg p-2 transition hover:bg-white/10"
          aria-label="Close"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="flex min-h-0 flex-1 items-center justify-center gap-2">
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => step(-1)}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Previous photo"
          >
            <ChevronLeft className="h-6 w-6" />
          </button>
        )}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={photos[index]}
          alt={`Intake photo ${index + 1}`}
          className="max-h-full max-w-full rounded-lg object-contain"
        />
        {photos.length > 1 && (
          <button
            type="button"
            onClick={() => step(1)}
            className="rounded-full bg-white/10 p-2 text-white transition hover:bg-white/20"
            aria-label="Next photo"
          >
            <ChevronRight className="h-6 w-6" />
          </button>
        )}
      </div>
    </div>
  );
}
