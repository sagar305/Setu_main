// Conversations that take more than one message.
//
// Most requests are answered in one go. A few need the assistant to ask
// something back and remember what it asked: filling in a new product field by
// field, or getting the value for a setting. That memory is a `Flow`, carried
// on the reply and handed back with the user's next message. It is plain data,
// so the panel just keeps the latest one, and the functions stay testable.
//
// While a flow is open, the next message is its answer — except "cancel",
// which always ends it.

import { respond, type AgentReply, type AssistantData } from "./agent";
import { DEFAULT_LOW_STOCK_THRESHOLD, formatMoney } from "@/lib/pos/types";
import { foldName, matchByName, normalize } from "./text";

export type ProductDraft = {
  name?: string;
  sellingPrice?: number;
  categoryId?: string;
  newCategoryName?: string;
  unit?: string;
  costPrice?: number | null;
  taxRate?: number | null;
  taxInclusive?: boolean;
  trackStock?: boolean;
  stock?: number;
  lowStockThreshold?: number | null;
  sku?: string;
  barcode?: string;
  description?: string;
};

export type ProductStep =
  | "name"
  | "price"
  | "category"
  | "unit"
  | "cost"
  | "taxRate"
  | "taxInclusive"
  | "trackStock"
  | "stock"
  | "lowStock"
  | "sku"
  | "barcode"
  | "description";

export type Flow =
  /** One question whose answer is put into `template` at {answer} and run as a command. */
  | { kind: "ask"; question: string; template: string; chips?: string[] }
  | { kind: "product"; step: ProductStep; draft: ProductDraft; history: ProductStep[] };

const CANCEL = /^(cancel|stop|exit|quit|chhodo|rehne do|rehnedo|never ?mind|band karo|nahi chahiye)$/;
const SKIP = /^(skip|none|nothing|blank|leave it|leave blank|-|na|n\/a|pass|aage)$/;
const SAVE_NOW = /^(save now|save|done|finish|skip the rest|thats all|bas|ho gaya|save it)$/;
const BACK = /^(back|go back|previous|peeche)$/;

// ---------------------------------------------------------------------------
// The product form, one question at a time
// ---------------------------------------------------------------------------

type StepDef = {
  /** Asked only when this holds (tax steps need tax on; stock steps need tracking). */
  applies?: (draft: ProductDraft, data: AssistantData) => boolean;
  required?: boolean;
  ask: (draft: ProductDraft, data: AssistantData) => { question: string; chips?: string[] };
  /** Read the answer into the draft, or say what's wrong with it. */
  read: (raw: string, draft: ProductDraft, data: AssistantData) => ProductDraft | { error: string };
  /** What skipping leaves in the draft. */
  skip?: (draft: ProductDraft) => ProductDraft;
};

function money(raw: string): number | null {
  const n = Number(normalize(raw).replace(/^(rs\.?|inr|₹)\s*/, "").replace(/\s*(rs|rupees|\/-)$/, "").replace(/,/g, ""));
  return Number.isFinite(n) ? n : null;
}

const YES = /^(yes|y|haan|ha|han|yeah|sure|ok|okay|track|track it|jee|ji)$/;
const NO = /^(no|n|nahi|nah|nope|dont|don t|do not)$/;

