// Setu Business Toolkit — Central Workspace Migration Layer (Q8)
// ---------------------------------------------------------------------------
// Schema evolution is handled ONCE, centrally — not by every tool. On app load
// we read the stored workspace version, run any pending migrations in order,
// then hand tools a workspace guaranteed to be at the latest shape. Tools never
// contain migration logic and never branch on old shapes.
//
//   stored version 1 ──► migration 2 ──► migration 3 ──► WORKSPACE_VERSION
//
// This is distinct from lib/pos/db's DB_VERSION, which only creates missing
// IndexedDB *stores*. Migrations here transform *records* (e.g. add EntityMeta
// to legacy rows, split a field, backfill a default).

/** Current workspace schema version. Bump when adding a migration below. */
export const WORKSPACE_VERSION = 1;

/** Where the stored version marker lives (tiny meta — localStorage is fine). */
const VERSION_KEY = "setu:workspace:version";

export type Migration = {
  /** Version this migration upgrades the workspace TO. */
  to: number;
  describe: string;
  run: () => Promise<void>;
};

/**
 * Ordered migrations. Each `run` upgrades from `to - 1` to `to`. Append only;
 * never edit a shipped migration.
 *
 * Example of a future migration (kept commented as the pattern to follow):
 *
 *   {
 *     to: 2,
 *     describe: "Backfill EntityMeta on legacy products",
 *     run: async () => {
 *       const products = await getProducts();
 *       await dbBatch({ products: products.map(withDefaultMeta) });
 *     },
 *   },
 */
export const MIGRATIONS: Migration[] = [];

function readStoredVersion(): number {
  if (typeof window === "undefined") return WORKSPACE_VERSION;
  const raw = window.localStorage.getItem(VERSION_KEY);
  const n = raw ? Number.parseInt(raw, 10) : 0;
  return Number.isFinite(n) ? n : 0;
}

function writeStoredVersion(v: number): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(VERSION_KEY, String(v));
}

/**
 * Run every pending migration in order, then record the new version. Call once
 * on app start, before any tool reads the workspace. Idempotent: a workspace
 * already at WORKSPACE_VERSION does nothing.
 */
export async function runWorkspaceMigrations(): Promise<void> {
  const from = readStoredVersion();
  if (from >= WORKSPACE_VERSION) {
    writeStoredVersion(WORKSPACE_VERSION);
    return;
  }
  const pending = MIGRATIONS.filter((m) => m.to > from).sort((a, b) => a.to - b.to);
  for (const migration of pending) {
    await migration.run();
    writeStoredVersion(migration.to);
  }
  writeStoredVersion(WORKSPACE_VERSION);
}
