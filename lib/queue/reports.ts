// Report aggregations for the queue.
//
// The owner has one question the counter screen cannot answer: when is the
// room full, and is one desk enough? Everything here exists to answer it —
// the by-hour load row above all, which is the number that decides whether a
// second person comes in at 11am.

import {
  averageServiceMinutes,
  averageWaitMinutes,
  serviceMinutes,
  waitMinutes,
} from "./calc";
import type { Counter, Service, Token } from "./types";

export type DayTotals = {
  date: string;
  issued: number;
  served: number;
  skipped: number;
  cancelled: number;
  /** Still open at the time of reading — only ever non-zero for today. */
  open: number;
};

export function totalsByDay(tokens: Token[]): DayTotals[] {
  const byDate = new Map<string, DayTotals>();
  for (const token of tokens) {
    const row =
      byDate.get(token.date) ??
      { date: token.date, issued: 0, served: 0, skipped: 0, cancelled: 0, open: 0 };
    row.issued += 1;
    if (token.status === "served") row.served += 1;
    else if (token.status === "skipped") row.skipped += 1;
    else if (token.status === "cancelled") row.cancelled += 1;
    else row.open += 1;
    byDate.set(token.date, row);
  }
  return Array.from(byDate.values()).sort((a, b) => (a.date < b.date ? 1 : -1));
}

export type HourLoad = { hour: number; issued: number };

/**
 * Tokens issued per hour of the day.
 *
 * Issued, not served: the question is when people *arrive*, which is when
 * staffing has to be ready. Serving times only tell you when the desk got
 * round to them, which is the symptom, not the cause.
 */
export function loadByHour(tokens: Token[]): HourLoad[] {
  const hours: HourLoad[] = Array.from({ length: 24 }, (_, hour) => ({ hour, issued: 0 }));
  for (const token of tokens) {
    const at = new Date(token.issuedAt);
    if (Number.isNaN(at.getTime())) continue;
    hours[at.getHours()].issued += 1;
  }
  return hours;
}

/** The busiest stretch, for the one-line summary above the chart. */
export function peakHour(hours: HourLoad[]): HourLoad | null {
  let peak: HourLoad | null = null;
  for (const row of hours) {
    if (row.issued > 0 && (!peak || row.issued > peak.issued)) peak = row;
  }
  return peak;
}

export function formatHourRange(hour: number): string {
  const label = (h: number) => {
    const suffix = h < 12 ? "am" : "pm";
    const value = h % 12 === 0 ? 12 : h % 12;
    return `${value}${suffix}`;
  };
  return `${label(hour)}–${label((hour + 1) % 24)}`;
}

export type CounterPerformance = {
  counterId: string;
  name: string;
  staffName: string;
  served: number;
  averageWait: number | null;
  averageService: number | null;
};

export function performanceByCounter(
  tokens: Token[],
  counters: Counter[]
): CounterPerformance[] {
  return counters
    .map((counter) => {
      const mine = tokens.filter((token) => token.counterId === counter.id);
      return {
        counterId: counter.id,
        name: counter.name,
        staffName: counter.staffName,
        served: mine.filter((token) => token.status === "served").length,
        averageWait: averageWaitMinutes(mine),
        averageService: averageServiceMinutes(mine),
      };
    })
    .sort((a, b) => b.served - a.served);
}

export type ServiceDemand = {
  serviceId: string;
  name: string;
  colour: string;
  issued: number;
  served: number;
  share: number;
  averageService: number | null;
};

export function demandByService(tokens: Token[], services: Service[]): ServiceDemand[] {
  const total = tokens.length || 1;
  return services
    .map((service) => {
      const mine = tokens.filter((token) => token.serviceId === service.id);
      return {
        serviceId: service.id,
        name: service.name,
        colour: service.colour,
        issued: mine.length,
        served: mine.filter((token) => token.status === "served").length,
        share: mine.length / total,
        averageService: averageServiceMinutes(mine),
      };
    })
    .filter((row) => row.issued > 0)
    .sort((a, b) => b.issued - a.issued);
}

export type QueueSummary = {
  issued: number;
  served: number;
  skipped: number;
  cancelled: number;
  /** Skipped as a share of everyone who was actually called. */
  noShowRate: number;
  averageWait: number | null;
  averageService: number | null;
};

export function summarise(tokens: Token[]): QueueSummary {
  const served = tokens.filter((token) => token.status === "served").length;
  const skipped = tokens.filter((token) => token.status === "skipped").length;
  const cancelled = tokens.filter((token) => token.status === "cancelled").length;
  // A no-show is someone who was called and did not come. Tokens that were
  // never called cannot be no-shows, so they stay out of the denominator —
  // otherwise a busy afternoon with a long tail of waiting people makes the
  // rate look better the worse the queue gets.
  const called = served + skipped;
  return {
    issued: tokens.length,
    served,
    skipped,
    cancelled,
    noShowRate: called > 0 ? skipped / called : 0,
    averageWait: averageWaitMinutes(tokens),
    averageService: averageServiceMinutes(tokens),
  };
}

/** "12 min", "1 hr 5 min", or a dash when there is nothing to measure. */
export function formatMinutes(minutes: number | null): string {
  if (minutes === null || Number.isNaN(minutes)) return "—";
  const rounded = Math.round(minutes);
  if (rounded < 60) return `${rounded} min`;
  const hours = Math.floor(rounded / 60);
  const rest = rounded % 60;
  return rest === 0 ? `${hours} hr` : `${hours} hr ${rest} min`;
}

export function formatClock(iso: string | null): string {
  if (!iso) return "—";
  const at = new Date(iso);
  if (Number.isNaN(at.getTime())) return "—";
  return at.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true });
}

/** Per-token row used by both History and the CSV export. */
export type TokenRow = {
  token: Token;
  label: string;
  serviceName: string;
  counterName: string;
  waited: number | null;
  serviceTime: number | null;
};

export function tokenRows(
  tokens: Token[],
  services: Service[],
  counters: Counter[]
): TokenRow[] {
  const serviceById = new Map(services.map((service) => [service.id, service]));
  const counterById = new Map(counters.map((counter) => [counter.id, counter]));
  return tokens.map((token) => {
    const service = serviceById.get(token.serviceId);
    const prefix = service?.prefix?.trim() ?? "";
    return {
      token,
      label: prefix ? `${prefix}-${token.number}` : String(token.number),
      serviceName: service?.name ?? "Removed service",
      counterName: token.counterId ? counterById.get(token.counterId)?.name ?? "—" : "—",
      waited: waitMinutes(token),
      serviceTime: serviceMinutes(token),
    };
  });
}