const STEPS: Record<ProductStep, StepDef> = {
  name: {
    required: true,
    ask: () => ({ question: "What's the product called?" }),
    read: (raw, draft, data) => {
      const name = raw.trim().replace(/^["“']|["”']$/g, "");
      if (!name) return { error: "Product name is required." };
      const existing = data.products.find((p) => foldName(p.name) === foldName(name));
      if (existing) return { error: `${existing.name} already exists. Give a different name, or say cancel.` };
      return { ...draft, name };
    },
  },
  price: {
    required: true,
    ask: (draft) => ({ question: `Selling price of ${draft.name}?` }),
    read: (raw, draft) => {
      const n = money(raw);
      if (n === null || n < 0) return { error: "Selling price must be zero or more — just the number, like 14." };
      return { ...draft, sellingPrice: n };
    },
  },
  category: {
    ask: (_, data) => ({
      question: "Which category? Pick one, type a new name, or skip.",
      chips: [...(data.categories ?? []).slice(0, 6).map((c) => c.name), "Skip"],
    }),
    read: (raw, draft, data) => {
      const found = matchByName(raw, data.categories ?? [], (c) => [c.name], 0.85);
      if (found.kind === "found") return { ...draft, categoryId: found.item.id, newCategoryName: undefined };
      return { ...draft, categoryId: undefined, newCategoryName: raw.trim() };
    },
  },
  unit: {
    ask: () => ({ question: "Sold by which unit?", chips: ["pcs", "kg", "g", "litre", "ml", "pack", "plate", "Skip"] }),
    read: (raw, draft) => ({ ...draft, unit: raw.trim() }),
  },
  cost: {
    ask: () => ({ question: "Cost price (what you pay for it)? It makes profit reports work.", chips: ["Skip"] }),
    read: (raw, draft) => {
      const n = money(raw);
      if (n === null || n < 0) return { error: "Cost price must be zero or more." };
      return { ...draft, costPrice: n };
    },
    skip: (draft) => ({ ...draft, costPrice: null }),
  },
  taxRate: {
    applies: (_, data) => data.settings.taxEnabled,
    ask: (_, data) => ({
      question: `GST / tax rate for it? Your default is ${data.settings.defaultTaxRate}%.`,
      chips: [`Default (${data.settings.defaultTaxRate}%)`, "0", "5", "12", "18", "28"],
    }),
    read: (raw, draft) => {
      if (/^default/.test(normalize(raw))) return { ...draft, taxRate: null };
      const n = Number(normalize(raw).replace(/%|percent/g, "").trim());
      if (!Number.isFinite(n) || n < 0 || n > 100) return { error: "Tax must be between 0 and 100." };
      return { ...draft, taxRate: n };
    },
    skip: (draft) => ({ ...draft, taxRate: null }),
  },
  taxInclusive: {
    applies: (draft, data) => data.settings.taxEnabled && (draft.taxRate ?? data.settings.defaultTaxRate) > 0,
    ask: () => ({
      question: "Does the selling price already include tax?",
      chips: ["Included in price", "Added on top"],
    }),
    read: (raw, draft) => {
      const t = normalize(raw);
      if (/^(included|include|inclusive|incl|yes|haan|ha|mrp)/.test(t) || /included in price/.test(t)) return { ...draft, taxInclusive: true };
      if (/^(added|add|exclusive|excl|on top|no|nahi|upar)/.test(t) || /added on top/.test(t)) return { ...draft, taxInclusive: false };
      return { error: "Say “included in price” or “added on top”." };
    },
    skip: (draft) => ({ ...draft, taxInclusive: false }),
  },
  trackStock: {
    ask: () => ({ question: "Track stock for it? You'll get low-stock alerts, and sales reduce it.", chips: ["Yes", "No"] }),
    read: (raw, draft) => {
      const t = normalize(raw);
      // A number means yes, and that's the opening stock.
      if (/^\d+$/.test(t)) return { ...draft, trackStock: true, stock: Number(t) };
      if (YES.test(t)) return { ...draft, trackStock: true };
      if (NO.test(t)) return { ...draft, trackStock: false };
      return { error: "Please answer yes or no." };
    },
    skip: (draft) => ({ ...draft, trackStock: false }),
  },
  stock: {
    applies: (draft) => draft.trackStock === true && draft.stock === undefined,
    ask: (draft) => ({ question: `How many ${draft.name} do you have right now?` }),
    read: (raw, draft) => {
      const n = Number(normalize(raw));
      if (!Number.isInteger(n) || n < 0) return { error: "Stock must be a whole number, zero or more." };
      return { ...draft, stock: n };
    },
    skip: (draft) => ({ ...draft, stock: 0 }),
  },
  lowStock: {
    applies: (draft) => draft.trackStock === true,
    ask: () => ({
      question: `Alert you when stock falls to how many? (${DEFAULT_LOW_STOCK_THRESHOLD} if you skip)`,
      chips: ["Skip", "2", "10", "20"],
    }),
    read: (raw, draft) => {
      const n = Number(normalize(raw));
      if (!Number.isInteger(n) || n < 0) return { error: "Low stock alert must be a whole number, zero or more." };
      return { ...draft, lowStockThreshold: n };
    },
    skip: (draft) => ({ ...draft, lowStockThreshold: null }),
  },
  sku: {
    ask: () => ({ question: "SKU or item code?", chips: ["Skip"] }),
    read: (raw, draft) => ({ ...draft, sku: raw.trim() }),
  },
  barcode: {
    ask: () => ({ question: "Barcode? Scan it into the box with your scanner, or type it.", chips: ["Skip"] }),
    read: (raw, draft) => ({ ...draft, barcode: raw.trim() }),
  },
  description: {
    ask: () => ({ question: "Any description? (shown on Products)", chips: ["Skip"] }),
    read: (raw, draft) => ({ ...draft, description: raw.trim() }),
  },
};

const ORDER: ProductStep[] = [
  "name",
  "price",
  "category",
  "unit",
  "cost",
  "taxRate",
  "taxInclusive",
  "trackStock",
  "stock",
  "lowStock",
  "sku",
  "barcode",
  "description",
];

function nextStep(after: ProductStep | null, draft: ProductDraft, data: AssistantData): ProductStep | null {
  const start = after === null ? 0 : ORDER.indexOf(after) + 1;
  for (const step of ORDER.slice(start)) {
    const def = STEPS[step];
    if (def.applies && !def.applies(draft, data)) continue;
    // Already answered in the request that started the flow.
    if (step === "name" && draft.name) continue;
    if (step === "price" && draft.sellingPrice !== undefined) continue;
    if (step === "trackStock" && draft.trackStock !== undefined) continue;
    return step;
  }
  return null;
}

function askStep(step: ProductStep, draft: ProductDraft, history: ProductStep[], data: AssistantData, prefix?: string): AgentReply {
  const { question, chips = [] } = STEPS[step].ask(draft, data);
  const canSave = draft.name !== undefined && draft.sellingPrice !== undefined;
  const remaining = ORDER.slice(ORDER.indexOf(step)).filter((s) => !STEPS[s].applies || STEPS[s].applies!(draft, data)).length;
  return {
    text: prefix ? `${prefix} ${question}` : question,
    bullets: canSave ? [`${remaining} question${remaining === 1 ? "" : "s"} left — or tap “Save now” to skip the rest.`] : undefined,
    suggestions: [...chips, ...(canSave ? ["Save now"] : []), ...(history.length ? ["Back"] : []), "Cancel"],
    flow: { kind: "product", step, draft, history },
  };
}

/** Begin the guided "new product" questions, skipping what was already said. */
export function startProductFlow(draft: ProductDraft, data: AssistantData): AgentReply {
  const step = nextStep(null, draft, data);
  if (!step) return productSummary(draft, data);
  const intro = draft.name ? `Let's add ${draft.name}.` : "Let's add a new product. I'll ask each field — skip any you don't need.";
  return askStep(step, draft, [], data, intro);
}

function productSummary(draft: ProductDraft, data: AssistantData): AgentReply {
  const currency = data.business?.currency || "INR";
  const category = draft.categoryId
    ? (data.categories ?? []).find((c) => c.id === draft.categoryId)?.name ?? "—"
    : draft.newCategoryName
      ? `${draft.newCategoryName} (new)`
      : "—";
  const taxLine = data.settings.taxEnabled
    ? `Tax: ${draft.taxRate ?? `${data.settings.defaultTaxRate}% (default)`}${draft.taxRate != null ? "%" : ""}${draft.taxInclusive ? ", included in price" : ", added on top"}`
    : null;
  const details = [
    `Name: ${draft.name}`,
    `Selling price: ${formatMoney(draft.sellingPrice ?? 0, currency)}`,
    `Category: ${category}`,
    ...(draft.unit ? [`Unit: ${draft.unit}`] : []),
    ...(draft.costPrice != null ? [`Cost price: ${formatMoney(draft.costPrice, currency)}`] : []),
    ...(taxLine ? [taxLine] : []),
    draft.trackStock
      ? `Stock: ${draft.stock ?? 0} · alert at ${draft.lowStockThreshold ?? DEFAULT_LOW_STOCK_THRESHOLD}`
      : "Stock: not tracked",
    ...(draft.sku ? [`SKU: ${draft.sku}`] : []),
    ...(draft.barcode ? [`Barcode: ${draft.barcode}`] : []),
    ...(draft.description ? [`Description: ${draft.description}`] : []),
  ];
  return {
    text: "Here's the new product. Confirm to save it — you can add a photo later on Products.",
    proposal: {
      action: {
        kind: "add-product",
        newCategoryName: draft.categoryId ? null : draft.newCategoryName ?? null,
        input: {
          name: draft.name ?? "",
          sellingPrice: draft.sellingPrice ?? 0,
          sku: draft.sku ?? "",
          barcode: draft.barcode ?? "",
          categoryId: draft.categoryId ?? "",
          costPrice: draft.costPrice ?? null,
          taxRate: draft.taxRate ?? null,
          taxInclusive: draft.taxInclusive ?? false,
          trackStock: draft.trackStock ?? false,
          stock: draft.trackStock ? draft.stock ?? 0 : 0,
          lowStockThreshold: draft.trackStock ? draft.lowStockThreshold ?? null : null,
          unit: draft.unit ?? "",
          imageDataUrl: "",
          description: draft.description ?? "",
        },
      },
      title: `Add product · ${draft.name}`,
      details,
      confirmLabel: "Add product",
    },
  };
}

function continueProduct(flow: Extract<Flow, { kind: "product" }>, raw: string, data: AssistantData): AgentReply {
  const text = normalize(raw).replace(/[.!]+$/, "");
  const { step, draft, history } = flow;

  if (BACK.test(text) && history.length > 0) {
    const previous = history[history.length - 1];
    return askStep(previous, draft, history.slice(0, -1), data);
  }
  if (SAVE_NOW.test(text)) {
    if (draft.name === undefined || draft.sellingPrice === undefined) {
      return askStep(step, draft, history, data, "I need at least a name and a price.");
    }
    return productSummary(draft, data);
  }

  const def = STEPS[step];
  let next: ProductDraft;
  if (SKIP.test(text) || (/^skip/.test(text) && !def.required)) {
    if (def.required) return askStep(step, draft, history, data, "This one's needed.");
    next = def.skip ? def.skip(draft) : draft;
  } else {
    const result = def.read(raw, draft, data);
    if ("error" in result) return askStep(step, draft, history, data, result.error);
    next = result;
  }

  const following = nextStep(step, next, data);
  if (!following) return productSummary(next, data);
  return askStep(following, next, [...history, step], data);
}

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

/** Handle a message while a flow is open. The reply carries the next flow, or none. */
export function continueFlow(flow: Flow, raw: string, data: AssistantData, now: Date = new Date()): AgentReply {
  const text = normalize(raw).replace(/[.!]+$/, "");
  if (CANCEL.test(text)) return { text: "Okay, cancelled. Nothing was changed." };

  if (flow.kind === "product") return continueProduct(flow, raw, data);

  // "ask": put the answer into the command and run it.
  const reply = respond(flow.template.replace("{answer}", raw.trim()), data, now);
  return reply.notUnderstood || reply.guess
    ? { text: `Sorry, I couldn't use that. ${flow.question}`, suggestions: [...(flow.chips ?? []), "Cancel"], flow }
    : reply;
}
