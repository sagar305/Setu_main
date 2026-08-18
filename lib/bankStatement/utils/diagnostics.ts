// What to tell us when an import fails, and nothing more.
// ---------------------------------------------------------------------------
// A minified "undefined is not a function" is useless to whoever has to fix it
// and alarming to whoever is reading it. This builds a short report that names
// the stage that failed, the error, and the handful of browser capabilities
// that actually decide whether this tool works — which is almost always the
// answer on an older phone.
//
// What it deliberately does NOT include: the file name (a statement is
// routinely called "SBI_Statement_<account holder>.pdf"), any cell, any
// narration, any balance. Only the extension and a rounded size. The report is
// shown to the CA and copied by them if they choose; nothing sends it anywhere.

export type ImportFailure = {
  /** The pipeline stage in flight when it broke. */
  stage: string;
  errorName: string;
  message: string;
  /** File shape only — never the name. */
  format: string;
  sizeKb: number;
  /** Top frames, which name the failing function even when minified. */
  frames: string[];
};

/**
 * The browser features this tool actually depends on. Each line is a plain
 * yes/no, because the usual cause of a cryptic TypeError on an older iPhone is
 * one of them being missing.
 */
export function browserCapabilities(): string[] {
  if (typeof window === "undefined") return [];

  const has = (label: string, present: boolean) => `${label}: ${present ? "yes" : "NO"}`;

  let wasmSimd = false;
  try {
    // The shortest module that uses a SIMD opcode (v128.const). If the browser
    // cannot validate it, onnxruntime cannot run here either.
    wasmSimd = WebAssembly.validate(
      new Uint8Array([
        0, 97, 115, 109, 1, 0, 0, 0, 1, 5, 1, 96, 0, 1, 123, 3, 2, 1, 0, 10, 10, 1, 8, 0, 65, 0,
        253, 15, 253, 98, 11,
      ])
    );
  } catch {
    wasmSimd = false;
  }

  return [
    `userAgent: ${window.navigator.userAgent}`,
    has("WebAssembly", typeof WebAssembly !== "undefined"),
    has("WebAssembly SIMD", wasmSimd),
    has("Web Workers", typeof Worker !== "undefined"),
    has("IndexedDB", typeof indexedDB !== "undefined"),
    has("Promise.withResolvers", typeof (Promise as { withResolvers?: unknown }).withResolvers === "function"),
    has("Map.getOrInsertComputed", typeof (Map.prototype as { getOrInsertComputed?: unknown }).getOrInsertComputed === "function"),
    has("Object.groupBy", typeof (Object as { groupBy?: unknown }).groupBy === "function"),
    has("Array.at", typeof Array.prototype.at === "function"),
    has("Array.findLast", typeof Array.prototype.findLast === "function"),
    has("structuredClone", typeof structuredClone === "function"),
  ];
}

/** The first few stack frames, trimmed of absolute URLs. */
export function stackFrames(error: unknown, limit = 4): string[] {
  const stack = (error as { stack?: string })?.stack;
  if (typeof stack !== "string") return [];
  return stack
    .split("\n")
    .slice(0, limit + 1)
    .map((line) => line.trim())
    .filter((line) => line.length > 0 && !line.startsWith("Error"))
    .map((line) => line.replace(/https?:\/\/[^\s)]+\//g, ""))
    .slice(0, limit);
}

export function describeFailure(
  error: unknown,
  stage: string,
  file: { name: string; size: number }
): ImportFailure {
  const extension = file.name.includes(".")
    ? file.name.slice(file.name.lastIndexOf(".")).toLowerCase()
    : "(none)";

  return {
    stage,
    errorName: error instanceof Error ? error.name : typeof error,
    message: error instanceof Error ? error.message : String(error),
    format: extension,
    sizeKb: Math.round(file.size / 1024),
    frames: stackFrames(error),
  };
}

/** The block the CA can copy and send. Contains nothing from the statement. */
export function formatDiagnostics(failure: ImportFailure): string {
  return [
    "Bank Statement Analyzer — import failure",
    `stage: ${failure.stage}`,
    `error: ${failure.errorName}: ${failure.message}`,
    `file: ${failure.format}, ${failure.sizeKb} KB`,
    ...(failure.frames.length > 0 ? [`at: ${failure.frames.join(" | ")}`] : []),
    ...browserCapabilities(),
    "(no statement content is included in this report)",
  ].join("\n");
}
