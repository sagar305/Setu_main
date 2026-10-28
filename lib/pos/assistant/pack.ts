// The downloadable language pack, and how the assistant uses it.
//
// The built-in rules (agent.ts) understand a fixed set of phrasings. The pack
// — public/pos-assistant/pack-v1.json, fetched once and kept in the browser —
// teaches it many more, in three layers that each run only when the one
// before did not understand:
//
//   1. Synonyms reword Hinglish and Hindi into words the rules know
//      ("maal daal do" → "stock add", "आज की बिक्री" → "today sales").
//   2. Keyword matching compares the request with the pack's example
//      phrasings, intent by intent.
//   3. Meaning matching does the same comparison with an on-device sentence
//      model (see ai/), so phrasings that share no words still land.
//
// Layers 2 and 3 work on a "delexicalised" request: the shop's own product
// and customer names and any numbers are swapped for placeholders first, so
// "12 Maggi aaye hai" and "{qty} {product} aaye" compare as the same shape.
// The matched intent's template is then filled back in with those values and
// handed to the rules — so whatever the pack understands still becomes the
// same confirm card, and the pack can never perform anything the rules can't.

import {
  articleReply,
  readPeriod,
  respond,
  type AgentReply,
  type AssistantData,
} from "./agent";
import { HELP_ARTICLES } from "./knowledge";
import { foldName, matchByName, normalize, readNumber } from "./text";
import type { ScreenId } from "@/components/tools/FreePos/nav";

export const PACK_URL = "/pos-assistant/pack-v1.json";

export type PackIntent = { id: string; template: string; examples: string[] };

export type AssistantPack = {
  version: number;
  synonyms: Record<string, string>;
  intents: PackIntent[];
};

const SCREENS: ScreenId[] = ["dashboard", "sell", "products", "orders", "customers", "reports", "settings"];
const SLOTS = ["product", "qty", "amount", "customer", "payment", "period", "items"];

/** Check a downloaded pack is what we expect before trusting any of it. */
export function validatePack(raw: unknown): AssistantPack {
  const fail = (why: string): never => {
    throw new Error(`The language pack is damaged (${why}).`);
  };
  if (!raw || typeof raw !== "object") fail("not an object");
  const pack = raw as Partial<AssistantPack>;
  if (typeof pack.version !== "number") fail("no version");
  if (!pack.synonyms || typeof pack.synonyms !== "object") fail("no synonyms");
  if (!Array.isArray(pack.intents) || pack.intents.length === 0) fail("no intents");
  for (const [from, to] of Object.entries(pack.synonyms!)) {
    if (typeof to !== "string" || !from.trim()) fail(`bad synonym “${from}”`);
  }
  for (const intent of pack.intents!) {
    if (!intent || typeof intent.id !== "string" || typeof intent.template !== "string") fail("bad intent");
    if (!Array.isArray(intent.examples) || intent.examples.some((e) => typeof e !== "string")) {
      fail(`bad examples in ${intent.id}`);
    }
    const { template } = intent;
    if (template.startsWith("help:")) {
      if (!HELP_ARTICLES.some((a) => a.id === template.slice(5))) fail(`unknown help article ${template}`);
    } else if (template.startsWith("nav:")) {
      if (!SCREENS.includes(template.slice(4) as ScreenId)) fail(`unknown screen ${template}`);
    } else {
      for (const slot of template.match(/\{(\w+)\}/g) ?? []) {
        if (!SLOTS.includes(slot.slice(1, -1))) fail(`unknown slot ${slot} in ${intent.id}`);
      }
    }
  }
  return pack as AssistantPack;
}

// ---------------------------------------------------------------------------
// Layer 1: synonyms
// ---------------------------------------------------------------------------

/**
 * Reword a request with the pack's synonyms, longest phrase first. Words that
 * belong to one of the shop's own product or customer names are left alone,
 * so a product called "Thanda Tel" is never turned into "drink tel".
 */
