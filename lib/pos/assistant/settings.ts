// Changing settings by asking: "enable tax", "gst band karo", "set default
// tax rate to 18", "change invoice prefix to SK-", "turn on expense tracker".
//
// Every setting the assistant may touch is listed once in SETTINGS, with the
// words people use for it, how to read its current value, and how to check a
// new one — the same rules the Settings screen applies. Like every other
// change, the result is a proposal the user confirms; nothing is saved here.
//
// Deliberately absent: the counter PIN (typing a PIN into a chat log is the
// wrong place for it) and anything in the Danger zone.

import type { AgentAction, AgentReply, AssistantData } from "./agent";
import type { Flow } from "./flows";
import { POS_TOOLS, isToolEnabled } from "@/lib/pos/posTools";
import type { Business, PosSettings, ReceiptPaperSize } from "@/lib/pos/types";
import { foldName, normalize } from "./text";

type SettingsField = Exclude<keyof PosSettings, "id">;
type BusinessField = Exclude<keyof Business, "id" | "createdAt">;

type Kind = "boolean" | "percent" | "count" | "text" | "paper" | "autolock";

export type SettingDef = {
  id: string;
  label: string;
  /** The ways people name it, folded (lowercase, no punctuation). */
  aliases: string[];
  kind: Kind;
  target: { scope: "settings"; field: SettingsField } | { scope: "business"; field: BusinessField };
  /** The question asked when no value was given. */
  question: string;
  chips?: string[];
  required?: boolean;
};

export const SETTINGS: SettingDef[] = [
  {
    id: "tax",
    label: "Tax (GST)",
    aliases: ["tax", "taxes", "gst", "vat", "tax gst", "gst tax"],
    kind: "boolean",
    target: { scope: "settings", field: "taxEnabled" },
    question: "Turn tax on or off?",
    chips: ["On", "Off"],
  },
  {
    id: "tax-rate",
    label: "Default tax rate",
    aliases: ["default tax rate", "default tax", "tax rate", "gst rate", "default gst", "default gst rate", "tax percentage", "gst percentage", "tax percent"],
    kind: "percent",
    target: { scope: "settings", field: "defaultTaxRate" },
    question: "What should the default tax rate be?",
    chips: ["0", "5", "12", "18", "28"],
  },
  {
    id: "prefix",
    label: "Invoice prefix",
    aliases: ["invoice prefix", "bill prefix", "prefix", "invoice series", "bill series"],
    kind: "text",
    target: { scope: "settings", field: "invoicePrefix" },
    question: "What should invoice numbers start with? (for example INV- or SK/)",
    chips: ["INV-", "BILL-"],
  },
  {
    id: "next-number",
    label: "Next invoice number",
    aliases: ["next invoice number", "invoice number", "bill number", "next bill number", "starting number", "invoice starting number"],
    kind: "count",
    target: { scope: "settings", field: "nextInvoiceNumber" },
    question: "What number should the next invoice get?",
  },
  {
    id: "footer",
    label: "Receipt footer",
    aliases: ["receipt footer", "footer", "receipt message", "thank you message", "bill footer", "footer message"],
    kind: "text",
    target: { scope: "settings", field: "receiptFooter" },
    question: "What should the bottom of every receipt say?",
    chips: ["Thank you for your business!", "Visit again!"],
  },
  {
    id: "business-info",
    label: "Business details on receipt",
    aliases: ["business info on receipt", "business details on receipt", "shop details on receipt", "business info", "business details", "shop details", "shop info on receipt"],
    kind: "boolean",
    target: { scope: "settings", field: "showBusinessInfoOnReceipt" },
    question: "Show your business name, address and phone on receipts?",
    chips: ["On", "Off"],
  },
  {
    id: "paper",
    label: "Receipt paper size",
    aliases: ["paper size", "receipt size", "receipt paper", "receipt paper size", "printer size", "paper"],
    kind: "paper",
    target: { scope: "settings", field: "receiptPaperSize" },
    question: "Which receipt paper do you use?",
    chips: ["80mm", "58mm", "A4"],
  },
  {
    id: "auto-lock",
    label: "Auto-lock when idle",
    aliases: ["auto lock", "autolock", "auto lock time", "idle lock", "screen lock time"],
    kind: "autolock",
    target: { scope: "settings", field: "autoLockMinutes" },
    question: "Lock the counter after how many idle minutes?",
    chips: ["Never", "1", "5", "15", "30"],
  },
  {
    id: "name",
    label: "Business name",
    aliases: ["business name", "shop name", "store name", "company name", "dukan ka naam", "name of shop", "name of business"],
    kind: "text",
    target: { scope: "business", field: "name" },
    question: "What's the business name?",
    required: true,
  },
  {
    id: "phone",
    label: "Business phone",
    aliases: ["phone", "phone number", "business phone", "shop phone", "mobile number", "shop number", "contact number"],
    kind: "text",
    target: { scope: "business", field: "phone" },
    question: "What phone number should receipts show?",
  },
  {
    id: "address",
    label: "Business address",
    aliases: ["address", "business address", "shop address", "store address"],
    kind: "text",
    target: { scope: "business", field: "address" },
    question: "What's the shop address?",
  },
  {
    id: "email",
    label: "Business email",
    aliases: ["email", "email id", "business email", "shop email", "mail"],
    kind: "text",
    target: { scope: "business", field: "email" },
    question: "What's the business email?",
  },
  {
    id: "gstin",
    label: "GSTIN / tax number",
    aliases: ["gstin", "gst number", "gst no", "tax number", "tax id", "gstin number", "vat number"],
    kind: "text",
    target: { scope: "business", field: "taxNumber" },
    question: "What's your GSTIN or tax number?",
  },
  {
    id: "upi",
    label: "UPI ID",
    aliases: ["upi id", "upi address", "vpa"],
    kind: "text",
    target: { scope: "business", field: "upiId" },
    question: "What's your UPI ID? (like shop@okhdfcbank)",
  },
];

