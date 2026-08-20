import { describe, expect, it } from "vitest";
import {
  activeCountersForService,
  averageServiceMinutes,
  averageWaitMinutes,
  businessDate,
  compareQueue,
  estimateWaitMinutes,
  formatCountdown,
  formatWait,
  isoDate,
  nextInQueue,
  nextResetAt,
  nextTokenNumber,
  queuePosition,
  retentionCutoff,
  secondsUntilSkip,
  skipDeadline,
  spokenToken,
  suggestedServiceMinutes,
  tokensPastDeadline,
  waitingQueue,
} from "@/lib/token/calc";
import type { Counter, Token } from "@/lib/token/types";

function token(overrides: Partial<Token> = {}): Token {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    serviceId: "s1",
    number: 1,
    date: "2026-08-20",
    status: "waiting",
    priority: false,
    counterId: null,
    customerName: "",
    phone: "",
    note: "",
    issuedAt: "2026-08-20T09:00:00.000Z",
    calledAt: null,
    servingStartedAt: null,
    closedAt: null,
    recallCount: 0,
    selfIssued: false,
    reissuedFromId: null,
    reissuedAsId: null,
    ...overrides,
  };
}

function counter(overrides: Partial<Counter> = {}): Counter {
  return {
    id: overrides.id ?? Math.random().toString(36).slice(2),
    name: "Counter 1",
    serviceIds: [],
    staffName: "",
    active: true,
    createdAt: "2026-08-20T08:00:00.000Z",
    ...overrides,
  };
}

describe("the business day", () => {
  it("keeps a late night on the previous day when a reset hour is set", () => {
    const at = new Date(2026, 7, 21, 2, 0, 0);
    expect(businessDate(at, 6)).toBe("2026-08-20");
  });

  it("starts the new day once the reset hour has passed", () => {
    expect(businessDate(new Date(2026, 7, 21, 6, 0, 0), 6)).toBe("2026-08-21");
    expect(businessDate(new Date(2026, 7, 21, 23, 59, 0), 6)).toBe("2026-08-21");
  });

  it("treats midnight reset as the plain calendar date", () => {
    expect(businessDate(new Date(2026, 7, 21, 2, 0, 0), 0)).toBe("2026-08-21");
  });

  it("schedules the next rollover at the reset hour, always in the future", () => {
    const at = new Date(2026, 7, 21, 7, 30, 0);
    const next = nextResetAt(at, 6);
    expect(next.getTime()).toBeGreaterThan(at.getTime());
    expect(isoDate(next)).toBe("2026-08-22");
    expect(next.getHours()).toBe(6);
  });

  it("counts the retention window back in whole days", () => {
    expect(retentionCutoff("2026-08-20", 90)).toBe("2026-05-22");
    expect(retentionCutoff("2026-01-01", 7)).toBe("2025-12-25");
  });
});

describe("numbering", () => {
  const rows = [
    token({ serviceId: "s1", number: 1 }),
    token({ serviceId: "s1", number: 2 }),
    token({ serviceId: "s2", number: 1 }),
    token({ serviceId: "s1", number: 9, date: "2026-08-19" }),
  ];

  it("counts per service, per day, from one", () => {
    expect(nextTokenNumber(rows, "s1", "2026-08-20")).toBe(3);
    expect(nextTokenNumber(rows, "s2", "2026-08-20")).toBe(2);
    expect(nextTokenNumber(rows, "s3", "2026-08-20")).toBe(1);
  });

  it("does not reuse the number of a cancelled token", () => {
    const withCancelled = [...rows, token({ serviceId: "s1", number: 3, status: "cancelled" })];
    expect(nextTokenNumber(withCancelled, "s1", "2026-08-20")).toBe(4);
  });

  it("restarts at one after a manual reset, without deleting the morning", () => {
    const resetAt = "2026-08-20T14:00:00.000Z";
    expect(nextTokenNumber(rows, "s1", "2026-08-20", resetAt)).toBe(1);
    const afterReset = [
      ...rows,
      token({ serviceId: "s1", number: 1, issuedAt: "2026-08-20T14:05:00.000Z" }),
    ];
    expect(nextTokenNumber(afterReset, "s1", "2026-08-20", resetAt)).toBe(2);
  });
});

