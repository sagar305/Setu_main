"use client";

// The camera scanner behind the camera button on phones and tablets.
//
// Frames are pulled off a live <video>, cropped to the viewfinder band and
// handed to whichever decoder lib/pos/scan.ts picked for this browser. Nothing
// is uploaded and nothing is recorded — a frame lives in a canvas for as long
// as it takes to read it.

import { useCallback, useEffect, useRef, useState } from "react";
import { Camera, Check, Image as ImageIcon, X, Zap } from "lucide-react";
import {
  canOfferCameraScan,
  createBarcodeDecoder,
  type BarcodeDecoder,
} from "@/lib/pos/scan";

/** What the scanner should tell the user after handing over a code. */
export type ScanFeedback = { ok: boolean; message: string };

/** How often a frame is read. Fast enough to feel instant, slow enough to breathe. */
const SCAN_INTERVAL_MS = 120;

/** Ignore the same code again inside this window, so one label is not billed twice. */
const REPEAT_DELAY_MS = 2000;

/** Longest edge of the frame handed to the decoder. */
const MAX_FRAME_EDGE = 960;

/** Share of the frame height the viewfinder band covers. */
const BAND_HEIGHT = 0.55;

/**
 * Whether to show a camera button here. False during the server render and the
 * first client render, so the markup matches; true once we know the device is a
 * handheld with a usable camera.
 */
export function useCameraScanAvailable(): boolean {
  const [available, setAvailable] = useState(false);
  useEffect(() => {
    setAvailable(canOfferCameraScan());
  }, []);
  return available;
}

export function ScanButton({
  onScan,
  continuous,
  label = "Scan barcode with camera",
  className = "",
}: {
  /** Called with each code read. Return a message to show inside the scanner. */
  onScan: (code: string) => ScanFeedback | void;
  /** Keep the camera open after a hit — for billing, where items come one after another. */
  continuous?: boolean;
  label?: string;
  className?: string;
}) {
  const available = useCameraScanAvailable();
  const [open, setOpen] = useState(false);

  if (!available) return null;

  return (
    <>
      <button
        type="button"
        onClick={(event) => {
          // The button can sit inside a <label> (the product form). Without
          // this, the click would also focus that field and pop the keyboard
          // up behind the scanner.
          event.stopPropagation();
          setOpen(true);
        }}
        aria-label={label}
        title={label}
        className={`inline-flex h-9 w-9 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo ${className}`}
      >
        <Camera className="h-5 w-5" />
      </button>
      {open && (
        <ScannerModal
          continuous={continuous}
          onScan={onScan}
          onClose={() => setOpen(false)}
        />
      )}
    </>
  );
}

