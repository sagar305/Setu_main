// Camera barcode scanning for the Browser Based POS.
//
// A lot of counters run this POS on a phone or an iPad and have no USB laser
// scanner, so the device's own camera becomes the scanner. Two decoders sit
// behind one interface:
//
//   1. The browser's built-in BarcodeDetector where it exists (Chrome on
//      Android). Native, fast, nothing to download.
//   2. ZXing compiled to WebAssembly everywhere else — notably Safari on
//      iPhone and iPad, which ships no BarcodeDetector.
//
// The wasm binary is served from our own origin (public/vendor/zxing, put
// there by scripts/vendor-zxing.mjs) instead of the jsDelivr CDN the library
// reaches for by default: POS data never leaves the device, and neither do the
// assets it needs. The POS service worker caches it after the first scan so
// scanning keeps working offline.

import { isHandheldDevice } from "./device";
import type { Product } from "./types";

/**
 * Version of the vendored `zxing_reader.wasm`. The build (scripts/vendor-zxing.mjs)
 * fails if this drifts from the installed `zxing-wasm` package — the glue code is
 * bundled from that package and only loads the binary it was built against.
 */
export const ZXING_WASM_VERSION = "3.1.3";

/** Same-origin URL of the vendored decoder binary. Versioned, so it caches forever. */
export const ZXING_WASM_URL = `/vendor/zxing/zxing_reader-${ZXING_WASM_VERSION}.wasm`;

/** A decoder reads one still frame and returns whatever barcodes it found. */
export type BarcodeDecoder = (image: ImageData) => Promise<string[]>;

/** Retail labels, plus the 2D codes a counter is likely to be handed. */
const ZXING_FORMATS = [
  "EAN13",
  "EAN8",
  "UPCA",
  "UPCE",
  "Code128",
  "Code39",
  "Code93",
  "ITF",
  "Codabar",
  "DataBar",
  "DataBarExp",
  "QRCode",
  "DataMatrix",
  "PDF417",
  "Aztec",
] as const;

/** The same list in the names the native BarcodeDetector uses. */
const NATIVE_FORMATS = [
  "ean_13",
  "ean_8",
  "upc_a",
  "upc_e",
  "code_128",
  "code_39",
  "code_93",
  "itf",
  "codabar",
  "qr_code",
  "data_matrix",
  "pdf417",
  "aztec",
];

type NativeDetector = { detect(source: ImageData): Promise<{ rawValue: string }[]> };

type NativeDetectorConstructor = {
  new (options?: { formats?: string[] }): NativeDetector;
  getSupportedFormats?: () => Promise<string[]>;
};

/** True when this browser can hand us a camera stream at all. */
export function isCameraScanSupported(): boolean {
  if (typeof window === "undefined" || typeof navigator === "undefined") return false;
  // getUserMedia is only exposed on https (and localhost).
  if (!window.isSecureContext) return false;
  return typeof navigator.mediaDevices?.getUserMedia === "function";
}

/**
 * Whether to show the camera button: a handheld device that can open a camera.
 * Desktop tills are driven by a keyboard-wedge scanner and a webcam pointing at
 * the shopkeeper's face, so the button would only be clutter there.
 */
export function canOfferCameraScan(): boolean {
  return isCameraScanSupported() && isHandheldDevice();
}

async function createNativeDecoder(): Promise<BarcodeDecoder | null> {
  const Detector = (globalThis as { BarcodeDetector?: NativeDetectorConstructor })
    .BarcodeDetector;
  if (!Detector) return null;
  try {
    const supported = (await Detector.getSupportedFormats?.()) ?? [];
    const formats = NATIVE_FORMATS.filter((format) => supported.includes(format));
    if (formats.length === 0) return null;
    const detector = new Detector({ formats });
    return async (image) => {
      const found = await detector.detect(image);
      return found.map((result) => result.rawValue).filter(Boolean);
    };
  } catch {
    return null;
  }
}

async function createZxingDecoder(): Promise<BarcodeDecoder> {
  const { prepareZXingModule, readBarcodes } = await import("zxing-wasm/reader");
  prepareZXingModule({
    overrides: {
      locateFile: (path: string, prefix: string) =>
        path.endsWith(".wasm") ? ZXING_WASM_URL : prefix + path,
    },
  });
  return async (image) => {
    const results = await readBarcodes(image, {
      formats: [...ZXING_FORMATS],
      maxNumberOfSymbols: 1,
      tryDownscale: true,
    });
    return results.filter((result) => result.isValid && result.text).map((result) => result.text);
  };
}

/**
 * Pick a decoder for this browser. The native one is preferred, but a browser
 * that exposes a BarcodeDetector which throws on first use falls back to wasm
 * rather than leaving the user with a camera that never reads anything.
 */
export async function createBarcodeDecoder(): Promise<BarcodeDecoder> {
  const native = await createNativeDecoder();
  if (!native) return createZxingDecoder();

  let nativeWorks = true;
  let fallback: BarcodeDecoder | null = null;
  return async (image) => {
    if (nativeWorks) {
      try {
        return await native(image);
      } catch {
        nativeWorks = false;
      }
    }
    if (!fallback) fallback = await createZxingDecoder();
    return fallback(image);
  };
}

/** Codes are matched case-insensitively, with surrounding whitespace ignored. */
export function normalizeCode(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Every spelling of a scanned code worth trying against the catalogue. A
 * UPC-A label (12 digits) is reported as a 13-digit EAN-13 with a leading zero
 * by some decoders and as 12 digits by others, so a product saved one way still
 * has to be found when scanned the other way.
 */
export function codeVariants(value: string): string[] {
  const code = normalizeCode(value);
  if (!code) return [];
  const variants = [code];
  if (/^\d{13}$/.test(code) && code.startsWith("0")) variants.push(code.slice(1));
  if (/^\d{12}$/.test(code)) variants.push(`0${code}`);
  return variants;
}

/**
 * Find the product a scanned or typed code refers to. Barcode wins over SKU:
 * the barcode is what the camera actually read off the packet.
 */
export function findProductByCode(products: Product[], value: string): Product | null {
  const variants = codeVariants(value);
  if (variants.length === 0) return null;
  for (const variant of variants) {
    const byBarcode = products.find((product) => normalizeCode(product.barcode) === variant);
    if (byBarcode) return byBarcode;
  }
  for (const variant of variants) {
    const bySku = products.find((product) => normalizeCode(product.sku) === variant);
    if (bySku) return bySku;
  }
  return null;
}