describe("call order", () => {
  it("puts priority first, then oldest first", () => {
    const early = token({ id: "early", issuedAt: "2026-08-20T09:00:00.000Z" });
    const late = token({ id: "late", issuedAt: "2026-08-20T09:30:00.000Z" });
    const urgent = token({
      id: "urgent",
      priority: true,
      issuedAt: "2026-08-20T09:45:00.000Z",
    });
    const order = [late, early, urgent].sort(compareQueue).map((t) => t.id);
    expect(order).toEqual(["urgent", "early", "late"]);
  });

  it("puts a re-issued token behind everyone waiting, by its new issue time", () => {
    const early = token({ id: "early", issuedAt: "2026-08-20T09:00:00.000Z" });
    const later = token({ id: "later", issuedAt: "2026-08-20T09:10:00.000Z" });
    // Somebody who missed their call at 08:00 and came back at 09:20 holds a
    // token issued at 09:20, so the clock alone puts them last.
    const cameBack = token({
      id: "came-back",
      issuedAt: "2026-08-20T09:20:00.000Z",
      reissuedFromId: "the-skipped-one",
    });
    const order = [cameBack, early, later].sort(compareQueue).map((t) => t.id);
    expect(order).toEqual(["early", "later", "came-back"]);
  });

  it("does not let a re-issued token keep jumping the line on priority", () => {
    const waiting = token({ id: "waiting", issuedAt: "2026-08-20T09:00:00.000Z" });
    const cameBack = token({
      id: "came-back",
      issuedAt: "2026-08-20T09:20:00.000Z",
      priority: false,
      reissuedFromId: "the-skipped-one",
    });
    expect([cameBack, waiting].sort(compareQueue)[0].id).toBe("waiting");
  });

  it("only offers a counter the services it serves", () => {
    const rows = [
      token({ id: "a", serviceId: "s1", issuedAt: "2026-08-20T09:00:00.000Z" }),
      token({ id: "b", serviceId: "s2", issuedAt: "2026-08-20T09:05:00.000Z" }),
    ];
    const payments = counter({ serviceIds: ["s2"] });
    expect(nextInQueue(rows, payments)?.id).toBe("b");
    expect(nextInQueue(rows, counter())?.id).toBe("a");
  });

  it("ignores tokens that are no longer waiting", () => {
    const rows = [
      token({ id: "gone", status: "served", issuedAt: "2026-08-20T08:00:00.000Z" }),
      token({ id: "here", issuedAt: "2026-08-20T09:00:00.000Z" }),
    ];
    expect(waitingQueue(rows)).toHaveLength(1);
    expect(nextInQueue(rows)?.id).toBe("here");
  });

  it("reports a one-based position, and zero once called", () => {
    const first = token({ id: "first", issuedAt: "2026-08-20T09:00:00.000Z" });
    const second = token({ id: "second", issuedAt: "2026-08-20T09:05:00.000Z" });
    const called = token({ id: "called", status: "called" });
    const rows = [first, second, called];
    expect(queuePosition(rows, first)).toBe(1);
    expect(queuePosition(rows, second)).toBe(2);
    expect(queuePosition(rows, called)).toBe(0);
  });
});

describe("the grace window", () => {
  const called = (overrides = {}) =>
    token({ status: "called", calledAt: "2026-08-20T09:00:00.000Z", ...overrides });

  it("counts down from the moment the token was called", () => {
    const at = Date.parse("2026-08-20T09:00:30.000Z");
    expect(secondsUntilSkip(called(), 2, at)).toBe(90);
    expect(formatCountdown(90)).toBe("1:30");
  });

  it("is not counting for a token nobody has called", () => {
    expect(secondsUntilSkip(token(), 2)).toBeNull();
    expect(skipDeadline(token(), 2)).toBeNull();
  });

  it("stops counting the moment serving starts", () => {
    const serving = called({ status: "serving", servingStartedAt: "2026-08-20T09:00:20.000Z" });
    expect(secondsUntilSkip(serving, 2)).toBeNull();
  });

  it("restarts from a recall, so a second call is not a trap", () => {
    const at = Date.parse("2026-08-20T09:03:00.000Z");
    const recalled = called({ calledAt: "2026-08-20T09:02:30.000Z", recallCount: 1 });
    expect(secondsUntilSkip(recalled, 2, at)).toBe(90);
  });

  it("hands over only the tokens whose window has actually closed", () => {
    const at = Date.parse("2026-08-20T09:02:01.000Z");
    const expired = called({ id: "expired" });
    const fresh = called({ id: "fresh", calledAt: "2026-08-20T09:01:30.000Z" });
    const serving = called({ id: "serving", status: "serving" });
    const ids = tokensPastDeadline([expired, fresh, serving], 2, at).map((t) => t.id);
    expect(ids).toEqual(["expired"]);
  });

  it("closes the window exactly on the boundary, not a second late", () => {
    const at = Date.parse("2026-08-20T09:02:00.000Z");
    expect(tokensPastDeadline([called()], 2, at)).toHaveLength(1);
    expect(secondsUntilSkip(called(), 2, at)).toBe(0);
  });
});

