import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const sent: { to: string; subject: string; html?: string; text?: string }[] = [];
vi.mock("resend", () => ({
  Resend: class {
    emails = {
      send: async (msg: { to: string; subject: string; html?: string; text?: string }) => {
        sent.push(msg);
        return { error: null };
      },
    };
  },
}));

import { isValidEmail, waitlistEmailHtml, waitlistEmailText } from "@/lib/workflowWaitlist";
import { POST } from "@/app/api/workflow/waitlist/route";

let ipCounter = 0;
const post = (body: unknown) =>
  POST(
    new Request("https://setutechnology.com/api/workflow/waitlist", {
      method: "POST",
      body: JSON.stringify(body),
      // A fresh IP per request, so the rate limit doesn't leak between tests.
      headers: { "x-forwarded-for": `10.0.0.${++ipCounter}` },
    }),
  );

describe("waiting list email", () => {
  it("thanks the firm and links both free tools", () => {
    for (const body of [waitlistEmailHtml(), waitlistEmailText()]) {
      expect(body).toContain("waiting list");
      expect(body).toContain("https://setutechnology.com/products/tb-analyzer");
      expect(body).toContain("https://setutechnology.com/products/bank-statement-analyzer");
    }
  });

  it("accepts real-looking addresses only", () => {
    expect(isValidEmail("partner@firm.in")).toBe(true);
    expect(isValidEmail("not an email")).toBe(false);
    expect(isValidEmail("a@b")).toBe(false);
    expect(isValidEmail(42)).toBe(false);
  });
});

describe("POST /api/workflow/waitlist", () => {
  beforeEach(() => {
    sent.length = 0;
    vi.stubEnv("RESEND_API_KEY", "re_test");
  });
  afterEach(() => vi.unstubAllEnvs());

  it("emails the visitor and tells us who joined", async () => {
    const response = await post({ email: " Partner@Firm.in " });
    expect(response.status).toBe(200);
    expect(sent.map((m) => m.to)).toEqual(["partner@firm.in", "sagarbansal305@gmail.com"]);
    expect(sent[0].html).toContain("tb-analyzer");
  });

  it("refuses a bad address and sends nothing", async () => {
    expect((await post({ email: "nope" })).status).toBe(400);
    expect(sent).toHaveLength(0);
  });

  it("quietly drops bots that fill the hidden field", async () => {
    expect((await post({ email: "bot@spam.example", website: "http://spam" })).status).toBe(200);
    expect(sent).toHaveLength(0);
  });

  it("limits how many emails one visitor can trigger", async () => {
    const statuses: number[] = [];
    for (let i = 0; i < 6; i++) {
      const response = await POST(
        new Request("https://setutechnology.com/api/workflow/waitlist", {
          method: "POST",
          body: JSON.stringify({ email: `x${i}@firm.in` }),
          headers: { "x-forwarded-for": "10.9.9.9" },
        }),
      );
      statuses.push(response.status);
    }
    expect(statuses).toEqual([200, 200, 200, 200, 200, 429]);
  });
});
