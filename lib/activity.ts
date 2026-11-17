// ---------------------------------------------------------------------------
// Product milestones: "an order was created", "a student was added".
//
// The free apps keep a shop's real work on the device, and nothing in them may
// import the measurement pipeline (tests/analytics/boundary.test.ts). But a
// click on a button labelled "Save" says nothing about what was saved, so the
// apps announce the milestone themselves, through this file, as a browser
// event that anything may listen to and nothing has to.
//
// What makes that safe is how little can be said. A signal is a product, a
// name from the fixed list below, and optionally a whole-number count (rows in
// an import). There is no field a bill amount, a patient name or a phone
// number could travel in, and the listener re-checks every signal against the
// same list before it counts it.
//
// This file imports nothing, on purpose. Adding a milestone means adding its
// name here and one `reportActivity` call after the write that it describes
// has succeeded.
// ---------------------------------------------------------------------------

/** The browser event the apps announce on. */
export const ACTIVITY_EVENT = "setu:activity";

/** Every milestone an app may announce, by product. */
export const PRODUCT_ACTIVITIES = {
  pos: [
    "setup_completed",
    "product_created",
    "customer_created",
    "order_created",
    "order_cancelled",
    "sales_imported",
    "cart_held",
    "sheet_connected",
    "backup_restored",
  ],
  dine: [
    "setup_completed",
    "menu_item_created",
    "menu_imported",
    "table_created",
    "customer_created",
    "order_created",
    "kot_sent",
    "bill_created",
    "payment_received",
    "order_cancelled",
    "reservation_created",
    "sheet_connected",
    "backup_restored",
  ],
  tuition: [
    "setup_completed",
    "batch_created",
    "student_created",
    "students_imported",
    "attendance_marked",
    "fees_generated",
    "payment_received",
    "test_created",
    "enquiry_created",
    "sheet_connected",
    "backup_restored",
  ],
  clinic: [
    "setup_completed",
    "doctor_created",
    "patient_registered",
    "patients_imported",
    "appointment_booked",
    "walk_in_added",
    "consult_started",
    "prescription_created",
    "bill_created",
    "payment_received",
    "sheet_connected",
    "backup_restored",
  ],
  repair: [
    "setup_completed",
    "customer_created",
    "job_created",
    "job_delivered",
    "warranty_claim_raised",
    "part_created",
    "estimate_sent",
    "backup_restored",
  ],
  rental: [
    "setup_completed",
    "item_created",
    "customer_created",
    "booking_created",
    "booking_dispatched",
    "booking_returned",
    "booking_cancelled",
    "payment_received",
    "backup_restored",
  ],
  pharmacy: [
    "setup_completed",
    "medicine_created",
    "medicines_imported",
    "supplier_created",
    "customer_created",
    "purchase_created",
    "sale_created",
    "sale_returned",
    "payment_received",
    "backup_restored",
  ],
  token: [
    "setup_completed",
    "service_created",
    "counter_created",
    "token_issued",
    "token_called",
    "token_completed",
    "backup_restored",
  ],
  bank: [
    "statement_imported",
    "sample_loaded",
    "ai_categorisation_run",
    "rule_created",
    "category_created",
    "reconciliation_run",
    "excel_exported",
    "pdf_exported",
    "csv_exported",
  ],
  // The TB Analyser is a separate app (github.com/sagar305/TB-analyser) framed
  // on its product page. It raises the same event on this window from inside
  // its frame, through its own frontend/activity.js; the names must match.
  tb: [
    "sample_loaded",
    "template_downloaded",
    "periods_imported",
    "cash_flow_saved",
    "excel_exported",
    "pdf_exported",
  ],
} as const;

export type ActivityProduct = keyof typeof PRODUCT_ACTIVITIES;
export type ActivityName<P extends ActivityProduct> = (typeof PRODUCT_ACTIVITIES)[P][number];

/** A signal that has been checked against the list. */
export type Activity = { product: ActivityProduct; name: string; count?: number };

/** The most a single signal may claim to have counted. */
const MAX_COUNT = 100_000;

/**
 * Announce a milestone.
 *
 * Call it after the write has succeeded, so a failed save is never counted.
 * It cannot throw and it waits for nothing: with no listener on the page it
 * does nothing at all, and the app carries on exactly as it would have.
 *
 * `count` is for bulk actions only — how many rows an import added.
 */
export function reportActivity<P extends ActivityProduct>(
  product: P,
  name: ActivityName<P>,
  count?: number
): void {
  if (typeof window === "undefined") return;
  try {
    window.dispatchEvent(new CustomEvent(ACTIVITY_EVENT, { detail: { product, name, count } }));
  } catch {
    // A milestone that cannot be announced is not worth a failed save.
  }
}

/**
 * Check what arrived on the event against the list.
 *
 * Anything on the page can dispatch a browser event, so the listener trusts
 * none of it: an unknown product or name is refused, and whatever else the
 * detail carried is left behind rather than copied across.
 */
export function parseActivity(detail: unknown): Activity | null {
  if (typeof detail !== "object" || detail === null) return null;
  const { product, name, count } = detail as Record<string, unknown>;

  if (typeof product !== "string" || !Object.prototype.hasOwnProperty.call(PRODUCT_ACTIVITIES, product)) {
    return null;
  }
  const names: readonly string[] = PRODUCT_ACTIVITIES[product as ActivityProduct];
  if (typeof name !== "string" || !names.includes(name)) return null;

  const activity: Activity = { product: product as ActivityProduct, name };
  // The two analysers read a client's books. They say that a step happened
  // and nothing more.
  if (product === "bank" || product === "tb") return activity;
  if (typeof count === "number" && Number.isInteger(count) && count >= 0) {
    activity.count = Math.min(count, MAX_COUNT);
  }
  return activity;
}
