"use client";

import { useEffect, useRef, useState } from "react";
import { Eraser, Upload } from "lucide-react";
import { secondaryBtnClass } from "@/components/tools/FreePos/ui";

/**
 * Draw-or-upload signature capture. Hand-rolled on a canvas rather than pulling
 * in a signature library: it is one pointer-event loop, and the app has no
 * other use for the dependency.
 *
 * The stored image is trimmed to the ink and kept transparent, so it sits on a
 * prescription without a white box around it.
 */
export function SignaturePad({
  value,
  onChange,
}: {
  value: string;
  onChange: (dataUrl: string) => void;
}) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawingRef = useRef(false);
  const dirtyRef = useRef(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [hasInk, setHasInk] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    // Match the backing store to the display size so strokes are not blurry.
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const context = canvas.getContext("2d");
    if (!context) return;
    context.scale(ratio, ratio);
    context.lineWidth = 2;
    context.lineCap = "round";
    context.lineJoin = "round";
    context.strokeStyle = "#111827";
  }, []);

  const pointFrom = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return { x: 0, y: 0 };
    const rect = canvas.getBoundingClientRect();
    return { x: event.clientX - rect.left, y: event.clientY - rect.top };
  };

  const start = (event: React.PointerEvent<HTMLCanvasElement>) => {
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    canvasRef.current?.setPointerCapture(event.pointerId);
    drawingRef.current = true;
    const { x, y } = pointFrom(event);
    context.beginPath();
    context.moveTo(x, y);
  };

  const move = (event: React.PointerEvent<HTMLCanvasElement>) => {
    if (!drawingRef.current) return;
    const context = canvasRef.current?.getContext("2d");
    if (!context) return;
    const { x, y } = pointFrom(event);
    context.lineTo(x, y);
    context.stroke();
    dirtyRef.current = true;
    if (!hasInk) setHasInk(true);
  };

  const end = () => {
    if (!drawingRef.current) return;
    drawingRef.current = false;
    if (!dirtyRef.current) return;
    const trimmed = trimCanvas(canvasRef.current);
    if (trimmed) onChange(trimmed);
  };

  const clear = () => {
    const canvas = canvasRef.current;
    const context = canvas?.getContext("2d");
    if (!canvas || !context) return;
    context.clearRect(0, 0, canvas.width, canvas.height);
    dirtyRef.current = false;
    setHasInk(false);
    onChange("");
  };

  return (
    <div>
      {value && !hasInk && (
        <div className="mb-2 rounded-lg border border-muted-line/30 bg-white p-2">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={value} alt="Saved signature" className="max-h-16" />
        </div>
      )}

      <canvas
        ref={canvasRef}
        onPointerDown={start}
        onPointerMove={move}
        onPointerUp={end}
        onPointerLeave={end}
        className="h-32 w-full touch-none rounded-lg border border-dashed border-muted-line/50 bg-white"
        aria-label="Signature drawing area"
      />

      <div className="mt-2 flex flex-wrap gap-2">
        <button type="button" onClick={clear} className={secondaryBtnClass}>
          <Eraser className="h-4 w-4" />
          Clear
        </button>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          className={secondaryBtnClass}
        >
          <Upload className="h-4 w-4" />
          Upload image
        </button>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={async (event) => {
          const file = event.target.files?.[0];
          event.target.value = "";
          if (!file) return;
          const reader = new FileReader();
          reader.onload = () => {
            onChange(String(reader.result));
            setHasInk(false);
          };
          reader.readAsDataURL(file);
        }}
      />
    </div>
  );
}

/** Crop the transparent margin so the signature prints at a sensible size. */
function trimCanvas(canvas: HTMLCanvasElement | null): string {
  if (!canvas) return "";
  const context = canvas.getContext("2d");
  if (!context) return "";
  const { width, height } = canvas;
  const { data } = context.getImageData(0, 0, width, height);

  let top = height;
  let left = width;
  let right = 0;
  let bottom = 0;
  for (let y = 0; y < height; y += 1) {
    for (let x = 0; x < width; x += 1) {
      if (data[(y * width + x) * 4 + 3] === 0) continue;
      if (y < top) top = y;
      if (y > bottom) bottom = y;
      if (x < left) left = x;
      if (x > right) right = x;
    }
  }
  if (right < left || bottom < top) return "";

  const pad = 4;
  const cropWidth = Math.min(width, right - left + pad * 2);
  const cropHeight = Math.min(height, bottom - top + pad * 2);
  const output = document.createElement("canvas");
  output.width = cropWidth;
  output.height = cropHeight;
  const outputContext = output.getContext("2d");
  if (!outputContext) return canvas.toDataURL("image/png");
  outputContext.drawImage(
    canvas,
    Math.max(0, left - pad),
    Math.max(0, top - pad),
    cropWidth,
    cropHeight,
    0,
    0,
    cropWidth,
    cropHeight
  );
  return output.toDataURL("image/png");
}
