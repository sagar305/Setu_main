// Insights: answers that need more than adding up a period's sales.
//
//   - Top customers by what they've spent (any period).
//   - Regulars who have stopped coming: customers with a real visit habit
//     whose last visit is now well past their usual gap — worth a call.
//   - Most frequent customers, and new customers in a period.
//   - Slow movers: stocked products that haven't sold lately.
//   - Busiest day of the week and hour of the day.
//
// All of it is read from saved, completed bills. Walk-in sales have no
// customer, so customer insights cover saved customers only and say so.

import type { AgentReply, AssistantData, Period } from "./agent";
import { readPeriod } from "./agent";
import { formatMoney, type Customer, type Order } from "@/lib/pos/types";

const DAY_MS = 86_400_000;

/** A regular has at least this many visits. */
export const REGULAR_MIN_VISITS = 3;
/** …and counts as missing once the gap since their last visit is this many times their usual one. */
export const LAPSED_FACTOR = 2;
/** Never call someone missing before this many days, however often they came. */
export const LAPSED_MIN_DAYS = 14;

export type CustomerStats = {
  customer: Customer;
  visits: number;
  spent: number;
  firstVisit: Date;
  lastVisit: Date;
  /** Median days between visits; null with fewer than two visits. */
  usualGapDays: number | null;
  daysSinceLast: number;
};

function completed(orders: Order[]): Order[] {
  return orders.filter((o) => o.status === "completed");
}