export function applySynonyms(text: string, pack: AssistantPack, data?: AssistantData): string {
  const protectedWords = new Set<string>();
  for (const name of [...(data?.products.map((p) => p.name) ?? []), ...(data?.customers.map((c) => c.name) ?? [])]) {
    for (const word of foldName(name).split(" ")) protectedWords.add(word);
  }

  let out = ` ${normalize(text)} `;
  for (const { from, to, pattern } of compiledSynonyms(pack)) {
    if (protectedWords.size > 0 && from.split(" ").every((word) => protectedWords.has(word))) continue;
    out = out.replace(pattern, to);
  }
  return out.replace(/\s+/g, " ").trim();
}

type CompiledSynonym = { from: string; to: string; pattern: RegExp };
const synonymCache = new WeakMap<AssistantPack, CompiledSynonym[]>();

/** Synonyms as ready regexes, longest phrase first; built once per pack. */
function compiledSynonyms(pack: AssistantPack): CompiledSynonym[] {
  let compiled = synonymCache.get(pack);
  if (!compiled) {
    compiled = Object.entries(pack.synonyms)
      .map(([raw, to]) => ({ from: normalize(raw), to }))
      .filter(({ from }) => from)
      .sort((a, b) => b.from.length - a.from.length)
      .map(({ from, to }) => ({
        from,
        to,
        // Unicode-aware word edges: \b does not understand Devanagari.
        pattern: new RegExp(`(?<=\\s)${from.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}(?=\\s)`, "gu"),
      }));
    synonymCache.set(pack, compiled);
  }
  return compiled;
}

// ---------------------------------------------------------------------------
// Delexicalising: pull the shop's own values out of a request
// ---------------------------------------------------------------------------

export type Slots = {
  /** Products mentioned, in order, with the quantity next to each (if any). */
  items: { productName: string; qty: number | null }[];
  /** Numbers that are not part of a product name. */
  numbers: number[];
  customerName: string | null;
  paymentName: string | null;
  credit: boolean;
  /** The request with values replaced by placeholder words, for matching. */
  shape: string;
};

const MAX_SPAN = 5;

/**
 * Placeholder words. Deliberately not real words, so a request that says
 * "product" or "customer" is not mistaken for one that names one.
 */
export const PH = { product: "xproduct", number: "xnumber", customer: "xcustomer", payment: "xpayment" } as const;

export function extractSlots(text: string, data: AssistantData): Slots {
  const words = foldName(text).split(" ").filter(Boolean);
  const shape: string[] = [];
  const items: Slots["items"] = [];
  const numbers: number[] = [];
  let customerName: string | null = null;
  let paymentName: string | null = null;
  let credit = false;
  let pendingQty: number | null = null;

  const paymentNames = data.payments.map((p) => ({ name: p.name, folded: foldName(p.name) }));

  for (let i = 0; i < words.length; ) {
    // Payment method, one or two words ("upi", "google pay").
    const payment = paymentNames.find((p) => words.slice(i, i + p.folded.split(" ").length).join(" ") === p.folded);
    if (payment) {
      paymentName = payment.name;
      shape.push(PH.payment);
      i += payment.folded.split(" ").length;
      continue;
    }
    if (["credit", "udhaar", "udhar", "khata"].includes(words[i])) {
      credit = true;
      shape.push(PH.payment);
      i += 1;
      continue;
    }

    // Longest span naming a product or customer.
    let matched = false;
    for (let len = Math.min(MAX_SPAN, words.length - i); len >= 1 && !matched; len -= 1) {
      const span = words.slice(i, i + len).join(" ");
      if (len === 1 && (readNumber(span) !== null || span.length < 3)) continue;
      const product = matchByName(span, data.products, (p) => [p.name], 0.8);
      if (product.kind === "found") {
        items.push({ productName: product.item.name, qty: pendingQty });
        pendingQty = null;
        shape.push(PH.product);
        i += len;
        matched = true;
        break;
      }
      const customer = matchByName(span, data.customers, (c) => [c.name], 0.85);
      if (customer.kind === "found") {
        customerName = customer.item.name;
        shape.push(PH.customer);
        i += len;
        matched = true;
      }
    }
    if (matched) continue;

    const n = /^\d+(\.\d+)?$/.test(words[i]) ? Number(words[i]) : null;
    if (n !== null) {
      numbers.push(n);
      // A number right after a product is its quantity ("maggi 2"); otherwise
      // it waits for the product that follows ("2 maggi").
      const last = items[items.length - 1];
      if (last && last.qty === null && shape[shape.length - 1] === PH.product) last.qty = n;
      else pendingQty = n;
      shape.push(PH.number);
      i += 1;
      continue;
    }
    shape.push(words[i]);
    i += 1;
  }

  return { items, numbers, customerName, paymentName, credit, shape: shape.join(" ") };
}