function ScannerModal({
  onScan,
  onClose,
  continuous,
}: {
  onScan: (code: string) => ScanFeedback | void;
  onClose: () => void;
  continuous?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const decoderRef = useRef<BarcodeDecoder | null>(null);
  const trackRef = useRef<MediaStreamTrack | null>(null);
  const lastHitRef = useRef({ code: "", at: 0 });
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Kept in refs so a re-render of the caller never restarts the camera.
  const onScanRef = useRef(onScan);
  const onCloseRef = useRef(onClose);
  onScanRef.current = onScan;
  onCloseRef.current = onClose;

  const [status, setStatus] = useState<"starting" | "scanning" | "error">("starting");
  const [error, setError] = useState("");
  const [feedback, setFeedback] = useState<ScanFeedback | null>(null);
  const [torchOn, setTorchOn] = useState(false);
  const [torchAvailable, setTorchAvailable] = useState(false);
  const [reading, setReading] = useState(false);

  const handleCode = useCallback(
    (code: string) => {
      const now = Date.now();
      const last = lastHitRef.current;
      if (code === last.code && now - last.at < REPEAT_DELAY_MS) return;
      lastHitRef.current = { code, at: now };

      chirp();
      navigator.vibrate?.(60);

      const result = onScanRef.current(code);
      setFeedback(result ?? { ok: true, message: code });
      if (!continuous) onCloseRef.current();
    },
    [continuous]
  );

  // Close on Escape, the same as every other POS dialog. Captured and stopped
  // so a form dialog underneath the scanner does not close along with it.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.stopImmediatePropagation();
      onCloseRef.current();
    };
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, []);

  useEffect(() => {
    let cancelled = false;
    let timer = 0;
    let stream: MediaStream | null = null;

    const readFrame = async () => {
      const video = videoRef.current;
      const decoder = decoderRef.current;
      if (!video || !decoder || video.readyState < 2 || !video.videoWidth) return;

      const image = frameToImageData(video, canvasRef);
      if (!image) return;
      const codes = await decoder(image);
      if (!cancelled && codes.length > 0) handleCode(codes[0]);
    };

    const tick = async () => {
      if (cancelled) return;
      try {
        await readFrame();
      } catch {
        // A single unreadable frame is not worth stopping the camera for.
      }
      if (!cancelled) timer = window.setTimeout(tick, SCAN_INTERVAL_MS);
    };

    const start = async () => {
      try {
        stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: "environment" },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
        });
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop());
          return;
        }

        const video = videoRef.current;
        if (video) {
          video.srcObject = stream;
          // iOS needs the inline attributes below plus an explicit play().
          await video.play().catch(() => {});
        }

        const track = stream.getVideoTracks()[0] ?? null;
        trackRef.current = track;
        const capabilities = track?.getCapabilities?.() as
          | (MediaTrackCapabilities & { torch?: boolean })
          | undefined;
        if (capabilities?.torch) setTorchAvailable(true);

        decoderRef.current = await createBarcodeDecoder();
        if (cancelled) return;
        setStatus("scanning");
        tick();
      } catch (cause) {
        if (cancelled) return;
        setStatus("error");
        setError(describeCameraError(cause));
      }
    };

    start();

    return () => {
      cancelled = true;
      window.clearTimeout(timer);
      trackRef.current = null;
      stream?.getTracks().forEach((track) => track.stop());
      const video = videoRef.current;
      if (video) video.srcObject = null;
    };
  }, [handleCode]);

  const toggleTorch = async () => {
    const track = trackRef.current;
    if (!track) return;
    const next = !torchOn;
    try {
      await track.applyConstraints({
        advanced: [{ torch: next } as MediaTrackConstraintSet & { torch: boolean }],
      });
      setTorchOn(next);
    } catch {
      setTorchAvailable(false);
    }
  };

  // Fallback for browsers that refuse a live stream (in-app browsers, blocked
  // permission): let the native camera take one photo and read that instead.
  const readPhoto = async (file: File | undefined) => {
    if (!file) return;
    setReading(true);
    try {
      if (!decoderRef.current) decoderRef.current = await createBarcodeDecoder();
      const image = await imageDataFromBlob(file);
      const codes = image ? await decoderRef.current(image) : [];
      if (codes.length > 0) {
        lastHitRef.current = { code: "", at: 0 };
        handleCode(codes[0]);
      } else {
        setFeedback({ ok: false, message: "No barcode found in that photo. Try again, closer." });
      }
    } catch {
      setFeedback({ ok: false, message: "Could not read that photo." });
    } finally {
      setReading(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-[80] flex flex-col bg-ink"
      role="dialog"
      aria-modal="true"
      aria-label="Scan a barcode"
    >
      <div className="flex items-center justify-between px-4 py-3 text-white">
        <p className="text-sm font-bold">Scan barcode</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close scanner"
          className="flex h-9 w-9 items-center justify-center rounded-full text-white/80 transition hover:bg-white/10 hover:text-white"
        >
          <X className="h-5 w-5" />
        </button>
      </div>

      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          autoPlay
          className="h-full w-full object-cover"
        />

        {status !== "error" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
            <div
              className="w-[90%] max-w-md rounded-2xl border-2 border-white/80 shadow-[0_0_0_100vmax_rgba(15,23,42,0.45)]"
              style={{ height: `${BAND_HEIGHT * 100}%` }}
            />
          </div>
        )}

        {status === "starting" && (
          <p className="absolute inset-x-0 bottom-6 text-center text-sm text-white/80">
            Starting camera…
          </p>
        )}

        {status === "scanning" && !feedback && (
          <p className="absolute inset-x-0 bottom-6 text-center text-sm text-white/80">
            Point the camera at the barcode
          </p>
        )}

        {status === "error" && (
          <div className="absolute inset-0 flex items-center justify-center p-6">
            <p className="max-w-sm text-center text-sm text-white/90">{error}</p>
          </div>
        )}

        {feedback && (
          <div className="absolute inset-x-4 bottom-5">
            <p
              className={`flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-center text-sm font-semibold text-white ${
                feedback.ok ? "bg-emerald-600" : "bg-red-600"
              }`}
            >
              {feedback.ok && <Check className="h-4 w-4 shrink-0" />}
              {feedback.message}
            </p>
          </div>
        )}
      </div>

      <div className="flex items-center justify-between gap-3 px-4 py-4">
        <div className="flex gap-2">
          {torchAvailable && (
            <button
              type="button"
              onClick={toggleTorch}
              aria-pressed={torchOn}
              className={`inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold transition ${
                torchOn ? "bg-white text-ink" : "bg-white/10 text-white hover:bg-white/20"
              }`}
            >
              <Zap className="h-4 w-4" />
              Light
            </button>
          )}
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={reading}
            className="inline-flex items-center gap-2 rounded-lg bg-white/10 px-3 py-2 text-sm font-semibold text-white transition hover:bg-white/20 disabled:opacity-50"
          >
            <ImageIcon className="h-4 w-4" />
            {reading ? "Reading…" : "Use a photo"}
          </button>
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(event) => {
              void readPhoto(event.target.files?.[0]);
              event.target.value = "";
            }}
          />
        </div>
        <button
          type="button"
          onClick={onClose}
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-ink transition hover:bg-cream"
        >
          Done
        </button>
      </div>
    </div>
  );
}

