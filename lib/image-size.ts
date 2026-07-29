import "server-only";

import fs from "fs";
import path from "path";

// next/image needs intrinsic width/height for any image it doesn't statically
// import. Blog thumbnails are referenced by a runtime path (/blog/thumbnails/…)
// and their aspect ratios differ (1.5:1 to 1.9:1), so hardcoding one ratio
// would reserve the wrong box and cause layout shift. These files live in
// /public, so read the real dimensions straight out of the image header.

export type ImageSize = { width: number; height: number };

const cache = new Map<string, ImageSize | null>();

function readPngSize(buf: Buffer): ImageSize | null {
  // PNG signature, then an IHDR chunk whose width/height are at bytes 16..24.
  if (buf.length < 24 || buf.readUInt32BE(0) !== 0x89504e47) return null;
  return { width: buf.readUInt32BE(16), height: buf.readUInt32BE(20) };
}

function readJpegSize(buf: Buffer): ImageSize | null {
  if (buf.length < 4 || buf.readUInt16BE(0) !== 0xffd8) return null;
  let offset = 2;
  while (offset + 9 < buf.length) {
    if (buf[offset] !== 0xff) {
      offset++;
      continue;
    }
    const marker = buf[offset + 1];
    // SOF0/1/2/3 carry the frame dimensions; standalone markers have no length.
    if (marker >= 0xc0 && marker <= 0xc3) {
      return { width: buf.readUInt16BE(offset + 7), height: buf.readUInt16BE(offset + 5) };
    }
    if (marker === 0xd8 || marker === 0xd9 || (marker >= 0xd0 && marker <= 0xd7)) {
      offset += 2;
      continue;
    }
    offset += 2 + buf.readUInt16BE(offset + 2);
  }
  return null;
}

/**
 * Intrinsic size of an image served from /public, addressed by its public path
 * (e.g. "/blog/thumbnails/why-we-build.jpeg"). Returns null if the file is
 * missing or isn't a PNG/JPEG we can parse.
 */
export function getPublicImageSize(publicPath: string): ImageSize | null {
  if (cache.has(publicPath)) return cache.get(publicPath) ?? null;

  let size: ImageSize | null = null;
  // Guard against traversal out of /public via a content-supplied path.
  const normalized = path.posix.normalize(publicPath);
  if (normalized.startsWith("/") && !normalized.includes("..")) {
    const file = path.join(process.cwd(), "public", normalized);
    try {
      const buf = fs.readFileSync(file);
      size = readPngSize(buf) ?? readJpegSize(buf);
    } catch {
      size = null;
    }
  }

  cache.set(publicPath, size);
  return size;
}