/** Settings offered on "change settings", most used first. */
const MENU = ["tax", "tax-rate", "prefix", "footer", "paper", "business-info", "name", "phone", "gstin", "upi"];

const EXTRA_TOOL_ALIASES: Record<string, string[]> = {
  "customer-ledger": ["udhaar", "udhar", "credit", "khata", "ledger", "credit sales", "udhaar option"],
  "receipt-designer": ["receipt designer", "receipt designs"],
  "expense-tracker": ["expenses", "kharcha"],
  "profit-dashboard": ["profit dashboard"],
};

function toolAliases(slug: string, name: string): string[] {
  return [foldName(name), foldName(name.replace(/\(.*?\)/g, "")), slug.replace(/-/g, " "), ...(EXTRA_TOOL_ALIASES[slug] ?? [])];
}

function cleanPhrase(phrase: string): string {
  return foldName(phrase)
    .replace(/^(the|my|our|mera|meri|apna|apni)\s+/, "")
    .replace(/\s+(setting|settings|option|feature|tool)$/, "")
    .replace(/s\s/g, " ")
    .trim();
}

function aliasMatches(phrase: string, aliases: string[]): boolean {
  const cleaned = cleanPhrase(phrase);
  return aliases.some((alias) => {
    const a = foldName(alias);
    return cleaned === a || cleaned === a.replace(/s\s/g, " ") || foldName(phrase) === a;
  });
}

export function findSetting(phrase: string): SettingDef | null {
  return SETTINGS.find((s) => aliasMatches(phrase, s.aliases)) ?? null;
}

function findTool(phrase: string) {
  return POS_TOOLS.find((tool) => aliasMatches(phrase, toolAliases(tool.slug, tool.name))) ?? null;
}

// ---------------------------------------------------------------------------
// Reading and checking values
// ---------------------------------------------------------------------------

export function currentValue(def: SettingDef, data: AssistantData): string {
  if (def.target.scope === "business") {
    const value = data.business?.[def.target.field];
    return typeof value === "string" && value.trim() ? value : "not set";
  }
  const value = data.settings[def.target.field];
  switch (def.kind) {
    case "boolean":
      return value ? "On" : "Off";
    case "percent":
      return `${value}%`;
    case "paper":
      return value === "a4" ? "A4" : String(value);
    case "autolock":
      return !value ? "Never" : `After ${value} minute${value === 1 ? "" : "s"}`;
    default:
      return value === "" || value === undefined || value === null ? "not set" : String(value);
  }
}

type Parsed = { value: string | number | boolean } | { error: string };

const ON = /^(on|yes|y|enable|enabled|true|start|chalu|haan|ha|lagao|show|activate|allow)$/;
const OFF = /^(off|no|n|disable|disabled|false|stop|band|bandh|nahi|hatao|hide|deactivate)$/;