function median(values: number[]): number | null {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function customerStats(data: AssistantData, now: Date, period?: Period): CustomerStats[] {
  const byCustomer = new Map<string, Order[]>();
  for (const order of completed(data.orders)) {
    if (!order.customerId) continue;
    const t = new Date(order.date).getTime();
    if (period && (t < period.start.getTime() || t >= period.end.getTime())) continue;
    const list = byCustomer.get(order.customerId) ?? [];
    list.push(order);
    byCustomer.set(order.customerId, list);
  }

  const stats: CustomerStats[] = [];
  for (const [id, orders] of byCustomer) {
    const customer = data.customers.find((c) => c.id === id);
    if (!customer) continue;
    // Several bills on one day are one visit.
    const days = [...new Set(orders.map((o) => Math.floor(new Date(o.date).getTime() / DAY_MS)))].sort((a, b) => a - b);
    const gaps = days.slice(1).map((day, i) => day - days[i]);
    const last = new Date(Math.max(...orders.map((o) => new Date(o.date).getTime())));
    stats.push({
      customer,
      visits: days.length,
      spent: orders.reduce((sum, o) => sum + o.total, 0),
      firstVisit: new Date(Math.min(...orders.map((o) => new Date(o.date).getTime()))),
      lastVisit: last,
      usualGapDays: median(gaps),
      daysSinceLast: Math.floor((now.getTime() - last.getTime()) / DAY_MS),
    });
  }
  return stats;
}

/** Regulars overdue for a visit, most overdue first. */
export function lapsedRegulars(data: AssistantData, now: Date): (CustomerStats & { overdueBy: number })[] {
  return customerStats(data, now)
    .filter((s) => s.visits >= REGULAR_MIN_VISITS && s.usualGapDays !== null)
    .map((s) => {
      const expected = Math.max(LAPSED_FACTOR * Math.max(s.usualGapDays!, 1), LAPSED_MIN_DAYS);
      return { ...s, overdueBy: s.daysSinceLast / expected };
    })
    .filter((s) => s.overdueBy >= 1)
    .sort((a, b) => b.overdueBy - a.overdueBy || b.spent - a.spent);
}

function ago(days: number): string {
  if (days <= 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 60) return `${days} days ago`;
  return `${Math.round(days / 30)} months ago`;
}

function every(days: number): string {
  if (days <= 1) return "almost daily";
  if (days < 14) return `about every ${Math.round(days)} days`;
  return `about every ${Math.round(days / 7)} weeks`;
}

function walkInShare(data: AssistantData, period: Period | null): string | null {
  const orders = completed(data.orders).filter((o) => {
    if (!period) return true;
    const t = new Date(o.date).getTime();
    return t >= period.start.getTime() && t < period.end.getTime();
  });
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  if (total === 0) return null;
  const walkIn = orders.filter((o) => !o.customerId).reduce((sum, o) => sum + o.total, 0);
  return `Walk-in (unsaved) customers: ${Math.round((walkIn / total) * 100)}% of sales`;
}

const CUSTOMER = "(customers?|grahak|clients?|buyers?|people)";

export function insightsReply(text: string, data: AssistantData, now: Date): AgentReply | null {
  const currency = data.business?.currency || "INR";
  const period = readPeriod(text, now);

  // Regulars who stopped coming.
  if (
    new RegExp(`\\b(lost|lapsed|inactive|missing|stopped coming|not coming|haven ?t (come|came|visited)|have not (come|visited)|didn ?t come|not (come|came|visited|seen)|long (time|ago)|absent|nahi aaye|nahi aa rahe|gayab|chhod)\\b`).test(text) &&
    (new RegExp(`\\b${CUSTOMER}\\b`).test(text) || /\b(who|kaun|regulars?)\b/.test(text))
  ) {
    const lapsed = lapsedRegulars(data, now);
    if (lapsed.length === 0) {
      const regulars = customerStats(data, now).filter((s) => s.visits >= REGULAR_MIN_VISITS).length;
      return {
        text: regulars === 0
          ? `No regulars yet — a regular is a saved customer with ${REGULAR_MIN_VISITS}+ visits. Pick the customer at checkout to build their history.`
          : `Good news — all ${regulars} regular customer${regulars === 1 ? " is" : "s are"} still coming on their usual schedule.`,
      };
    }
    return {
      text: `${lapsed.length} regular${lapsed.length === 1 ? " has" : "s have"} stopped coming — worth a call:`,
      bullets: lapsed.slice(0, 8).map(
        (s) =>
          `${s.customer.name}${s.customer.phone ? ` (${s.customer.phone})` : ""} — last came ${ago(s.daysSinceLast)}, usually ${every(s.usualGapDays!)}; ${s.visits} visits, ${formatMoney(s.spent, currency)}`
      ),
      link: { screen: "customers", label: "Open Customers" },
      suggestions: ["Top customers", "Most regular customers"],
    };
  }

  // Top customers by revenue.
  if (
    (new RegExp(`\\b(top|best|biggest|most valuable|highest|vip|sabse (bade|zyada|acche))\\b.*\\b${CUSTOMER}\\b`).test(text) ||
      new RegExp(`\\b${CUSTOMER}\\b.*\\b(most|highest|sabse zyada)\\b.*\\b(revenue|spent|spend|sales|money|business|kharida|bought|paisa)\\b`).test(text) ||
      /\bwhich customer\b.*\b(most|highest|sabse)\b/.test(text) ||
      /\b(most revenue|highest revenue)\b.*\bcustomer/.test(text)) &&
    !/\b(frequent|regular|often|visits?)\b/.test(text)
  ) {
    const ranked = customerStats(data, now, period ?? undefined).sort((a, b) => b.spent - a.spent).slice(0, 5);
    if (ranked.length === 0) {
      return { text: `No sales to saved customers ${period?.label ?? "yet"}. Pick a customer at checkout to track who buys most.` };
    }
    const share = walkInShare(data, period);
    return {
      text: `Top customers by spend ${period?.label ?? "of all time"}:`,
      bullets: [
        ...ranked.map((s, i) => `${i + 1}. ${s.customer.name} — ${formatMoney(s.spent, currency)} from ${s.visits} visit${s.visits === 1 ? "" : "s"}`),
        ...(share ? [share] : []),
      ],
      link: { screen: "customers", label: "Open Customers" },
      suggestions: ["Regulars who stopped coming", "Most regular customers"],
    };
  }

  // Most frequent / regular customers.
  if (new RegExp(`\\b(most (frequent|regular|loyal)|regular|loyal|frequent|often|baar baar)\\b.*\\b${CUSTOMER}\\b|\\b${CUSTOMER}\\b.*\\b(come|visit|aate)\\b.*\\b(most|often|zyada)\\b`).test(text)) {
    const ranked = customerStats(data, now, period ?? undefined).sort((a, b) => b.visits - a.visits || b.spent - a.spent).slice(0, 5);
    if (ranked.length === 0) return { text: "No saved customers have bought anything yet." };
    return {
      text: `Most frequent customers ${period?.label ?? "of all time"}:`,
      bullets: ranked.map((s) => `${s.customer.name} — ${s.visits} visits${s.usualGapDays ? `, ${every(s.usualGapDays)}` : ""}, last ${ago(s.daysSinceLast)}`),
      suggestions: ["Regulars who stopped coming", "Top customers"],
    };
  }

  // New customers.
  if (new RegExp(`\\bnew\\s+${CUSTOMER}\\b|\\bnaye\\s+grahak\\b`).test(text) && !/^(add|create|save)\b/.test(text)) {
    const p = period ?? readPeriod("this month", now)!;
    const all = customerStats(data, now);
    const fresh = all.filter((s) => s.firstVisit >= p.start && s.firstVisit < p.end).sort((a, b) => b.spent - a.spent);
    return {
      text: fresh.length === 0 ? `No new customers ${p.label}.` : `${fresh.length} new customer${fresh.length === 1 ? "" : "s"} ${p.label}:`,
      bullets: fresh.slice(0, 8).map((s) => `${s.customer.name} — ${formatMoney(s.spent, currency)}, ${s.visits} visit${s.visits === 1 ? "" : "s"}`),
    };
  }

  // Customer overview.
  if (new RegExp(`^(customer|grahak)s? (insights?|report|analysis|summary|overview)$|^(insights?|analysis) (on|about|of) ${CUSTOMER}$`).test(text)) {
    const stats = customerStats(data, now);
    const monthStart = readPeriod("this month", now)!.start;
    const active = stats.filter((s) => s.lastVisit >= monthStart).length;
    const top = [...stats].sort((a, b) => b.spent - a.spent)[0];
    const lapsed = lapsedRegulars(data, now);
    return {
      text: "Customer insights:",
      bullets: [
        `${data.customers.length} saved customers; ${active} bought this month`,
        ...(top ? [`Top spender: ${top.customer.name} — ${formatMoney(top.spent, currency)}`] : []),
        `${stats.filter((s) => s.visits >= REGULAR_MIN_VISITS).length} regulars (${REGULAR_MIN_VISITS}+ visits); ${lapsed.length} have stopped coming`,
        ...([walkInShare(data, null)].filter(Boolean) as string[]),
      ],
      suggestions: ["Top customers", "Regulars who stopped coming", "New customers this month"],
    };
  }

  // Slow movers: stocked products with no sale lately.
  if (/\b(slow|not selling|nahi bik|dead stock|stuck|unsold|not sold)\b/.test(text)) {
    const days = 30;
    const since = now.getTime() - days * DAY_MS;
    const recentOrderIds = new Set(completed(data.orders).filter((o) => new Date(o.date).getTime() >= since).map((o) => o.id));
    const soldRecently = new Set(data.orderItems.filter((i) => recentOrderIds.has(i.orderId)).map((i) => i.productId));
    const slow = data.products
      .filter((p) => p.trackStock && p.stock > 0 && !soldRecently.has(p.id))
      .sort((a, b) => b.stock * (b.costPrice ?? b.sellingPrice) - a.stock * (a.costPrice ?? a.sellingPrice));
    if (slow.length === 0) return { text: `Everything in stock has sold in the last ${days} days.` };
    return {
      text: `${slow.length} product${slow.length === 1 ? " hasn't" : "s haven't"} sold in ${days} days but ${slow.length === 1 ? "is" : "are"} in stock:`,
      bullets: slow.slice(0, 8).map((p) => `${p.name} — ${p.stock} in stock, ${formatMoney(p.stock * (p.costPrice ?? p.sellingPrice), currency)} ${p.costPrice !== null ? "at cost" : "at selling price"}`),
      link: { screen: "products", label: "Open Products" },
    };
  }

  // Busiest day and hour.
  if (/\b(busiest|busy|peak|rush|best day|best time|bheed|zyada bheed)\b/.test(text)) {
    const orders = completed(data.orders).filter((o) => {
      if (!period) return true;
      const t = new Date(o.date).getTime();
      return t >= period.start.getTime() && t < period.end.getTime();
    });
    if (orders.length < 5) return { text: "Not enough sales yet to see a pattern — ask again after a few more days of billing." };
    const dayNames = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
    const byDay = new Array(7).fill(0);
    const byHour = new Array(24).fill(0);
    for (const o of orders) {
      const d = new Date(o.date);
      byDay[d.getDay()] += o.total;
      byHour[d.getHours()] += 1;
    }
    const bestDay = byDay.indexOf(Math.max(...byDay));
    const bestHour = byHour.indexOf(Math.max(...byHour));
    const hourLabel = (h: number) => `${((h + 11) % 12) + 1} ${h < 12 ? "am" : "pm"}`;
    return {
      text: `Busiest day: ${dayNames[bestDay]}. Busiest hour: ${hourLabel(bestHour)}–${hourLabel((bestHour + 1) % 24)}.`,
      bullets: [
        `${dayNames[bestDay]} brought ${formatMoney(byDay[bestDay], currency)} ${period?.label ?? "in total"}`,
        `${byHour[bestHour]} bills were made in that hour`,
      ],
    };
  }

  return null;
}
