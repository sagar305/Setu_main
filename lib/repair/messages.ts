// WhatsApp message building for the repair shop.
//
// Nothing here sends anything. The app has no server and no login, so it can
// only prepare the text and hand it to WhatsApp — the counter taps send, one
// customer at a time. That is a deliberate limit of the offline model, and it
// is also why estimate approval cannot be read back: a customer replying "YES"
// replies to a person, not to this app, and the technician ticks it manually.

import { getWhatsAppShareUrl } from "@/lib/share";
import type { Business } from "@/lib/pos/types";
import {
  deviceLabel,
  formatDate,
  whatsAppNumber,
  type Customer,
  type Job,
  type RepairSettings,
  type RepairTemplateKey,
} from "./types";
import { billTotals, readySince, warrantyEndOf } from "./calc";

export type MessageVars = Record<string, string | number | undefined | null>;

/**
 * Replace {{placeholders}} with values.
 *
 * Double braces, as §5 writes them. Unknown placeholders are stripped so a
 * half-edited template never sends "{{amount}}" to a customer, and the
 * whitespace tidy-up afterwards stops a stripped token leaving a double space
 * in the middle of a sentence.
 */
export function fillTemplate(template: string, vars: MessageVars): string {
  return template
    .replace(/\{\{(\w+)\}\}/g, (_match, key: string) => {
      const value = vars[key];
      return value === undefined || value === null ? "" : String(value);
    })
    .replace(/[ \t]{2,}/g, " ")
    .trim();
}

export function whatsAppLink(phone: string, message: string): string {
  const number = whatsAppNumber(phone);
  return getWhatsAppShareUrl(message, number || undefined);
}

export function smsLink(phone: string, message: string): string {
  const digits = (phone || "").replace(/[^\d+]/g, "");
  // iOS wants &body=, Android accepts ?body= — the ?& form works on both.
  return `sms:${digits}?&body=${encodeURIComponent(message)}`;
}

/**
 * A figure for the middle of a sentence.
 *
 * The templates already carry their own ₹, and a shop writing "Estimate ₹1,200"
 * does not mean "₹1,200.00" — so this groups in the Indian style and drops the
 * decimals when there are none, rather than reusing the money formatter that
 * exists for columns of figures that have to line up.
 */
function amountText(value: number): string {
  return new Intl.NumberFormat("en-IN", { maximumFractionDigits: 2 }).format(
    Number.isFinite(value) ? value : 0
  );
}

/** One prepared, unsent message in a send queue. */
export type OutboundMessage = {
  id: string;
  name: string;
  phone: string;
  message: string;
  ref?: string;
};

/**
 * Every variable §5 names, filled from one job.
 *
 * `amount` is the estimate while the job is being quoted and the billed total
 * once there is a bill, because those are the two different numbers a customer
 * is told at those two different moments. `workSummary` falls back from the
 * technician's diagnosis to what the customer themselves reported, which is at
 * least a description they will recognise.
 */
export function jobVars(
  job: Job,
  customer: Customer | null,
  business: Business | null,
  settings: RepairSettings,
  invoiceNo = ""
): MessageVars {
  const totals = billTotals(job, settings);
  const amount =
    totals.total > 0
      ? totals.total
      : job.estimateAmount !== null
        ? job.estimateAmount
        : 0;

  return {
    shopName: business?.name || "Our shop",
    customerName: customer?.name ?? "",
    device: deviceLabel(job),
    jobNo: job.jobNo,
    promisedDate: job.promisedDate ? formatDate(job.promisedDate) : "as soon as possible",
    amount: amountText(amount),
    workSummary: job.diagnosis || job.reportedProblems.join(", ") || "a repair",
    readyDate: formatDate(readySince(job)),
    warrantyEnd: warrantyEndOf(job) ? formatDate(warrantyEndOf(job)) : "—",
    invoiceNo,
    upiId: business?.upiId ?? "",
  };
}

export function jobMessage(
  key: RepairTemplateKey,
  job: Job,
  customer: Customer | null,
  business: Business | null,
  settings: RepairSettings,
  invoiceNo = ""
): string {
  return fillTemplate(
    settings.messageTemplates[key],
    jobVars(job, customer, business, settings, invoiceNo)
  );
}

export function outboundFor(
  key: RepairTemplateKey,
  job: Job,
  customer: Customer | null,
  business: Business | null,
  settings: RepairSettings,
  invoiceNo = ""
): OutboundMessage {
  return {
    id: job.id,
    name: customer?.name || "Customer",
    phone: customer?.phone ?? "",
    message: jobMessage(key, job, customer, business, settings, invoiceNo),
    ref: job.jobNo,
  };
}

/** The chase list for devices sitting on the ready shelf. */
export function uncollectedMessages(
  jobs: Job[],
  customers: Customer[],
  business: Business | null,
  settings: RepairSettings
): OutboundMessage[] {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  return jobs.map((job) =>
    outboundFor("uncollected", job, customerById.get(job.customerId) ?? null, business, settings)
  );
}

/** What each template is for, in the Settings list. */
export const TEMPLATE_LABELS: Record<RepairTemplateKey, string> = {
  received: "Device received",
  estimateRequest: "Estimate — asking for approval",
  inRepair: "Repair started",
  awaitingParts: "Waiting for a part",
  ready: "Ready for pickup",
  uncollected: "Still not collected",
  delivered: "Delivered, with warranty",
};
