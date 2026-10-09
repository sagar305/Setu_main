import { describe, expect, it } from "vitest";

import { LANGUAGES, type LanguageCode } from "@/lib/i18n/config";
import { translate } from "@/lib/i18n/translate";
import { formatWait } from "@/lib/token/calc";
import { buildPosterHtml, buildSlipHtml, type SlipContext } from "@/lib/token/print";
import { buildMessage, type MessageContext } from "@/lib/token/messages";
import {
  DEFAULT_SETTINGS,
  MESSAGE_TEMPLATE_ORDER,
  defaultMessageTemplates,
  defaultTokenSettings,
  defaultVoiceTemplate,
  messagePlaceholders,
  statusLabel,
  voiceTemplateFor,
  type Counter,
  type Service,
  type Token,
  type TokenStatus,
} from "@/lib/token/types";

const CODES = LANGUAGES.map(({ code }) => code);

const service: Service = {
  id: "s1",
  name: "New registration",
  prefix: "A",
  avgServiceMinutes: 6,
  colour: "#26306B",
  active: true,
  sortOrder: 0,
  createdAt: "2026-01-01T04:00:00.000Z",
};

const counter: Counter = {
  id: "c1",
  name: "Counter 3",
  serviceIds: [],
  staffName: "Meena",
  active: true,
  createdAt: "2026-01-01T04:00:00.000Z",
};

const token: Token = {
  id: "t1",
  serviceId: "s1",
  number: 42,
  date: "2026-01-02",
  status: "waiting",
  priority: true,
  counterId: null,
  customerName: "Asha",
  phone: "9876543210",
  note: "",
  issuedAt: "2026-01-02T04:35:00.000Z",
  calledAt: null,
  servingStartedAt: null,
  closedAt: null,
  recallCount: 0,
  selfIssued: false,
  reissuedFromId: null,
  reissuedAsId: null,
};

const STATUSES: TokenStatus[] = [
  "waiting",
  "called",
  "serving",
  "served",
  "skipped",
  "cancelled",
];

describe("stored values keep their own language", () => {
  it("names every status in every language we publish", () => {
    for (const code of CODES) {
      for (const status of STATUSES) {
        const label = statusLabel(status, code);
        expect(label.trim(), `${status}/${code}`).not.toBe("");
      }
    }
  });

  it("gives a different word for each status within one language", () => {
    for (const code of CODES) {
      const labels = STATUSES.map((status) => statusLabel(status, code));
      expect(new Set(labels).size, code).toBe(STATUSES.length);
    }
  });

  it("falls back to the stored value for a status it has no word for", () => {
    expect(statusLabel("no-such-status" as TokenStatus, "hi")).toBe("no-such-status");
  });
});

describe("the spoken line follows the reader until it is rewritten", () => {
  it("re-languages a template that is still one of our seeds", () => {
    for (const from of CODES) {
      const seeded = defaultVoiceTemplate(from);
      expect(voiceTemplateFor(seeded, "ta")).toBe(defaultVoiceTemplate("ta"));
    }
  });

  it("leaves a template the owner wrote exactly as it is", () => {
    const theirs = "Token {token} — window {counter}, please";
    for (const code of CODES) {
      expect(voiceTemplateFor(theirs, code)).toBe(theirs);
    }
  });

  it("keeps {token} and {counter} in every language", () => {
    for (const code of CODES) {
      const line = defaultVoiceTemplate(code);
      expect(line, code).toContain("{token}");
      expect(line, code).toContain("{counter}");
    }
  });
});