/**
 * Copy the viewfinder band out of the video into a canvas. Cropping keeps the
 * decoder away from the shelf behind the packet, and downscaling keeps each
 * read well under the frame budget on an older phone.
 */
function frameToImageData(
  video: HTMLVideoElement,
  canvasRef: { current: HTMLCanvasElement | null }
): ImageData | null {
  const bandHeight = Math.round(video.videoHeight * BAND_HEIGHT);
  const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(video.videoWidth, bandHeight));
  const width = Math.max(1, Math.round(video.videoWidth * scale));
  const height = Math.max(1, Math.round(bandHeight * scale));

  const canvas = (canvasRef.current ??= document.createElement("canvas"));
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;

  context.drawImage(
    video,
    0,
    Math.round((video.videoHeight - bandHeight) / 2),
    video.videoWidth,
    bandHeight,
    0,
    0,
    width,
    height
  );
  return context.getImageData(0, 0, width, height);
}

/** Decode a still photo into pixels the decoder can read. */
async function imageDataFromBlob(blob: Blob): Promise<ImageData | null> {
  const bitmap = await loadBitmap(blob);
  if (!bitmap) return null;
  const scale = Math.min(1, MAX_FRAME_EDGE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.max(1, Math.round(bitmap.width * scale));
  canvas.height = Math.max(1, Math.round(bitmap.height * scale));
  const context = canvas.getContext("2d", { willReadFrequently: true });
  if (!context) return null;
  context.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  if ("close" in bitmap) bitmap.close();
  return context.getImageData(0, 0, canvas.width, canvas.height);
}

async function loadBitmap(blob: Blob): Promise<ImageBitmap | HTMLImageElement | null> {
  if (typeof createImageBitmap === "function") {
    try {
      return await createImageBitmap(blob);
    } catch {
      // Fall through to the <img> route below.
    }
  }
  const url = URL.createObjectURL(blob);
  try {
    return await new Promise<HTMLImageElement>((resolve, reject) => {
      const image = new Image();
      image.onload = () => resolve(image);
      image.onerror = () => reject(new Error("image decode failed"));
      image.src = url;
    });
  } catch {
    return null;
  } finally {
    URL.revokeObjectURL(url);
  }
}

function describeCameraError(cause: unknown): string {
  const name = cause instanceof Error ? cause.name : "";
  if (name === "NotAllowedError" || name === "SecurityError") {
    return "Camera permission is blocked. Allow camera access for this site in your browser settings, then try again — or use “Use a photo”.";
  }
  if (name === "NotFoundError" || name === "OverconstrainedError") {
    return "No camera found on this device.";
  }
  if (name === "NotReadableError") {
    return "The camera is busy in another app. Close it and try again.";
  }
  return "Could not start the camera. Try “Use a photo” instead.";
}

/** A short confirmation beep, the way a counter scanner sounds. */
function chirp() {
  try {
    const Ctor =
      window.AudioContext ??
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return;
    const context = new Ctor();
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = "square";
    oscillator.frequency.value = 1180;
    gain.gain.value = 0.08;
    oscillator.connect(gain).connect(context.destination);
    oscillator.start();
    oscillator.stop(context.currentTime + 0.08);
    oscillator.onended = () => void context.close();
  } catch {
    // No audio is fine — the flash of green says the same thing.
  }
}