/**
 * The same placeholder words, applied to a pack example — and the same
 * synonyms, so "aaj ka hisaab" in the pack meets "aaj ka hisaab" typed, both
 * as "today ka hisaab".
 */
export function exampleShape(example: string, pack?: AssistantPack): string {
  const shaped = normalize(
    example
      .replace(/\{product\}/g, ` ${PH.product} `)
      .replace(/\{(qty|amount)\}/g, ` ${PH.number} `)
      .replace(/\{customer\}/g, ` ${PH.customer} `)
      .replace(/\{payment\}/g, ` ${PH.payment} `)
  );
  return pack ? applySynonyms(shaped, pack) : shaped;
}

// ---------------------------------------------------------------------------
// Layer 2: keyword matching against the examples
// ---------------------------------------------------------------------------

const FILLER = new Set("a an the to of is it i me my we do does did can you please pls ka ki ke ko hai hain kya se me mein karo kar do".split(" "));

function bag(text: string): string[] {
  return text.split(" ").filter((word) => word && !FILLER.has(word));
}

function wordsAlike(a: string, b: string): boolean {
  if (a === b) return true;
  if (a.length >= 4 && b.length >= 4 && (a.startsWith(b) || b.startsWith(a))) return true;
  return false;
}

export type IntentMatch = { intent: PackIntent; score: number; example: string };

/** Best intent by word overlap with its examples, 0–1. */
export function keywordIntent(shape: string, pack: AssistantPack): IntentMatch | null {
  const query = bag(shape);
  if (query.length === 0) return null;
  let best: IntentMatch | null = null;
  for (const { intent, shape: example, words: target } of flatExamples(pack)) {
    if (target.length === 0) continue;
    const hits = query.filter((word) => target.some((t) => wordsAlike(word, t))).length;
    const covered = target.filter((t) => query.some((word) => wordsAlike(word, t))).length;
    const score = (hits / query.length + covered / target.length) / 2;
    if (!best || score > best.score) best = { intent, score, example };
  }
  return best;
}

export const KEYWORD_THRESHOLD = 0.6;
/** Cosine similarity a meaning match needs; MiniLM paraphrases sit well above. */
export const SEMANTIC_THRESHOLD = 0.6;

// ---------------------------------------------------------------------------
// Filling an intent back into a command the rules understand
// ---------------------------------------------------------------------------

const PERIOD_PHRASES: Record<string, string> = {
  today: "today",
  yesterday: "yesterday",
  "this week": "this week",
  "last week": "last week",
  "this month": "this month",
  "last month": "last month",
  "this year": "this year",
  "in the last 7 days": "last 7 days",
  "in total": "all time",
};

export type Filled = { command: string } | { ask: string };

export function fillIntent(intent: PackIntent, text: string, slots: Slots, data: AssistantData, now: Date): Filled {
  const template = intent.template;
  const product = slots.items[0]?.productName;
  const fold = (name: string) => foldName(name);

  if (template.includes("{product}") && !product) {
    return { ask: "Which product? Say its name as saved in Products." };
  }
  const nonQty = slots.numbers;
  const qty = slots.items[0]?.qty ?? nonQty[0];
  if (template.includes("{qty}") && (qty === undefined || qty === null)) {
    return { ask: `How many ${product ?? "items"}?` };
  }
  const amount = nonQty[nonQty.length - 1];
  if (template.includes("{amount}") && amount === undefined) {
    return { ask: `What should the new price of ${product ?? "it"} be?` };
  }
  if (template.includes("{items}") && slots.items.length === 0) {
    return { ask: "Which products should I bill? For example: “2 Maggi and 1 Coke”." };
  }

  const period = readPeriod(text, now);
  const command = template
    .replace("{product}", product ? fold(product) : "")
    .replace("{qty}", String(qty ?? ""))
    .replace("{amount}", String(amount ?? ""))
    .replace("{period}", period ? PERIOD_PHRASES[period.label] ?? "" : "")
    .replace("{items}", slots.items.map((item) => `${item.qty ?? 1} ${fold(item.productName)}`).join(", "))
    .replace("{payment}", slots.credit ? " on credit" : slots.paymentName ? ` by ${fold(slots.paymentName)}` : "")
    .replace("{customer}", slots.customerName ? ` to ${fold(slots.customerName)}` : "")
    .replace(/\s+/g, " ")
    .trim();
  return { command };
}