describe("the WhatsApp templates", () => {
  it("carries the same placeholders as English in every language", () => {
    const english = defaultMessageTemplates("en");
    for (const key of MESSAGE_TEMPLATE_ORDER) {
      const wanted = [...english[key].matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort();
      for (const code of CODES) {
        const got = [...defaultMessageTemplates(code)[key].matchAll(/\{(\w+)\}/g)]
          .map((m) => m[1])
          .sort();
        expect(got, `${key}/${code}`).toEqual(wanted);
      }
    }
  });

  it("explains all eight placeholders in every language", () => {
    for (const code of CODES) {
      const rows = messagePlaceholders(code);
      expect(rows, code).toHaveLength(8);
      for (const row of rows) {
        expect(row.meaning.trim(), `${row.token}/${code}`).not.toBe("");
      }
    }
  });

  it("seeds a new queue's settings in the reader's language", () => {
    const hindi = defaultTokenSettings("hi");
    expect(hindi.voiceTemplate).toBe(defaultVoiceTemplate("hi"));
    expect(hindi.messageTemplates).toEqual(defaultMessageTemplates("hi"));
  });

  it("keeps the shipped defaults out of the merge-shape base", () => {
    // DEFAULT_SETTINGS is folded onto a stored row, so its wordy fields have
    // to be empty rather than English.
    expect(DEFAULT_SETTINGS.voiceTemplate).toBe("");
    for (const key of MESSAGE_TEMPLATE_ORDER) {
      expect(DEFAULT_SETTINGS.messageTemplates[key], key).toBe("");
    }
  });

  it("writes the message in the customer's language, not the app's", () => {
    const context = (lang: LanguageCode): MessageContext => ({
      token,
      service,
      counter,
      businessName: "Sharma Diagnostics",
      tokens: [token],
      counters: [counter],
      minutes: 2,
      lang,
    });
    const settings = defaultTokenSettings("en");
    for (const code of CODES) {
      const text = buildMessage("tokenIssued", settings, context(code));
      expect(text, code).toContain("A-42");
      expect(text, code).not.toContain("{");
    }
  });

  it("falls back to the reader's own wording when a template is missing", () => {
    const stale = {
      ...DEFAULT_SETTINGS,
      messageTemplates: { tokenIssued: "", almostYourTurn: "" },
    } as unknown as typeof DEFAULT_SETTINGS;
    const text = buildMessage("skipped", stale, {
      token,
      service,
      counter,
      businessName: "Sharma Diagnostics",
      tokens: [token],
      counters: [counter],
      lang: "hi",
    });
    expect(text).toContain("A-42");
    expect(text).not.toContain("{");
  });

  it("names an anonymous customer in their own language", () => {
    const anonymous: Token = { ...token, customerName: "" };
    for (const code of CODES) {
      const text = buildMessage("tokenIssued", defaultTokenSettings(code), {
        token: anonymous,
        service,
        counter,
        businessName: "",
        tokens: [anonymous],
        counters: [counter],
        lang: code,
      });
      expect(text, code).toContain(translate(code, "tkFallbackName"));
      expect(text, code).toContain(translate(code, "tkOurCounter"));
    }
  });
});

describe("the wait estimate", () => {
  it("is never bare English", () => {
    for (const code of CODES) {
      expect(formatWait(0, code), code).toBe(translate(code, "tkWaitYoureNext"));
      expect(formatWait(20, code), code).toContain("20");
      expect(formatWait(60, code), code).toContain("1");
      const long = formatWait(85, code);
      expect(long, code).toContain("1");
      expect(long, code).toContain("25");
    }
  });
});

describe("the printed slip", () => {
  const context = (lang: LanguageCode): SlipContext => ({
    token,
    service,
    businessName: "Sharma Diagnostics",
    waitMinutes: 20,
    lang,
  });

  it("prints the number, the priority flag and the wait in the reader's language", () => {
    for (const code of CODES) {
      const html = buildSlipHtml(context(code));
      expect(html, code).toContain("A-42");
      expect(html, code).toContain(translate(code, "tkPriority"));
      expect(html, code).toContain(translate(code, "tkSlipWatch"));
    }
  });

  it("leaves no English behind on a localized slip", () => {
    const html = buildSlipHtml(context("hi"));
    expect(html).not.toContain("PRIORITY");
    expect(html).not.toContain("Please watch the screen");
    expect(html).not.toContain("Issued ");
  });

  it("falls back to the word for a token when there is no business name", () => {
    const html = buildSlipHtml({ ...context("ta"), businessName: "" });
    expect(html).toContain(translate("ta", "tkToken"));
  });

  it("escapes a business name rather than rendering it as markup", () => {
    const html = buildSlipHtml({ ...context("en"), businessName: "<b>Shop</b>" });
    expect(html).not.toContain("<b>Shop</b>");
    expect(html).toContain("&lt;b&gt;Shop&lt;/b&gt;");
  });
});

describe("the QR poster", () => {
  it("prints all three steps and the image alt in the reader's language", () => {
    for (const code of CODES) {
      const html = buildPosterHtml({
        businessName: "",
        serviceName: service.name,
        url: "https://example.test/view",
        qrDataUrl: "data:image/png;base64,AAA",
        lang: code,
      });
      expect(html, code).toContain(translate(code, "tkPosterTitle"));
      expect(html, code).toContain(translate(code, "tkQrAlt"));
      for (const key of ["tkPosterStep1", "tkPosterStep2", "tkPosterStep3"] as const) {
        expect(html, `${key}/${code}`).toContain(translate(code, key));
      }
    }
  });

  it("leaves no English behind on a localized poster", () => {
    const html = buildPosterHtml({
      businessName: "",
      serviceName: "",
      url: "https://example.test/view",
      qrDataUrl: "data:image/png;base64,AAA",
      lang: "bn",
    });
    expect(html).not.toContain("Join the queue");
    expect(html).not.toContain("Scan this code");
    expect(html).not.toContain('alt="QR code"');
  });
});