describe("the wait estimate", () => {
  it("divides the queue across the counters that can take it", () => {
    expect(estimateWaitMinutes(6, 5, 1)).toBe(30);
    expect(estimateWaitMinutes(6, 5, 2)).toBe(15);
  });

  it("rounds to five minutes and never promises less than five", () => {
    expect(estimateWaitMinutes(1, 2, 1)).toBe(5);
    expect(estimateWaitMinutes(3, 4, 1)).toBe(10);
  });

  it("is zero when nobody is ahead", () => {
    expect(estimateWaitMinutes(0, 10, 1)).toBe(0);
    expect(formatWait(0)).toBe("You're next");
  });

  it("survives a queue with no active counters at all", () => {
    expect(estimateWaitMinutes(4, 5, 0)).toBe(20);
  });

  it("counts an all-services counter towards every service", () => {
    const counters = [counter({ serviceIds: [] }), counter({ serviceIds: ["s2"] })];
    expect(activeCountersForService(counters, "s1")).toBe(1);
    expect(activeCountersForService(counters, "s2")).toBe(2);
  });

  it("does not count a counter that is switched off", () => {
    const counters = [counter({ active: false }), counter({ active: true })];
    expect(activeCountersForService(counters, "s1")).toBe(1);
  });

  it("reads hours out in words once the wait is long", () => {
    expect(formatWait(45)).toBe("about 45 min");
    expect(formatWait(60)).toBe("about 1 hr");
    expect(formatWait(85)).toBe("about 1 hr 25 min");
  });
});

describe("measured times", () => {
  const served = token({
    status: "served",
    issuedAt: "2026-08-20T09:00:00.000Z",
    calledAt: "2026-08-20T09:20:00.000Z",
    servingStartedAt: "2026-08-20T09:21:00.000Z",
    closedAt: "2026-08-20T09:31:00.000Z",
  });

  it("measures the wait from issue to announcement", () => {
    expect(averageWaitMinutes([served])).toBe(20);
  });

  it("measures service time from Start serving to Done", () => {
    expect(averageServiceMinutes([served])).toBe(10);
  });

  it("ignores tokens with nothing to measure", () => {
    expect(averageWaitMinutes([token()])).toBeNull();
    expect(averageServiceMinutes([served, token()])).toBe(10);
  });

  it("suggests a service time only once there is enough of a sample", () => {
    const sample = (count: number) =>
      Array.from({ length: count }, () =>
        token({
          status: "served",
          date: "2026-08-19",
          servingStartedAt: "2026-08-19T09:00:00.000Z",
          closedAt: "2026-08-19T09:08:00.000Z",
        })
      );
    expect(suggestedServiceMinutes(sample(9), "s1", "2026-08-20")).toBeNull();
    expect(suggestedServiceMinutes(sample(10), "s1", "2026-08-20")).toBe(8);
  });

  it("ignores tokens older than the suggestion window", () => {
    const stale = Array.from({ length: 12 }, () =>
      token({
        status: "served",
        date: "2026-07-01",
        servingStartedAt: "2026-07-01T09:00:00.000Z",
        closedAt: "2026-07-01T09:08:00.000Z",
      })
    );
    expect(suggestedServiceMinutes(stale, "s1", "2026-08-20")).toBeNull();
  });
});

describe("how a token is spoken", () => {
  it("splits the prefix off so A-42 does not read as a dash", () => {
    expect(spokenToken("A-42")).toBe("A 42");
    expect(spokenToken("42")).toBe("42");
    expect(spokenToken("B/7")).toBe("B 7");
  });
});
