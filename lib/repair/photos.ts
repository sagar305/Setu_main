// Reading an intake photo off the camera and shrinking it enough to keep.
//
// §7 points at lib/toolkit/logo.ts for this, but that helper makes a 256px PNG
// for a business logo — far too small to show a hairline crack, and PNG is the
// wrong format for a photograph anyway. So this is the same idea at the size
// §9.4 asks for: longest edge 1024, JPEG at quality 0.7, which lands a phone
// photo at roughly 100–150 KB instead of the three to five megabytes the camera
// produced.
//
// The compression is the difference between a shop being able to keep a year of
// evidence in a browser and filling the device by March.

import { PHOTO_MAX_EDGE, PHOTO_QUALITY } from "./types";

export function readIntakePhoto(
  file: File,
  maxEdge = PHOTO_MAX_EDGE,
  quality = PHOTO_QUALITY
): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error("Could not read that photo."));
    reader.onload = () => {
      const image = new Image();
      image.onerror = () => reject(new Error("That file is not an image."));
      image.onload = () => {
        const scale = Math.min(1, maxEdge / Math.max(image.width, image.height));
        const canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.width * scale));
        canvas.height = Math.max(1, Math.round(image.height * scale));
        const context = canvas.getContext("2d");
        if (!context) {
          reject(new Error("This browser could not process the photo."));
          return;
        }
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL("image/jpeg", quality));
      };
      image.src = String(reader.result);
    };
    reader.readAsDataURL(file);
  });
}

/** Rough size of a stored data URL, for telling a shop what a backup will weigh. */
export function dataUrlBytes(dataUrl: string): number {
  const comma = dataUrl.indexOf(",");
  if (comma < 0) return 0;
  const base64 = dataUrl.length - comma - 1;
  return Math.max(0, Math.round(base64 * 0.75));
}

export function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}