export function parseValue(def: SettingDef, raw: string, data: AssistantData): Parsed {
  const text = raw.trim();
  const folded = normalize(text).replace(/[.!]+$/, "");
  switch (def.kind) {
    case "boolean":
      if (ON.test(folded)) return { value: true };
      if (OFF.test(folded)) return { value: false };
      return { error: "Please answer on or off." };
    case "percent": {
      const n = Number(folded.replace(/%|percent|pc/g, "").trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Tax percentage must be between 0 and 100." };
      return { value: n };
    }
    case "count": {
      const n = Number(folded);
      if (!Number.isInteger(n) || n < 1) return { error: "Starting number must be a whole number of 1 or more." };
      return { value: n };
    }
    case "paper": {
      const compact = folded.replace(/\s+/g, "");
      const size: ReceiptPaperSize | null = compact.startsWith("80") ? "80mm" : compact.startsWith("58") ? "58mm" : compact === "a4" ? "a4" : null;
      return size ? { value: size } : { error: "Choose 80mm, 58mm or A4." };
    }
    case "autolock": {
      if (!data.settings.pinHash) return { error: "Auto-lock needs a counter PIN first — set one in Settings → Counter lock." };
      const n = /^(never|off|0|no|band)$/.test(folded) ? 0 : Number(folded.replace(/\s*(minutes?|mins?|m)$/, ""));
      if (![0, 1, 5, 15, 30].includes(n)) return { error: "Choose Never, 1, 5, 15 or 30 minutes." };
      return { value: n };
    }
    case "text": {
      const blank = /^(none|blank|empty|nothing|remove|clear|-)$/i.test(text);
      const value = blank ? "" : text.replace(/^["“']|["”']$/g, "").trim();
      if (def.required && !value) return { error: `${def.label} is required.` };
      if (def.id === "email" && value && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value)) return { error: "That doesn't look like an email address." };
      if (def.id === "phone" && value && !/^\+?[\d\s-]{6,}$/.test(value)) return { error: "That doesn't look like a phone number." };
      if (def.id === "upi" && value && !/^[\w.-]+@[\w.-]+$/.test(value)) return { error: "A UPI ID looks like name@bank." };
      return { value };
    }
  }
}

function displayValue(def: SettingDef, value: string | number | boolean): string {
  if (def.kind === "boolean") return value ? "On" : "Off";
  if (def.kind === "percent") return `${value}%`;
  if (def.kind === "paper") return value === "a4" ? "A4" : String(value);
  if (def.kind === "autolock") return value === 0 ? "Never" : `After ${value} minute${value === 1 ? "" : "s"}`;
  return value === "" ? "(blank)" : String(value);
}

/** The confirm card for setting `def` to a raw answer, or the reason it can't be. */
export function settingProposal(def: SettingDef, raw: string, data: AssistantData): AgentReply {
  const parsed = parseValue(def, raw, data);
  if ("error" in parsed) {
    return {
      text: parsed.error,
      suggestions: def.chips,
      flow: { kind: "ask", question: def.question, template: `set ${def.aliases[0]} to {answer}`, chips: def.chips },
    };
  }
  const before = currentValue(def, data);
  const after = displayValue(def, parsed.value);
  if (before === after || (before === "not set" && after === "(blank)")) {
    return { text: `${def.label} is already ${before}.` };
  }

  const action: AgentAction =
    def.target.scope === "settings"
      ? { kind: "settings", updates: { [def.target.field]: parsed.value } as Partial<Omit<PosSettings, "id">>, label: def.label }
      : { kind: "business", updates: { [def.target.field]: parsed.value } as Partial<Omit<Business, "id" | "createdAt">>, label: def.label };

  const notes: string[] = [];
  const suggestions: string[] = [];
  if (def.id === "tax" && parsed.value === true) {
    notes.push(`Default rate is ${data.settings.defaultTaxRate}%. Products without their own rate use it.`);
    if (data.settings.defaultTaxRate === 0) suggestions.push("set default tax rate to 18");
  }
  if (def.id === "tax-rate" && !data.settings.taxEnabled) notes.push("Tax is off — turn it on for this rate to apply.");
  if (def.id === "next-number") notes.push("Numbers already used are skipped automatically.");

  return {
    text: def.kind === "boolean" ? `Turn ${parsed.value ? "on" : "off"} ${def.label}?` : `Change ${def.label.toLowerCase()}?`,
    proposal: {
      action,
      title: def.label,
      details: [`${before} → ${after}`, ...notes],
      confirmLabel: "Save",
    },
    suggestions: suggestions.length ? suggestions : undefined,
  };
}

function askFor(def: SettingDef, data: AssistantData): AgentReply {
  return {
    text: `${def.question} It's ${currentValue(def, data)} now.`,
    suggestions: [...(def.chips ?? []), "Cancel"],
    flow: { kind: "ask", question: def.question, template: `set ${def.aliases[0]} to {answer}`, chips: def.chips },
  };
}

function toolProposal(slug: string, enabled: boolean, data: AssistantData): AgentReply {
  const tool = POS_TOOLS.find((t) => t.slug === slug)!;
  const current = data.settings.connectedTools ?? [];
  if (isToolEnabled(current, slug) === enabled) {
    return { text: `${tool.name} is already ${enabled ? "on" : "off"}.` };
  }
  const next = enabled ? [...current, slug] : current.filter((s) => s !== slug);
  return {
    text: `${enabled ? "Turn on" : "Turn off"} ${tool.name}?`,
    proposal: {
      action: { kind: "settings", updates: { connectedTools: next }, label: tool.name },
      title: tool.name,
      details: [`${enabled ? "Off → On" : "On → Off"}`, ...(tool.unlocks ? [tool.unlocks] : [tool.description])],
      confirmLabel: "Save",
    },
  };
}

// ---------------------------------------------------------------------------
// Understanding settings requests
// ---------------------------------------------------------------------------

/**
 * `raw` keeps the user's capitals (an invoice prefix, a footer, an email);
 * `text` is the normalised form the other matchers use.
 */
export function settingsReply(raw: string, text: string, data: AssistantData): AgentReply | null {
  // The PIN stays on the Settings screen.
  if (/\b(pin|passcode|password)\b/.test(text) && /\b(set|change|remove|reset|new|update|lagao|badlo|hatao)\b/.test(text)) {
    return {
      text: "For safety, set or change the counter PIN on the Settings screen — it shouldn't be typed into a chat.",
      link: { screen: "settings", label: "Open Settings" },
    };
  }

  if (/^(change|edit|update|modify|open)?\s*(a |my |the )?settings? (change|badlo|badalna|update)$/.test(text) ||
      /^(change|edit|update|modify) (a |my |the |some )?settings?$/.test(text)) {
    return {
      text: "Which setting? Tap one, or say it — for example “turn off tax” or “set receipt footer to Visit again”.",
      suggestions: [
        data.settings.taxEnabled ? "Turn off tax" : "Turn on tax",
        ...MENU.slice(1).map((id) => `Change ${SETTINGS.find((s) => s.id === id)!.label.toLowerCase()}`),
        "Connected tools",
        "Payment methods",
      ],
    };
  }

  const payment = paymentReply(raw, text, data);
  if (payment) return payment;

  if (/^(connected tools|tools|which tools are on|show tools)$/.test(text)) {
    return {
      text: "Connected tools:",
      bullets: POS_TOOLS.map((tool) => `${tool.name} — ${isToolEnabled(data.settings.connectedTools, tool.slug) ? "On" : "Off"}`),
      suggestions: POS_TOOLS.slice(0, 3).map((tool) =>
        `${isToolEnabled(data.settings.connectedTools, tool.slug) ? "Turn off" : "Turn on"} ${tool.name.replace(/\s*\(.*?\)/, "")}`
      ),
    };
  }

  // Questions about a current value: "what is my tax rate", "is gst on".
  const question = text.match(/^(?:what is|whats|what s|show|check|tell me|current|kya hai)\s+(?:the\s+|my\s+)?(.+?)(?:\s+setting)?$/) ??
    text.match(/^(.+?)\s+(?:kya hai|kitna hai|kitni hai)$/);
  if (question) {
    const def = findSetting(question[1]);
    if (def) return { text: `${def.label}: ${currentValue(def, data)}.`, suggestions: [`change ${def.aliases[0]}`] };
  }
  const isOn = text.match(/^is\s+(?:the\s+|my\s+)?(.+?)\s+(on|off|enabled|disabled)$/);
  if (isOn) {
    const def = findSetting(isOn[1]);
    if (def?.kind === "boolean") return { text: `${def.label} is ${currentValue(def, data)}.` };
    const tool = findTool(isOn[1]);
    if (tool) return { text: `${tool.name} is ${isToolEnabled(data.settings.connectedTools, tool.slug) ? "On" : "Off"}.` };
  }

  // On / off: "enable tax", "turn off gst", "gst band", "show business info on receipt".
  const onOff =
    text.match(/^(enable|turn on|switch on|activate|start|allow|show|chalu)\s+(.+)$/) ??
    text.match(/^(disable|turn off|switch off|deactivate|stop|hide|band|bandh)\s+(.+)$/) ??
    text.match(/^(.+?)\s+(on|off|enable|disable|chalu|band|bandh|lagao|hatao)$/);
  if (onOff) {
    const [first, second] = [onOff[1], onOff[2]];
    const verbFirst = /^(enable|turn on|switch on|activate|start|allow|show|chalu|disable|turn off|switch off|deactivate|stop|hide|band|bandh)$/.test(first);
    const verb = verbFirst ? first : second;
    const phrase = verbFirst ? second : first;
    const enabled = /^(enable|turn on|switch on|activate|start|allow|show|chalu|on|lagao)$/.test(verb);
    const def = findSetting(phrase);
    if (def?.kind === "boolean") return settingProposal(def, enabled ? "on" : "off", data);
    const tool = findTool(phrase);
    if (tool) return toolProposal(tool.slug, enabled, data);
  }

  // With a value: "set default tax rate to 18", "change invoice prefix to SK-".
  const rawClean = raw.trim().replace(/^(please|pls|kindly|can you|could you)\s+/i, "").replace(/\?+$/, "");
  const withValue = rawClean.match(/^(?:set|change|update|make|edit|put)\s+(?:the\s+|my\s+)?(.+?)\s+(?:to|=|as|:)\s+(.+)$/i);
  if (withValue) {
    const def = findSetting(withValue[1]);
    if (def) return settingProposal(def, withValue[2], data);
  }
  // Hinglish / short: "tax rate 18", "paper size 58mm", "default gst 12 karo".
  const short = text.match(/^(.+?)\s+(\d+(?:\.\d+)?\s*(?:%|mm|minutes?)?|a4)$/);
  if (short) {
    const def = findSetting(short[1]);
    if (def && def.kind !== "text") return settingProposal(def, short[2], data);
  }
  // No value yet: "change receipt footer" → ask.
  const noValue = text.match(/^(?:set|change|update|edit|modify)\s+(?:the\s+|my\s+)?(.+)$/);
  if (noValue) {
    const def = findSetting(noValue[1]);
    if (def) return askFor(def, data);
  }
  return null;
}

function paymentReply(raw: string, text: string, data: AssistantData): AgentReply | null {
  if (/^(?:what are |show |list )?(?:my |the )?payment (?:methods|modes|options)$/.test(text)) {
    return {
      text: "Payment methods:",
      bullets: data.payments.map((p) => p.name),
      suggestions: ["Add payment method Paytm"],
    };
  }

  const add = raw.trim().match(/^(?:please\s+)?(?:add|create|new)\s+(?:a\s+)?(?:new\s+)?payment\s+(?:method|mode|option)s?(?:\s+(.+?))?[.?!]*$/i);
  if (add) {
    const name = (add[1] ?? "").replace(/^(called|named)\s+/i, "").trim();
    if (!name) {
      return {
        text: "What's the payment method called? (for example Paytm, PhonePe)",
        suggestions: ["Paytm", "PhonePe", "Google Pay", "Cancel"],
        flow: { kind: "ask", question: "Name of the payment method?", template: "add payment method {answer}" },
      };
    }
    if (data.payments.some((p) => foldName(p.name) === foldName(name))) return { text: `${name} is already a payment method.` };
    return {
      text: `Add ${name} as a payment method?`,
      proposal: {
        action: { kind: "payment-add", name },
        title: "Add payment method",
        details: [name, "It appears at checkout straight away."],
        confirmLabel: "Add",
      },
    };
  }

  const remove = text.match(/^(?:remove|delete|hatao|hata do)\s+(?:the\s+)?(?:payment\s+(?:method|mode|option)\s+)?(.+?)(?:\s+payment(?:\s+(?:method|mode|option))?)?$/);
  if (remove && (/\bpayment\b/.test(text) || data.payments.some((p) => foldName(p.name) === foldName(remove[1])))) {
    const method = data.payments.find((p) => foldName(p.name) === foldName(remove[1]));
    if (!method) return { text: `There's no payment method called “${remove[1]}”.`, suggestions: ["payment methods"] };
    if (data.payments.length <= 1) return { text: "At least one payment method is required." };
    return {
      text: `Remove ${method.name}?`,
      proposal: {
        action: { kind: "payment-remove", id: method.id },
        title: "Remove payment method",
        details: [method.name, "Past bills keep it; it just won't be offered at checkout."],
        confirmLabel: "Remove",
      },
    };
  }
  return null;
}

/** For flows.ts: re-ask a setting's question. */
export function settingQuestionFlow(def: SettingDef): Flow {
  return { kind: "ask", question: def.question, template: `set ${def.aliases[0]} to {answer}`, chips: def.chips };
}
