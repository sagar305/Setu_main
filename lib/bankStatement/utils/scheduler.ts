// Keeping a 500-page statement from freezing the browser.
// ---------------------------------------------------------------------------
// The original spec asked for dedicated Web Workers. Two things changed that:
//
//   1. PDF.js already runs its parse in its own worker, so the expensive half
//      of a PDF import is genuinely off the main thread already.
//   2. The remaining passes (normalise, classify, analyse) are array walks over
//      a few thousand rows. Marshalling them into a bundled worker inside
//      Next.js buys less than it costs in build fragility.
//
// So instead of a worker we run those passes in chunks and yield to the event
// loop between them. The UI stays responsive and progress is real — it comes
// from the loop itself, never a fake timer (§22, decision 27).

export type ChunkProgress = (current: number, total: number) => void;

/** Hand the main thread back so paint and input can happen between chunks. */
export function yieldToBrowser(): Promise<void> {
  return new Promise((resolve) => {
    if (typeof window === "undefined") {
      resolve();
      return;
    }
    // A macrotask, so React commits and the browser paints before we continue.
    window.setTimeout(resolve, 0);
  });
}

/**
 * Map over `items` in chunks, yielding between each so the UI can breathe.
 * Reports true progress after every chunk.
 */
export async function mapInChunks<T, R>(
  items: T[],
  fn: (item: T, index: number) => R,
  options: { chunkSize?: number; onProgress?: ChunkProgress } = {}
): Promise<R[]> {
  const chunkSize = options.chunkSize ?? 500;
  const results: R[] = new Array(items.length);

  for (let start = 0; start < items.length; start += chunkSize) {
    const end = Math.min(start + chunkSize, items.length);
    for (let i = start; i < end; i += 1) results[i] = fn(items[i], i);
    options.onProgress?.(end, items.length);
    if (end < items.length) await yieldToBrowser();
  }

  if (items.length === 0) options.onProgress?.(0, 0);
  return results;
}

/** Run a sequence of named stages, reporting which one is in flight. */
export async function runStages(
  stages: { name: string; run: () => void | Promise<void> }[],
  onStage: (index: number, name: string) => void
): Promise<void> {
  for (let i = 0; i < stages.length; i += 1) {
    onStage(i, stages[i].name);
    await yieldToBrowser();
    await stages[i].run();
  }
}