function replyForIntent(
  intent: PackIntent,
  text: string,
  slots: Slots,
  data: AssistantData,
  now: Date
): AgentReply | null {
  if (intent.template.startsWith("help:")) {
    const article = HELP_ARTICLES.find((a) => a.id === intent.template.slice(5));
    return article ? articleReply(article) : null;
  }
  if (intent.template.startsWith("nav:")) {
    const screen = intent.template.slice(4) as ScreenId;
    return respond(`open ${screen === "sell" ? "new sale" : screen}`, data, now);
  }
  const filled = fillIntent(intent, text, slots, data, now);
  if ("ask" in filled) return { text: filled.ask };
  const reply = respond(filled.command, data, now);
  return reply.notUnderstood || reply.guess ? null : { ...reply, understoodAs: filled.command };
}

// ---------------------------------------------------------------------------
// The whole pipeline
// ---------------------------------------------------------------------------

/** Embeds the request and finds the nearest pack example; supplied by ai/client.ts. */
export type MeaningMatcher = (shape: string) => Promise<{ exampleIndex: number; score: number } | null>;

export type SmartOptions = {
  pack?: AssistantPack | null;
  meaning?: MeaningMatcher | null;
  now?: Date;
};

export type PackExample = { intent: PackIntent; shape: string; words: string[] };
const exampleCache = new WeakMap<AssistantPack, PackExample[]>();

/** Every pack example in one flat list, in the order the meaning model indexes them. */
export function flatExamples(pack: AssistantPack): PackExample[] {
  let examples = exampleCache.get(pack);
  if (!examples) {
    examples = pack.intents.flatMap((intent) =>
      intent.examples.map((example) => {
        const shape = exampleShape(example, pack);
        return { intent, shape, words: bag(shape) };
      })
    );
    exampleCache.set(pack, examples);
  }
  return examples;
}

export async function smartRespond(input: string, data: AssistantData, options: SmartOptions = {}): Promise<AgentReply> {
  const now = options.now ?? new Date();
  const direct = respond(input, data, now);
  const pack = options.pack;
  if (!pack || !(direct.notUnderstood || direct.guess)) return direct;

  // Layer 1: reword and let the rules try again.
  const reworded = applySynonyms(input, pack, data);
  if (reworded !== normalize(input)) {
    const second = respond(reworded, data, now);
    if (!second.notUnderstood && !second.guess) return { ...second, understoodAs: second.understoodAs ?? reworded };
  }

  const slots = extractSlots(reworded, data);

  // Layer 2: keywords.
  const keyword = keywordIntent(slots.shape, pack);
  if (keyword && keyword.score >= KEYWORD_THRESHOLD) {
    const reply = replyForIntent(keyword.intent, reworded, slots, data, now);
    if (reply) return reply;
  }

  // Layer 3: meaning.
  if (options.meaning) {
    try {
      const hit = await options.meaning(slots.shape);
      const examples = flatExamples(pack);
      if (hit && hit.score >= SEMANTIC_THRESHOLD && examples[hit.exampleIndex]) {
        const reply = replyForIntent(examples[hit.exampleIndex].intent, reworded, slots, data, now);
        if (reply) return reply;
      }
    } catch {
      // The model is an extra; if it fails, the plain answer stands.
    }
  }

  return direct;
}
