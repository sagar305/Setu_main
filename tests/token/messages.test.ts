import { describe, expect, it } from "vitest";
import { buildMessage } from "@/lib/token/messages";
import {
  DEFAULT_SETTINGS,
  type Counter,
  type Service,
  type TokenSettings,
  type Token,
} from "@/lib/token/types";

const service: Service = {
  id: "s1",
  name: "General",
  prefix: "A",
  avgServiceMinutes: 5,
  colour: "#26306B",
  active: true,
  sortOrder: 0,
  createdAt: "2026-08-20T08:00:00.000Z",
};

const counter: Counter = {
  id: "c1",
  name: "Counter 3",
  serviceIds: [],
  staffName: "",
  active: true,
  createdAt: "2026-08-20T08:00:00.000Z",
};

const token: Token = {
  id: "t1",
  serviceId: "s1",
  number: 42,
  date: "2026-08-20",
  status: "called",
  priority: false,
  counterId: "c1",
  customerName: "Asha",
  phone: "9876543210",
  note: "",
  issuedAt: "2026-08-20T09:00:00.000Z",
  calledAt: "2026-08-20T09:20:00.000Z",
  servingStartedAt: null,
  closedAt: null,
  recallCount: 0,
  selfIssued: false,
  reissuedFromId: null,
  reissuedAsId: null,
};

const context = {
  token,
  service,
  counter,
  businessName: "Sharma Diagnostics",
  tokens: [token],
  counters: [counter],
  minutes: 2,
};

describe("queue messages", () => {
  it("fills the token, counter and grace window in", () => {
    const text = buildMessage("waitingForYou", DEFAULT_SETTINGS, context);
    expect(text).toContain("A-42");
    expect(text).toContain("Counter 3");
    expect(text).toContain("within 2 minutes");
  });

  it("falls back to the customer's title when no name was taken", () => {
    const anonymous = { ...context, token: { ...token, customerName: "" } };
    expect(buildMessage("tokenIssued", DEFAULT_SETTINGS, anonymous)).toContain("Sir/Ma'am");
  });

  /**
   * The regression that broke calling somebody on a queue already in use: a
   * device that saved its settings before a template existed comes back with
   * that key missing, and fillTemplate threw on the undefined.
   */
  it("survives settings saved before a template existed", () => {
    const old = {
      ...DEFAULT_SETTINGS,
      messageTemplates: {
        tokenIssued: DEFAULT_SETTINGS.messageTemplates.tokenIssued,
        almostYourTurn: DEFAULT_SETTINGS.messageTemplates.almostYourTurn,
      },
    } as unknown as TokenSettings;

    expect(() => buildMessage("waitingForYou", old, context)).not.toThrow();
    expect(buildMessage("waitingForYou", old, context)).toContain("A-42");
    expect(() => buildMessage("skipped", old, context)).not.toThrow();
  });

  it("survives settings with no templates object at all", () => {
    const broken = { ...DEFAULT_SETTINGS, messageTemplates: undefined } as unknown as TokenSettings;
    expect(() => buildMessage("skipped", broken, context)).not.toThrow();
  });
});
