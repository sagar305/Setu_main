// WhatsApp message building for the pharmacy.
//
// Nothing here sends a message. The app has no server and no login, so it can
// only prepare the text and hand it to WhatsApp — the counter taps send, one
// customer at a time. That is a deliberate limit of the offline model.
//
// Refill reminders in particular are held to a low bar on purpose: only a
// customer who was attached to a bill and had a days-supply entered gets one,
// and the reminder names the medicine rather than describing a condition.

import { getWhatsAppShareUrl } from "@/lib/share";
import { formatMoney } from "@/lib/pos/types";
import {
  formatDate,
  whatsAppNumber,
  type Customer,
  type Medicine,
  type PharmacySettings,
  type RefillReminder,
  type Sale,
} from "./types";
import { saleDue } from "./calc";

export type MessageVars = Record<string, string | number | undefined>;

/**
 * Replace {placeholders} with values. Unknown placeholders are stripped so a
 * half-edited template never sends "{amount}" to a customer.
 */
export function fillTemplate(template: string, vars: MessageVars): string {
  return template
    .replace(/\{(\w+)\}/g, (_match, key: string) => {
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

/** One prepared, unsent message in a send queue. */
export type OutboundMessage = {
  id: string;
  name: string;
  phone: string;
  message: string;
  ref?: string;
};

export const MESSAGE_PLACEHOLDERS: { token: string; meaning: string }[] = [
  { token: "{customer}", meaning: "Customer's name" },
  { token: "{shop}", meaning: "Your shop's name" },
  { token: "{medicine}", meaning: "Medicine name" },
  { token: "{date}", meaning: "Refill due date" },
  { token: "{amount}", meaning: "Amount, formatted" },
  { token: "{invoice}", meaning: "Bill number" },
];

export function refillMessages(
  reminders: RefillReminder[],
  customers: Customer[],
  medicines: Medicine[],
  settings: PharmacySettings,
  shopName: string
): OutboundMessage[] {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const medicineById = new Map(medicines.map((medicine) => [medicine.id, medicine]));

  return reminders.flatMap((reminder) => {
    const customer = customerById.get(reminder.customerId);
    const medicine = medicineById.get(reminder.medicineId);
    if (!customer) return [];
    return [
      {
        id: reminder.id,
        name: customer.name,
        phone: customer.phone,
        message: fillTemplate(settings.messageTemplates.refillDue, {
          customer: customer.name,
          shop: shopName,
          medicine: medicine?.name ?? "your medicine",
          date: formatDate(reminder.nextDueOn),
        }),
      },
    ];
  });
}

export function duesMessages(
  sales: Sale[],
  customers: Customer[],
  settings: PharmacySettings,
  shopName: string,
  currency: string
): OutboundMessage[] {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));

  return sales.flatMap((sale) => {
    if (!sale.customerId) return [];
    const due = saleDue(sale);
    if (due <= 0) return [];
    const customer = customerById.get(sale.customerId);
    if (!customer) return [];
    return [
      {
        id: sale.id,
        name: customer.name,
        phone: customer.phone,
        message: fillTemplate(settings.messageTemplates.duesReminder, {
          customer: customer.name,
          shop: shopName,
          amount: formatMoney(due, currency),
          invoice: sale.invoiceNo,
        }),
      },
    ];
  });
}
