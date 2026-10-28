// The POS assistant: reads what the shopkeeper typed and decides what to do.
//
// It runs entirely in the browser, on data already in memory, with no model
// to download — so it works offline from the first page load, on the cheapest
// phone, and nothing typed into it can leave the device.
//
// Every reply is one of three things:
//   - an answer (a help article, or a figure read from the shop's own data);
//   - a proposed action (a sale, a stock change…) that the UI shows as a card
//     and only carries out when the user presses Confirm;
//   - a question back, with the likely answers as tappable suggestions, when
//     the request names something ambiguous. Guessing a product is how a
//     wrong sale gets recorded, so the assistant asks instead.
//
// `respond` is a pure function of (text, data, now). Carrying out a confirmed
// action is executor.ts's job, so this file can be tested without a browser.

import type { ScreenId } from "@/components/tools/FreePos/nav";
import { calculateCartTotals } from "@/lib/pos/calc";
import { isToolEnabled } from "@/lib/pos/posTools";
import {
  formatMoney,
  isLowStock,
  isOutOfStock,
  type Business,
  type CartLine,
  type Category,
  type Customer,
  type Order,
  type OrderItem,
  type PaymentMethod,
  type PosSettings,
  type Product,
} from "@/lib/pos/types";
import type { CustomerInput, ProductInput } from "@/lib/pos/store";
import { startProductFlow, type Flow, type ProductDraft } from "./flows";
import { insightsReply } from "./insights";
import { HELP_ARTICLES, type HelpArticle } from "./knowledge";
import { settingsReply } from "./settings";
import { foldName, hasAny, matchByName, nameScore, normalize, readNumber, tokens } from "./text";

export type AssistantData = {
  business: Business | null;
  settings: PosSettings;
  products: Product[];
  customers: Customer[];
  orders: Order[];
  orderItems: OrderItem[];
  payments: PaymentMethod[];
  /** Optional so callers without categories still work; new products then skip the choice. */
  categories?: Category[];
};

export type AgentAction =
  | {
      kind: "sale";
      lines: CartLine[];
      paymentMethodId: string;
      creditSale: boolean;
      customerId: string | null;
    }
  | { kind: "stock"; productId: string; mode: "add" | "reduce" | "adjust"; quantity: number }
  | { kind: "price"; productId: string; price: number }
  | { kind: "add-product"; input: ProductInput; newCategoryName: string | null }
  | { kind: "add-customer"; name: string; phone: string }
  | { kind: "settings"; updates: Partial<Omit<PosSettings, "id">>; label: string }
  | { kind: "business"; updates: Partial<Omit<Business, "id" | "createdAt">>; label: string }
  | { kind: "payment-add"; name: string }
  | { kind: "payment-remove"; id: string }
  | { kind: "cancel-order"; orderId: string }
  | { kind: "backup" };

export type ScreenLink = { screen: ScreenId; query?: string; label: string };

export type AgentReply = {
  text: string;
  bullets?: string[];
  /** Set when the reply proposes a change; nothing happens until confirmed. */
  proposal?: { action: AgentAction; title: string; details: string[]; confirmLabel: string };
  /** A screen the answer is about, offered as a button. */
  link?: ScreenLink;
  /** Open this screen straight away (plain navigation needs no confirmation). */
  navigate?: { screen: ScreenId; query?: string };
  /** Follow-ups the user can tap instead of typing. */
  suggestions?: string[];
  /** Set only on the "didn't get that" reply, so a smarter pass can take over. */
  notUnderstood?: true;
  /** A loose help-article match: a smarter pass may do better, but this stands if not. */
  guess?: true;
  /** When a downloaded pack reworded the request, what it was understood as. */
  understoodAs?: string;
  /** A question is open: the next message answers it (see flows.ts). */
  flow?: Flow;
  /** Put these in the New Sale cart (harmless, so no confirmation). */
  cart?: { productId: string; quantity: number }[];
};

export const STARTER_SUGGESTIONS = [
  "Today's sales",
  "What is low on stock?",
  "Top products this week",
  "How do I print a receipt?",
];

// ---------------------------------------------------------------------------
// Entry point
// ---------------------------------------------------------------------------

export function respond(input: string, data: AssistantData, now: Date = new Date()): AgentReply {
  const text = stripPoliteness(normalize(input));
  const ctx: Ctx = { data, now, currency: data.business?.currency || "INR", raw: input };

  if (!text) return intro(ctx);
  if (/^(hi+|hello|hey|namaste|namaskar|hii+|good (morning|afternoon|evening))\b/.test(text) && text.split(" ").length <= 3) {
    return intro(ctx);
  }
  if (/^(thanks?|thank you|thx|ok(ay)?|shukriya|dhanyavaad|great|nice|cool)\b/.test(text) && text.split(" ").length <= 3) {
    return { text: "Happy to help. Ask me anything else about your shop.", suggestions: STARTER_SUGGESTIONS };
  }
  if (/\b(what can you do|help me|what do you do|your features|commands)\b/.test(text) || text === "help") {
    return capabilities();
  }

  // A how-to question goes to the help articles first, so "how do I add
  // stock?" explains the screen instead of trying to add stock.
  if (isHowToQuestion(text)) {
    const article = findArticle(text, 0.3);
    if (article) return articleReply(article);
  }

  return (
    actionReply(text, ctx) ??
    queryReply(text, ctx) ??
    navigationReply(text) ??
    articleFallback(text) ??
    notUnderstood()
  );
}

type Ctx = { data: AssistantData; now: Date; currency: string; raw: string };

function stripPoliteness(text: string): string {
  return text
    .replace(/^(please|pls|plz|kindly|can you|could you|would you|will you|zara|i want to|i need to|i wanna|lets|let us|help me)\s+/g, "")
    .replace(/^(please|pls|plz)\s+/, "")
    .replace(/\s+(please|pls|plz|karo|kar do|kardo|kar dijiye|kijiye|now|for me|na)$/g, "")
    .replace(/[?.!,]+$/, "")
    .trim();
}

function isHowToQuestion(text: string): boolean {
  if (/^(how (much|many)|kitna|kitne|kitni)\b/.test(text)) return false;
  return /^(how|where|why|can i|is it possible|is there|does|do i|kaise|kaha|kahan|kya main|what is the way|what happens|explain)\b/.test(text) ||
    /\b(kaise|how to|how do)\b/.test(text);
}

function intro(ctx: Ctx): AgentReply {
  const name = ctx.data.business?.name;
  return {
    text: `Hi${name ? ` — I'm the assistant for ${name}` : ""}. Ask me how anything in the POS works, ask about your sales and stock, or tell me what to do and I'll do it after you confirm.`,
    bullets: [
      "“Today's sales” · “What is low on stock?”",
      "“Sell 2 Maggi and 1 Coke by UPI”",
      "“Add 24 stock to Maggi” · “Turn on tax”",
      "“Top customers” · “Who stopped coming?”",
    ],
    suggestions: STARTER_SUGGESTIONS,
  };
}

function capabilities(): AgentReply {
  return {
    text: "Here's what I can do, all on this device — even offline:",
    bullets: [
      "Answer how-to questions about billing, stock, GST, receipts, backups and more.",
      "Report sales, profit, top products and payment split for today, yesterday, this week or month.",
      "Tell you stock and price of any product, and what is running low.",
      "Show insights: top customers by spend, regulars who stopped coming, slow-moving stock, busiest day and hour.",
      "Record a sale, fill the bill, add or reduce stock, change a price, add a product (I'll ask each field) or customer, cancel a bill, take a backup — each change only after you confirm.",
      "Change settings: tax on/off, tax rate, invoice prefix, receipt footer, paper size, shop details, connected tools, payment methods.",
    ],
    suggestions: ["Top customers", "Regulars who stopped coming", "Create a new product", "Change settings"],
  };
}

function notUnderstood(): AgentReply {
  return {
    text: "Sorry, I didn't get that. Try one of these, or ask “what can you do?”.",
    suggestions: STARTER_SUGGESTIONS,
    notUnderstood: true,
  };
}

// ---------------------------------------------------------------------------
// Help articles
// ---------------------------------------------------------------------------

const STOPWORDS = new Set(
  "i me my a an the to of in on for and or is it do does did can how what where why which we you your this that with be are was kaise kya ka ki ke ko main mein hai se karo kare karna".split(" ")
);

function contentWords(text: string): string[] {
  return tokens(text).filter((word) => !STOPWORDS.has(word));
}

function scoreArticle(query: string, article: HelpArticle): number {
  const words = contentWords(query);
  if (words.length === 0) return 0;
  let best = 0;
  for (const phrase of [article.title, ...article.phrases]) {
    const target = contentWords(phrase);
    if (target.length === 0) continue;
    let hits = 0;
    for (const word of words) {
      if (target.some((t) => t === word || (word.length >= 4 && t.length >= 4 && (t.startsWith(word) || word.startsWith(t))))) hits += 1;
    }
    // Reward covering the question and covering the phrase, equally.
    best = Math.max(best, (hits / words.length + hits / target.length) / 2);
  }
  const keywordHit = words.some((word) => article.keywords.includes(word)) ? 0.2 : 0;
  return best + keywordHit;
}

export function findArticle(query: string, threshold: number): HelpArticle | null {
  let winner: HelpArticle | null = null;
  let top = 0;
  for (const article of HELP_ARTICLES) {
    const score = scoreArticle(query, article);
    if (score > top) {
      top = score;
      winner = article;
    }
  }
  return top >= threshold ? winner : null;
}

export function articleReply(article: HelpArticle): AgentReply {
  return {
    text: article.title,
    bullets: article.answer,
    link: article.screen ? { screen: article.screen, label: `Open ${screenLabel(article.screen)}` } : undefined,
    suggestions: article.tryCommand ? [article.tryCommand] : undefined,
  };
}

function articleFallback(text: string): AgentReply | null {
  const article = findArticle(text, 0.45);
  return article ? { ...articleReply(article), guess: true } : null;
}

// ---------------------------------------------------------------------------
// Actions — each returns a proposal, never a change
// ---------------------------------------------------------------------------

const QTY = "(\\d+|[a-z]+)";
const MONEY = "(?:rs\\.?\\s*|₹\\s*|inr\\s*)?(\\d+(?:\\.\\d+)?)";
const UNIT_WORDS = "(?:units?|pcs|pieces?|packets?|pkts?|nos|boxes?|bottles?|kg|kgs|items?|qty)";

function actionReply(text: string, ctx: Ctx): AgentReply | null {
  return (
    settingsReply(ctx.raw, text, ctx.data) ??
    cancelOrderAction(text, ctx) ??
    backupAction(text) ??
    addCustomerAction(text, ctx) ??
    addProductAction(text, ctx) ??
    cartAction(text, ctx) ??
    priceAction(text, ctx) ??
    stockAction(text, ctx) ??
    whichAddAction(text, ctx) ??
    saleAction(text, ctx)
  );
}

function backupAction(text: string): AgentReply | null {
  if (!/\b(backup|back up)\b/.test(text)) return null;
  if (!/^(take|make|download|export|create|save|do|run|backup|back up)\b/.test(text)) return null;
  return {
    text: "I'll download a full backup of this POS as a JSON file.",
    proposal: {
      action: { kind: "backup" },
      title: "Download backup",
      details: ["Products, stock, customers, orders and settings", "Saved to your Downloads folder"],
      confirmLabel: "Download",
    },
  };
}

function cancelOrderAction(text: string, ctx: Ctx): AgentReply | null {
  const match = text.match(/^(?:cancel|void|refund|reverse)\s+(?:the\s+)?(?:bill|order|invoice|sale|receipt)?\s*(?:no\.?|number|#)?\s*(.+)$/);
  if (!match) return null;
  const target = match[1].trim();
  const completed = ctx.data.orders.filter((o) => o.status === "completed");

  let order: Order | undefined;
  if (/^(last|latest|previous|recent|pichla)( (one|bill|sale|order))?$/.test(target)) {
    order = [...completed].sort((a, b) => b.date.localeCompare(a.date))[0];
    if (!order) return { text: "There is no completed sale to cancel yet." };
  } else {
    order = findOrderByNumber(target, ctx.data.orders);
    if (!order) {
      return {
        text: `I couldn't find a bill numbered “${target.toUpperCase()}”.`,
        link: { screen: "orders", label: "Open Orders" },
      };
    }
    if (order.status === "cancelled") return { text: `${order.invoiceNumber} is already cancelled.` };
  }

  const items = ctx.data.orderItems.filter((item) => item.orderId === order!.id);
  return {
    text: `Cancel ${order.invoiceNumber}? Its stock goes back on the shelf and it leaves your sales totals.`,
    proposal: {
      action: { kind: "cancel-order", orderId: order.id },
      title: `Cancel ${order.invoiceNumber}`,
      details: [
        `${formatDateTime(order.date)} · ${order.customerName || "Walk-in"}`,
        ...items.slice(0, 5).map((item) => `${item.quantity} × ${item.name}`),
        ...(items.length > 5 ? [`…and ${items.length - 5} more`] : []),
        `Total ${formatMoney(order.total, ctx.currency)} · ${order.paymentMethodName}`,
      ],
      confirmLabel: "Cancel bill",
    },
  };
}

function findOrderByNumber(target: string, orders: Order[]): Order | undefined {
  const wanted = target.replace(/\s+/g, "").toLowerCase();
  const exact = orders.find((o) => o.invoiceNumber.toLowerCase() === wanted);
  if (exact) return exact;
  // "cancel 12" or "inv 12" means invoice number 12, whatever its prefix and padding.
  const digits = wanted.match(/(\d+)$/);
  if (!digits) return undefined;
  const n = Number(digits[1]);
  const byNumber = orders.filter((o) => Number(o.invoiceNumber.match(/(\d+)$/)?.[1]) === n);
  return byNumber.length === 1 ? byNumber[0] : undefined;
}

function addCustomerAction(text: string, ctx: Ctx): AgentReply | null {
  const match = text.match(/^(?:add|create|new|save)\s+(?:a\s+)?(?:new\s+)?(?:customer|grahak|client)\s+(?:named\s+|called\s+)?(.+)$/);
  if (!match) return null;
  let rest = match[1];
  const phoneMatch = rest.match(/(\+?\d[\d\s-]{6,}\d)/);
  const phone = phoneMatch ? phoneMatch[1].replace(/[\s-]/g, "") : "";
  if (phoneMatch) rest = rest.replace(phoneMatch[0], " ");
  const name = titleCase(rest.replace(/\b(phone|mobile|number|no|with|ph)\b/g, " ").replace(/\s+/g, " ").trim());
  if (!name) return { text: "What's the customer's name? For example: “add customer Ramesh 9876543210”." };

  const existing = ctx.data.customers.find(
    (c) => foldName(c.name) === foldName(name) || (phone && c.phone.replace(/\D/g, "").endsWith(phone.replace(/\D/g, "").slice(-10)))
  );
  if (existing) {
    return {
      text: `${existing.name}${existing.phone ? ` (${existing.phone})` : ""} is already saved.`,
      link: { screen: "customers", query: existing.name, label: "Show customer" },
    };
  }

  return {
    text: `Save ${name} as a customer?`,
    proposal: {
      action: { kind: "add-customer", name, phone },
      title: "Add customer",
      details: [`Name: ${name}`, `Phone: ${phone || "—"}`],
      confirmLabel: "Save customer",
    },
  };
}

function addProductAction(text: string, ctx: Ctx): AgentReply | null {
  // "add product" on its own could mean a new product or one for the bill: ask.
  if (/^(?:add|put)\s+(?:a\s+)?(?:product|item)s?$/.test(text)) {
    return {
      text: "Do you want to create a new product, or add a product to the current bill?",
      suggestions: ["Create a new product", "Add to the bill"],
    };
  }
  if (/^(?:add\s+)?(?:more\s+)?(?:(?:a\s+)?(?:product|item)s?\s+)?(?:to|in|into)\s+(?:the\s+)?(?:current\s+)?(?:bill|cart|sale|order)$/.test(text)) {
    return askForCartItems();
  }
  // "create a new product", "new product", "naya product" → the guided questions.
  if (/^(?:create|make|new|add|save|register)\s+(?:a\s+)?(?:new\s+)?(?:product|item)s?$|^(?:create|add|make)\s+(?:a\s+)?new\s+one$/.test(text)) {
    return startProductFlow({}, ctx.data);
  }

  const match = text.match(/^(?:add|create|new|save)\s+(?:a\s+)?(?:new\s+)?(?:product|item)\s+(?:named\s+|called\s+)?(.+)$/);
  if (!match) return null;
  // Keep the user's own capitals for the name ("Parle-G", not "Parle G").
  const rawRest = ctx.raw.trim().replace(/[?!]+$/, "").replace(/^.*?\b(?:product|item)\s+(?:named\s+|called\s+)?/i, "");
  let rest = rawRest;
  const draft: ProductDraft = {};

  const stockMatch = rest.match(new RegExp(`\\s+(?:with|and|stock)\\s+${QTY}\\s*(?:${UNIT_WORDS}\\s*)?(?:in\\s+)?(?:stock)?$`, "i"));
  if (stockMatch) {
    const n = readNumber(stockMatch[1].toLowerCase());
    if (n !== null && Number.isInteger(n) && n >= 0) {
      draft.trackStock = true;
      draft.stock = n;
      rest = rest.slice(0, stockMatch.index);
    }
  }
  const priceMatch =
    rest.match(new RegExp(`\\s+(?:at|for|price|priced at|@|=|rs\\.?|₹)\\s*${MONEY}(?:\\s*(?:rs|rupees|each))?$`, "i")) ??
    rest.match(new RegExp(`\\s+${MONEY}(?:\\s*(?:rs|rupees))?$`, "i"));
  if (priceMatch) {
    draft.sellingPrice = Number(priceMatch[1]);
    rest = rest.slice(0, priceMatch.index);
  }
  const name = rest.trim();
  if (name) {
    const existing = ctx.data.products.find((p) => foldName(p.name) === foldName(name));
    if (existing) {
      return {
        text: `${existing.name} already exists at ${formatMoney(existing.sellingPrice, ctx.currency)}. Add it to the bill, add stock, or create a different product?`,
        suggestions: [`add 1 ${foldName(existing.name)} to bill`, `add stock to ${foldName(existing.name)}`, "Create a new product"],
      };
    }
    draft.name = name.charAt(0).toUpperCase() + name.slice(1);
  }
  return startProductFlow(draft, ctx.data);
}

function askForCartItems(): AgentReply {
  return {
    text: "Which products, and how many? For example: “2 Maggi and 1 Coke”.",
    suggestions: ["Cancel"],
    flow: { kind: "ask", question: "Which products, and how many?", template: "add {answer} to bill" },
  };
}

/** "add 2 maggi to the bill" — straight into the New Sale cart. */
function cartAction(text: string, ctx: Ctx): AgentReply | null {
  const match = text.match(/^(?:add|put|daal do|dalo)\s+(.+?)\s+(?:to|in|into|on|me|mein)\s+(?:the\s+)?(?:bill|cart|sale|order|basket|current bill)$/);
  if (!match) return null;
  const read = readLines(match[1], ctx, text);
  if ("reply" in read) return read.reply;
  return {
    text: `Added ${read.lines.map((l) => `${l.quantity} × ${l.name}`).join(", ")} to the bill.`,
    cart: read.lines.map((l) => ({ productId: l.productId, quantity: l.quantity })),
    navigate: { screen: "sell" },
    suggestions: ["Add more to the bill", "Today's sales"],
  };
}

/** "add 2 maggi" names a product but not where: the bill, or the stock? */
function whichAddAction(text: string, ctx: Ctx): AgentReply | null {
  const match = text.match(/^add\s+(.+)$/);
  if (!match || /\b(stock|bill|cart|customer|product|item|payment)\b/.test(match[1])) return null;
  const item = readItem(match[1]);
  if (!item) return null;
  const found = findProduct(item.name, ctx, (option) => text.replace(item.name, foldName(option)));
  if (found.reply) return found.ambiguous ? found.reply : null;
  const name = foldName(found.product!.name);
  return {
    text: `Add ${item.qty} ${found.product!.name} to the current bill, or to your stock?`,
    suggestions: [`add ${item.qty} ${name} to bill`, `add ${item.qty} stock to ${name}`],
  };
}

function priceAction(text: string, ctx: Ctx): AgentReply | null {
  const patterns = [
    new RegExp(`^(?:set|change|update|make|edit)\\s+(?:the\\s+)?(?:selling\\s+)?(?:price|rate|mrp)\\s+(?:of|for)\\s+(.+?)\\s+(?:to|=|as|at)\\s+${MONEY}$`),
    new RegExp(`^(?:set|change|update|make|edit)\\s+(.+?)(?:'s|s)?\\s+(?:selling\\s+)?(?:price|rate|mrp)\\s+(?:to|=|as|at)?\\s*${MONEY}$`),
    new RegExp(`^(.+?)\\s+(?:ka\\s+)?(?:price|rate|daam|mrp)\\s+${MONEY}(?:\\s+(?:rs|rupees))?$`),
  ];
  for (const pattern of patterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const found = findProduct(match[1], ctx, (option) => text.replace(match[1], foldName(option)));
    if (found.reply) return found.reply;
    const product = found.product!;
    const price = Number(match[2]);
    if (price === product.sellingPrice) {
      return { text: `${product.name} is already ${formatMoney(price, ctx.currency)}.` };
    }
    return {
      text: `Change the price of ${product.name}?`,
      proposal: {
        action: { kind: "price", productId: product.id, price },
        title: `New price for ${product.name}`,
        details: [
          `${formatMoney(product.sellingPrice, ctx.currency)} → ${formatMoney(price, ctx.currency)}`,
          "Past bills keep the price they were sold at.",
        ],
        confirmLabel: "Update price",
      },
    };
  }
  return null;
}

function stockAction(text: string, ctx: Ctx): AgentReply | null {
  // "add stock to maggi" with no count: ask how many.
  const noQty = text.match(/^(?:add|update|restock)\s+(?:more\s+)?stock\s+(?:to|for|of|in)\s+(.+)$|^restock\s+([a-z].*?)$/);
  if (noQty && !/\d/.test(noQty[1] ?? noQty[2])) {
    const phrase = noQty[1] ?? noQty[2];
    const found = findProduct(phrase, ctx, (option) => text.replace(phrase, foldName(option)));
    if (found.reply) return found.reply;
    const name = foldName(found.product!.name);
    return {
      text: `How many ${found.product!.name} should I add to stock? (${found.product!.stock} now)`,
      suggestions: ["6", "12", "24", "Cancel"],
      flow: { kind: "ask", question: `How many ${found.product!.name}?`, template: `add {answer} stock to ${name}`, chips: ["6", "12", "24"] },
    };
  }
  type Parsed = { mode: "add" | "reduce" | "adjust"; qty: string; name: string };
  const tryPatterns: [RegExp, (m: RegExpMatchArray) => Parsed][] = [
    // set maggi stock to 10 · set stock of maggi to 10
    [
      new RegExp(`^(?:set|update|change|make|correct|fix)\\s+(?:the\\s+)?(?:stock|count|inventory|quantity)\\s+(?:of|for)\\s+(.+?)\\s+(?:to|=|as|at)\\s+${QTY}$`),
      (m) => ({ mode: "adjust", name: m[1], qty: m[2] }),
    ],
    [
      new RegExp(`^(?:set|update|change|make|correct|fix)\\s+(.+?)\\s+(?:stock|count|inventory|quantity)\\s+(?:to|=|as|at)?\\s*${QTY}$`),
      (m) => ({ mode: "adjust", name: m[1], qty: m[2] }),
    ],
    // add 24 stock to maggi · add 24 units to maggi stock
    [
      new RegExp(`^(?:add|put|load)\\s+${QTY}\\s+(?:${UNIT_WORDS}\\s+)?(?:stock|more)?\\s*(?:to|in|into|for)\\s+(?:the\\s+)?(.+?)(?:\\s+stock)?$`),
      (m) => ({ mode: "add", qty: m[1], name: m[2] }),
    ],
    // received 24 maggi · add 24 maggi to stock · restock maggi 24
    [
      new RegExp(`^(?:received|receive|got|restock|restocked|stock in|aaya|aaye)\\s+${QTY}\\s+(?:${UNIT_WORDS}\\s+)?(?:of\\s+)?(.+?)(?:\\s+(?:to|in|into)\\s+(?:the\\s+)?(?:stock|inventory))?(?:\\s+stock)?$`),
      (m) => ({ mode: "add", qty: m[1], name: m[2] }),
    ],
    // add 24 maggi to stock
    [
      new RegExp(`^add\\s+${QTY}\\s+(?:${UNIT_WORDS}\\s+)?(?:of\\s+)?(.+?)\\s+(?:to|in|into)\\s+(?:the\\s+)?(?:stock|inventory)$`),
      (m) => ({ mode: "add", qty: m[1], name: m[2] }),
    ],
    [
      new RegExp(`^(?:restock|add stock(?: of| for| to)?)\\s+(.+?)\\s+(?:by\\s+)?${QTY}(?:\\s+${UNIT_WORDS})?$`),
      (m) => ({ mode: "add", name: m[1], qty: m[2] }),
    ],
    // maggi 10 add (karo) · maggi 2 kam (karo)
    [
      new RegExp(`^(.+?)\\s+${QTY}\\s+(?:${UNIT_WORDS}\\s+)?(?:stock\\s+)?(?:add|jodo|plus|aaya|aaye|badhao)$`),
      (m) => ({ mode: "add", name: m[1], qty: m[2] }),
    ],
    [
      new RegExp(`^(.+?)\\s+${QTY}\\s+(?:${UNIT_WORDS}\\s+)?(?:stock\\s+)?(?:kam|minus|ghatao|reduce)$`),
      (m) => ({ mode: "reduce", name: m[1], qty: m[2] }),
    ],
    // reduce maggi stock by 5 · reduce maggi by 5
    [
      new RegExp(`^(?:reduce|decrease|lower|minus|deduct)\\s+(?:the\\s+)?(?:stock\\s+of\\s+)?(.+?)(?:\\s+stock)?\\s+by\\s+${QTY}(?:\\s+${UNIT_WORDS})?$`),
      (m) => ({ mode: "reduce", name: m[1], qty: m[2] }),
    ],
    // remove 5 maggi from stock · 3 maggi damaged
    [
      new RegExp(`^(?:remove|reduce|deduct|minus|take out|write off)\\s+${QTY}\\s+(?:${UNIT_WORDS}\\s+)?(?:of\\s+)?(.+?)(?:\\s+(?:from|in)\\s+(?:the\\s+)?(?:stock|inventory))?(?:\\s+stock)?$`),
      (m) => ({ mode: "reduce", qty: m[1], name: m[2] }),
    ],
    [
      new RegExp(`^${QTY}\\s+(?:${UNIT_WORDS}\\s+)?(?:of\\s+)?(.+?)\\s+(?:damaged|broken|expired|wasted|lost|kharab)$`),
      (m) => ({ mode: "reduce", qty: m[1], name: m[2] }),
    ],
  ];

  for (const [pattern, read] of tryPatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const parsed = read(match);
    const quantity = readNumber(parsed.qty);
    if (quantity === null || !Number.isInteger(quantity) || quantity < 0) continue;
    if (parsed.mode !== "adjust" && quantity === 0) return { text: "That's a change of zero — nothing to do." };

    const found = findProduct(parsed.name, ctx, (option) => text.replace(parsed.name, foldName(option)));
    if (found.reply) return found.reply;
    const product = found.product!;
    const before = product.trackStock ? product.stock : 0;
    const after = parsed.mode === "add" ? before + quantity : parsed.mode === "reduce" ? before - quantity : quantity;

    const verb = parsed.mode === "add" ? `Add ${quantity}` : parsed.mode === "reduce" ? `Remove ${quantity}` : `Set to ${quantity}`;
    return {
      text: `${verb} — ${product.name}?`,
      proposal: {
        action: { kind: "stock", productId: product.id, mode: parsed.mode, quantity },
        title: `Stock: ${product.name}`,
        details: [
          `${before} → ${after}${product.unit ? ` ${product.unit}` : ""}`,
          ...(product.trackStock ? [] : ["Stock tracking will be switched on for this product."]),
          ...(after < 0 ? ["Stock will go below zero."] : []),
          "Logged in the product's stock history as “via assistant”.",
        ],
        confirmLabel: "Update stock",
      },
    };
  }
  return null;
}

function saleAction(text: string, ctx: Ctx): AgentReply | null {
  const verb = text.match(/^(?:sell|sold|bill|becho|bech do|record (?:a )?sale(?: of)?|ring up|make (?:a )?bill(?: of| for)?|new sale(?: of)?)\s+(.+)$/);
  if (!verb) return null;
  let rest = ` ${verb[1]} `;

  // Payment: "by upi", "in cash", "on credit", "udhaar".
  let paymentMethod: PaymentMethod | null = null;
  let creditSale = false;
  if (/\s(?:on\s+)?(?:credit|udhaar|udhar|khata)\s/.test(rest)) {
    creditSale = true;
    rest = rest.replace(/\s(?:by|via|in|on|as|through|with)?\s*(?:credit|udhaar|udhar|khata)\s/, " ");
  } else {
    for (const method of [...ctx.data.payments].sort((a, b) => b.name.length - a.name.length)) {
      const name = foldName(method.name);
      const pattern = new RegExp(`\\s(?:by|via|in|on|through|with|paid|pay|payment)?\\s*(?:by\\s+)?${name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}\\s`);
      if (pattern.test(rest)) {
        paymentMethod = method;
        rest = rest.replace(pattern, " ");
        break;
      }
    }
  }

  // Customer: "to Ramesh", "for customer Ramesh".
  let customer: Customer | null = null;
  const customerMatch = rest.match(/\s(?:to|for)\s+(?:customer\s+)?([a-z][a-z ]*?)\s*$/);
  if (customerMatch) {
    const found = matchByName(customerMatch[1], ctx.data.customers, (c) => [c.name]);
    if (found.kind === "found") {
      customer = found.item;
      rest = rest.slice(0, customerMatch.index);
    } else if (found.kind === "ambiguous") {
      return {
        text: `Which customer — ${found.options.map((c) => c.name).join(" or ")}?`,
        suggestions: found.options.map((c) => text.replace(customerMatch[1].trim(), foldName(c.name))),
      };
    }
  }

  if (creditSale) {
    if (!isToolEnabled(ctx.data.settings.connectedTools, "customer-ledger")) {
      return {
        text: "Credit (Udhaar) sales need Customer Ledger switched on in Settings → Connected tools.",
        link: { screen: "settings", label: "Open Settings" },
      };
    }
    if (!customer) {
      return { text: "Credit sales need a saved customer. Say who it's for, e.g. “sell 2 Maggi on credit to Ramesh”." };
    }
  }

  // Items: "2 maggi and 1 coke", "maggi x2, coke".
  const read = readLines(rest, ctx, text);
  if ("reply" in read) return read.reply;
  const { lines } = read;

  if (!creditSale && !paymentMethod) {
    paymentMethod = ctx.data.payments.find((p) => foldName(p.name) === "cash") ?? ctx.data.payments[0] ?? null;
    if (!paymentMethod) {
      return { text: "Add a payment method in Settings first.", link: { screen: "settings", label: "Open Settings" } };
    }
  }

  const totals = calculateCartTotals(lines, "flat", 0, ctx.data.settings.taxEnabled);
  const shortStock = lines.filter((line) => {
    const product = ctx.data.products.find((p) => p.id === line.productId);
    return product?.trackStock && line.quantity > product.stock;
  });

  return {
    text: "Here's the bill. Confirm to record it.",
    proposal: {
      action: {
        kind: "sale",
        lines,
        paymentMethodId: paymentMethod?.id ?? "",
        creditSale,
        customerId: customer?.id ?? null,
      },
      title: `New sale · ${formatMoney(totals.total, ctx.currency)}`,
      details: [
        ...lines.map((line) => `${line.quantity} × ${line.name} — ${formatMoney(line.price * line.quantity, ctx.currency)}`),
        ...(totals.taxAmount > 0 ? [`Tax ${formatMoney(totals.taxAmount, ctx.currency)}`] : []),
        `Payment: ${creditSale ? "Credit (Udhaar)" : paymentMethod!.name}${customer ? ` · ${customer.name}` : " · Walk-in"}`,
        ...shortStock.map((line) => `Only ${ctx.data.products.find((p) => p.id === line.productId)?.stock ?? 0} ${line.name} in stock.`),
      ],
      confirmLabel: `Charge ${formatMoney(totals.total, ctx.currency)}`,
    },
  };
}

/** Read "2 maggi and 1 coke" into cart lines, or the reply that asks / says what's missing. */
function readLines(rest: string, ctx: Ctx, text: string): { lines: CartLine[] } | { reply: AgentReply } {
  const parts = rest
    .split(/,|\band\b|\baur\b|\+|&/)
    .map((part) => part.trim())
    .filter(Boolean);
  if (parts.length === 0) return { reply: { text: "Which products? For example: “2 Maggi and 1 Coke”." } };

  const lines: CartLine[] = [];
  const missing: string[] = [];
  for (const part of parts) {
    const item = readItem(part);
    if (!item) {
      missing.push(part);
      continue;
    }
    const found = findProduct(item.name, ctx, (option) => text.replace(item.name, foldName(option)));
    if (found.reply) {
      if (found.ambiguous) return { reply: found.reply };
      missing.push(item.name);
      continue;
    }
    const product = found.product!;
    const existing = lines.find((line) => line.productId === product.id);
    if (existing) {
      existing.quantity += item.qty;
      continue;
    }
    lines.push({
      productId: product.id,
      name: product.name,
      price: product.sellingPrice,
      quantity: item.qty,
      unit: product.unit,
      taxRate: ctx.data.settings.taxEnabled ? product.taxRate ?? ctx.data.settings.defaultTaxRate : 0,
      taxInclusive: product.taxInclusive ?? false,
    });
  }

  if (missing.length > 0) {
    return {
      reply: {
        text: `I couldn't find ${missing.map((m) => `“${m}”`).join(", ")} in your products.`,
        link: { screen: "products", label: "Open Products" },
        suggestions: missing.length === 1 ? [`new product ${titleCase(missing[0])}`] : undefined,
      },
    };
  }
  return { lines };
}

/** "2 maggi", "maggi x2", "maggi 2", "two maggi", "maggi" → quantity and name. */
function readItem(part: string): { qty: number; name: string } | null {
  const words = part.split(" ").filter((w) => !new RegExp(`^${UNIT_WORDS}$`).test(w) && w !== "of");
  if (words.length === 0) return null;

  let qty: number | null = null;
  if (words.length > 1 && (words[0] === "a" || words[0] === "an")) {
    words.shift();
    qty = 1;
  }
  const first = words[0].replace(/^x/, "");
  const last = words[words.length - 1].replace(/^x|x$/g, "");
  if (qty === null && words.length > 1 && readNumber(first) !== null && /^(\d+|[a-z]+)$/.test(first)) {
    qty = readNumber(first);
    words.shift();
  } else if (qty === null && words.length > 1 && /^\d+$/.test(last)) {
    qty = Number(last);
    words.pop();
  }
  if (words[words.length - 1] === "x") words.pop();
  const name = words.join(" ").trim();
  if (!name) return null;
  qty = qty ?? 1;
  if (!Number.isInteger(qty) || qty <= 0) return null;
  return { qty, name };
}

type ProductLookup =
  | { product: Product; reply?: undefined; ambiguous?: undefined }
  | { product?: undefined; reply: AgentReply; ambiguous: boolean };

/** Find a product, or the reply that asks which one / says it's missing. */
function findProduct(phrase: string, ctx: Ctx, rewrite: (optionName: string) => string): ProductLookup {
  const cleaned = phrase.replace(/^(the|my)\s+/, "").trim();
  const exactCode = ctx.data.products.find(
    (p) => (p.sku && foldName(p.sku) === foldName(cleaned)) || (p.barcode && p.barcode === cleaned)
  );
  if (exactCode) return { product: exactCode };

  const match = matchByName(cleaned, ctx.data.products, (p) => [p.name, p.sku]);
  if (match.kind === "found") return { product: match.item };
  if (match.kind === "ambiguous") {
    return {
      ambiguous: true,
      reply: {
        text: `Which one did you mean?`,
        bullets: match.options.map((p) => `${p.name} — ${formatMoney(p.sellingPrice, ctx.currency)}`),
        suggestions: match.options.map((p) => rewrite(p.name)),
      },
    };
  }
  return {
    ambiguous: false,
    reply: {
      text: `I couldn't find a product called “${cleaned}”.`,
      link: { screen: "products", query: cleaned, label: "Search Products" },
    },
  };
}

// ---------------------------------------------------------------------------
// Questions about the shop's own data
// ---------------------------------------------------------------------------

export type Period = { label: string; start: Date; end: Date };

function queryReply(text: string, ctx: Ctx): AgentReply | null {
  return (
    insightsReply(text, ctx.data, ctx.now) ??
    orderLookup(text, ctx) ??
    lowStockQuery(text, ctx) ??
    topProductsQuery(text, ctx) ??
    profitQuery(text, ctx) ??
    productSoldQuery(text, ctx) ??
    salesQuery(text, ctx) ??
    lastSaleQuery(text, ctx) ??
    countQuery(text, ctx) ??
    stockOrPriceQuery(text, ctx) ??
    customerQuery(text, ctx)
  );
}

export function readPeriod(text: string, now: Date): Period | null {
  const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const today = startOfDay(now);
  const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
  const tomorrow = addDays(today, 1);

  if (/\b(yesterday|kal|kal ki|kal ka)\b/.test(text)) return { label: "yesterday", start: addDays(today, -1), end: today };
  if (/\b(last|past|pichle)\s+(7|seven)\s+days\b/.test(text)) return { label: "in the last 7 days", start: addDays(today, -6), end: tomorrow };
  if (/\b(last|previous|pichle|pichla)\s+(week|hafte|hafta)\b/.test(text)) {
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    return { label: "last week", start: addDays(monday, -7), end: monday };
  }
  if (/\b(this week|is hafte|weekly|week)\b/.test(text)) {
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    return { label: "this week", start: monday, end: tomorrow };
  }
  if (/\b(last|previous|pichle|pichla)\s+(month|mahine|mahina)\b/.test(text)) {
    return {
      label: "last month",
      start: new Date(today.getFullYear(), today.getMonth() - 1, 1),
      end: new Date(today.getFullYear(), today.getMonth(), 1),
    };
  }
  if (/\b(this month|is mahine|monthly|month|mahine)\b/.test(text)) {
    return { label: "this month", start: new Date(today.getFullYear(), today.getMonth(), 1), end: tomorrow };
  }
  if (/\b(this year|is saal|year|saal)\b/.test(text)) {
    return { label: "this year", start: new Date(today.getFullYear(), 0, 1), end: tomorrow };
  }
  if (/\b(all time|ever|total|overall|till now|ab tak|lifetime)\b/.test(text)) {
    return { label: "in total", start: new Date(0), end: tomorrow };
  }
  if (/\b(today|todays|aaj|aj|aaj ki|aaj ka|so far)\b/.test(text)) return { label: "today", start: today, end: tomorrow };
  return null;
}

function inPeriod(order: Order, period: Period): boolean {
  const t = new Date(order.date).getTime();
  return order.status === "completed" && t >= period.start.getTime() && t < period.end.getTime();
}

const SALES_WORDS = ["sale", "sales", "sold", "revenue", "earning", "earnings", "earned", "kamai", "bikri", "collection", "turnover", "galla", "business", "income", "sell", "made", "make", "kamaya", "kamai"];

function salesQuery(text: string, ctx: Ctx): AgentReply | null {
  const period = readPeriod(text, ctx.now);
  const mentionsSales = hasAny(text, SALES_WORDS) || /\bhow much (did|have) i (sell|make|earn)/.test(text);
  if (!mentionsSales) return null;
  if (!period && !/^(sales|total sales|my sales|how much|kitni sale|kitna)\b/.test(text)) return null;
  const p = period ?? readPeriod("today", ctx.now)!;

  const orders = ctx.data.orders.filter((o) => inPeriod(o, p));
  const total = orders.reduce((sum, o) => sum + o.total, 0);
  if (orders.length === 0) {
    return { text: `No sales ${p.label} yet.`, suggestions: ["Sales this month", "Sell 1 item by cash"] };
  }

  const byMethod = new Map<string, number>();
  for (const o of orders) byMethod.set(o.paymentMethodName, (byMethod.get(o.paymentMethodName) ?? 0) + o.total);
  const split = [...byMethod.entries()].sort((a, b) => b[1] - a[1]);
  const discounts = orders.reduce((sum, o) => sum + o.discountAmount, 0);
  const tax = orders.reduce((sum, o) => sum + o.taxAmount + o.includedTaxAmount, 0);

  return {
    text: `${capitalise(p.label)}: ${formatMoney(total, ctx.currency)} from ${orders.length} bill${orders.length === 1 ? "" : "s"}.`,
    bullets: [
      `Average bill ${formatMoney(total / orders.length, ctx.currency)}`,
      ...split.map(([name, amount]) => `${name}: ${formatMoney(amount, ctx.currency)}`),
      ...(discounts > 0 ? [`Discounts given: ${formatMoney(discounts, ctx.currency)}`] : []),
      ...(tax > 0 ? [`Tax collected: ${formatMoney(tax, ctx.currency)}`] : []),
    ],
    link: { screen: "reports", label: "Open Reports" },
    suggestions: [`Top products ${p.label === "today" ? "today" : p.label.replace(/^in /, "")}`, `Profit ${p.label.replace(/^in /, "")}`],
  };
}

function itemsInPeriod(ctx: Ctx, period: Period): OrderItem[] {
  const ids = new Set(ctx.data.orders.filter((o) => inPeriod(o, period)).map((o) => o.id));
  return ctx.data.orderItems.filter((item) => ids.has(item.orderId));
}

function topProductsQuery(text: string, ctx: Ctx): AgentReply | null {
  if (!/\b(top|best|most|bestsellers?|best sellers?|popular|zyada|sabse)\b/.test(text)) return null;
  if (!/\b(product|products|item|items|selling|seller|sellers|sold|bik|bikne|bikta|sell)\b/.test(text)) return null;
  const period = readPeriod(text, ctx.now) ?? readPeriod("this month", ctx.now)!;
  const totals = new Map<string, { name: string; qty: number; amount: number }>();
  for (const item of itemsInPeriod(ctx, period)) {
    const key = item.productId ?? item.name;
    const entry = totals.get(key) ?? { name: item.name, qty: 0, amount: 0 };
    entry.qty += item.quantity;
    entry.amount += item.lineSubtotal;
    totals.set(key, entry);
  }
  const ranked = [...totals.values()].sort((a, b) => b.qty - a.qty || b.amount - a.amount).slice(0, 5);
  if (ranked.length === 0) return { text: `Nothing sold ${period.label} yet.` };
  return {
    text: `Top sellers ${period.label}:`,
    bullets: ranked.map((r, i) => `${i + 1}. ${r.name} — ${r.qty} sold, ${formatMoney(r.amount, ctx.currency)}`),
    link: { screen: "reports", label: "Open Reports" },
  };
}

function profitQuery(text: string, ctx: Ctx): AgentReply | null {
  if (!/\b(profit|margin|munafa|fayda)\b/.test(text)) return null;
  const period = readPeriod(text, ctx.now) ?? readPeriod("today", ctx.now)!;
  const items = itemsInPeriod(ctx, period);
  if (items.length === 0) return { text: `No sales ${period.label}, so no profit to show yet.` };

  const products = new Map(ctx.data.products.map((p) => [p.id, p]));
  let revenue = 0;
  let cost = 0;
  let uncosted = 0;
  for (const item of items) {
    const product = item.productId ? products.get(item.productId) : undefined;
    if (!product || product.costPrice === null) {
      uncosted += 1;
      continue;
    }
    revenue += item.lineSubtotal;
    cost += product.costPrice * item.quantity;
  }
  if (revenue === 0) {
    return {
      text: "I can't work out profit yet — none of the products sold have a cost price.",
      bullets: ["Add cost prices on Products, and I'll show gross profit from then on."],
      link: { screen: "products", label: "Open Products" },
    };
  }
  const gross = revenue - cost;
  return {
    text: `Gross profit ${period.label}: about ${formatMoney(gross, ctx.currency)} (${Math.round((gross / revenue) * 100)}% margin).`,
    bullets: [
      `Item sales ${formatMoney(revenue, ctx.currency)} − cost ${formatMoney(cost, ctx.currency)}, before bill discounts.`,
      "Uses each product's current cost price.",
      ...(uncosted > 0 ? [`${uncosted} sold line${uncosted === 1 ? "" : "s"} had no cost price and ${uncosted === 1 ? "is" : "are"} left out.`] : []),
      "For profit after expenses, use the Profit Dashboard tool.",
    ],
  };
}

function productSoldQuery(text: string, ctx: Ctx): AgentReply | null {
  const match = text.match(/^how many\s+(.+?)\s+(?:did i sell|have i sold|were sold|sold|got sold|bike|bika)\b/) ??
    text.match(/^(.+?)\s+(?:kitne|kitna|kitni)\s+(?:bike|bika|biki|sold)\b/);
  if (!match) return null;
  const found = findProduct(match[1], ctx, (name) => text.replace(match[1], foldName(name)));
  if (found.reply) return found.reply;
  const product = found.product!;
  const period = readPeriod(text, ctx.now) ?? readPeriod("today", ctx.now)!;
  const sold = itemsInPeriod(ctx, period).filter((item) => item.productId === product.id);
  const qty = sold.reduce((sum, item) => sum + item.quantity, 0);
  const amount = sold.reduce((sum, item) => sum + item.lineSubtotal, 0);
  return {
    text: qty === 0
      ? `No ${product.name} sold ${period.label}.`
      : `${qty} ${product.name} sold ${period.label}, worth ${formatMoney(amount, ctx.currency)}.`,
    bullets: product.trackStock ? [`${product.stock} left in stock.`] : undefined,
  };
}

function lowStockQuery(text: string, ctx: Ctx): AgentReply | null {
  const out = /\b(out of stock|finished|khatam ho gaya|khatam ho gaye|zero stock|no stock)\b/.test(text);
  const low = /\b(low|running out|running low|khatam|reorder|restock|order more|kam hai|kam ho)\b/.test(text);
  if (!out && !low) return null;
  if (!/\b(stock|items?|products?|what|which|kya|kaun|list|show|maal)\b/.test(text) && !out) return null;

  const tracked = ctx.data.products.filter((p) => p.trackStock);
  if (tracked.length === 0) {
    return {
      text: "None of your products track stock yet.",
      bullets: ["Turn on Track stock on a product to get low-stock alerts."],
      link: { screen: "products", label: "Open Products" },
    };
  }
  const outItems = tracked.filter(isOutOfStock);
  const lowItems = out ? [] : tracked.filter(isLowStock);
  const list = [...outItems, ...lowItems];
  if (list.length === 0) {
    return { text: out ? "Nothing is out of stock." : "All good — nothing is running low." };
  }
  return {
    text: out ? `${outItems.length} product${outItems.length === 1 ? " is" : "s are"} out of stock:` : `${list.length} product${list.length === 1 ? " needs" : "s need"} restocking:`,
    bullets: list.slice(0, 12).map((p) => `${p.name} — ${p.stock <= 0 ? "out of stock" : `${p.stock} left`}`).concat(list.length > 12 ? [`…and ${list.length - 12} more`] : []),
    link: { screen: "products", label: "Open Products" },
    suggestions: list[0] ? [`add 10 stock to ${list[0].name}`] : undefined,
  };
}

function lastSaleQuery(text: string, ctx: Ctx): AgentReply | null {
  if (!/\b(last|latest|recent|previous|pichla|pichli)\s+(sale|sales|bill|bills|order|orders|invoice|invoices)\b/.test(text)) return null;
  const recent = [...ctx.data.orders].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5);
  if (recent.length === 0) return { text: "No sales recorded yet." };
  return {
    text: "Most recent bills:",
    bullets: recent.map((o) => `${o.invoiceNumber} · ${formatDateTime(o.date)} · ${formatMoney(o.total, ctx.currency)} · ${o.customerName || "Walk-in"}${o.status === "cancelled" ? " (cancelled)" : ""}`),
    link: { screen: "orders", label: "Open Orders" },
  };
}

function orderLookup(text: string, ctx: Ctx): AgentReply | null {
  const tokenMatch = text.match(/\b([a-z]{1,8}-?\d{2,})\b/);
  if (!tokenMatch) return null;
  const order = ctx.data.orders.find((o) => o.invoiceNumber.toLowerCase() === tokenMatch[1]);
  if (!order) return null;
  const items = ctx.data.orderItems.filter((item) => item.orderId === order.id);
  return {
    text: `${order.invoiceNumber} — ${formatMoney(order.total, ctx.currency)}${order.status === "cancelled" ? " (cancelled)" : ""}`,
    bullets: [
      `${formatDateTime(order.date)} · ${order.customerName || "Walk-in"} · ${order.paymentMethodName}`,
      ...items.map((item) => `${item.quantity} × ${item.name} — ${formatMoney(item.lineSubtotal, ctx.currency)}`),
    ],
    link: { screen: "orders", query: order.invoiceNumber, label: "Show in Orders" },
    suggestions: order.status === "completed" ? [`cancel ${order.invoiceNumber}`] : undefined,
  };
}

function countQuery(text: string, ctx: Ctx): AgentReply | null {
  const match = text.match(/^(?:how many|kitne|number of|total)\s+(products|items|customers|orders|bills|categories)\b/) ??
    text.match(/^(products|items|customers|orders|bills)\s+(?:kitne|kitni|count)\b/);
  if (!match) return null;
  const what = match[1];
  if (what === "products" || what === "items") {
    const tracked = ctx.data.products.filter((p) => p.trackStock).length;
    return { text: `You have ${ctx.data.products.length} products (${tracked} tracking stock).` };
  }
  if (what === "customers") return { text: `You have ${ctx.data.customers.length} saved customers.` };
  if (what === "orders" || what === "bills") {
    const period = readPeriod(text, ctx.now);
    const orders = ctx.data.orders.filter((o) => (period ? inPeriod(o, period) : o.status === "completed"));
    return { text: `${orders.length} completed bill${orders.length === 1 ? "" : "s"} ${period?.label ?? "in total"}.` };
  }
  return null;
}

function stockOrPriceQuery(text: string, ctx: Ctx): AgentReply | null {
  const stockPatterns = [
    /^(?:what is |whats )?(?:the )?(?:stock|quantity|inventory|count)\s+(?:of|for)\s+(.+)$/,
    /^how (?:many|much)\s+(.+?)\s+(?:do i have|is left|are left|left|in stock|remaining|bacha|bache)$/,
    /^(?:is|are) (?:there )?(?:any )?(.+?)\s+(?:in stock|available|left)$/,
    /^(?:kitna|kitne|kitni)\s+(?:stock|maal)\s+(?:hai\s+|bacha\s+)?(.+)$/,
    /^(.+?)\s+(?:stock|kitna bacha|kitne bache|kitna hai stock|stock kitna|stock kitna hai|left|in stock)$/,
  ];
  for (const pattern of stockPatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const found = findProduct(match[1], ctx, (name) => text.replace(match[1], foldName(name)));
    if (found.reply) return found.ambiguous ? found.reply : null;
    const p = found.product!;
    if (!p.trackStock) {
      return { text: `${p.name} doesn't track stock.`, link: { screen: "products", query: p.name, label: "Open product" } };
    }
    return {
      text: `${p.name}: ${p.stock}${p.unit ? ` ${p.unit}` : ""} in stock${isOutOfStock(p) ? " — out of stock" : isLowStock(p) ? " — running low" : ""}.`,
      suggestions: [`add 10 stock to ${p.name}`],
    };
  }

  const pricePatterns = [
    /^(?:what is |whats )?(?:the )?(?:price|rate|mrp|cost)\s+(?:of|for)\s+(.+)$/,
    /^how much (?:is|does|for)\s+(?:a |an |one )?(.+?)(?:\s+cost)?$/,
    /^(.+?)\s+(?:ka\s+)?(?:price|rate|daam|kitne ka|kitne ki|mrp)(?:\s+kya hai)?$/,
  ];
  for (const pattern of pricePatterns) {
    const match = text.match(pattern);
    if (!match) continue;
    const found = findProduct(match[1], ctx, (name) => text.replace(match[1], foldName(name)));
    if (found.reply) return found.ambiguous ? found.reply : null;
    const p = found.product!;
    return {
      text: `${p.name} sells at ${formatMoney(p.sellingPrice, ctx.currency)}${p.taxInclusive ? " (tax included)" : ""}.`,
      bullets: p.costPrice !== null ? [`Cost ${formatMoney(p.costPrice, ctx.currency)} — margin ${formatMoney(p.sellingPrice - p.costPrice, ctx.currency)} each`] : undefined,
    };
  }
  return null;
}

function customerQuery(text: string, ctx: Ctx): AgentReply | null {
  const match = text.match(/^(?:what is |whats )?(?:the )?(?:phone|number|mobile|contact)\s+(?:of|for)\s+(.+)$/) ??
    text.match(/^(?:customer|show customer|find customer)\s+(.+)$/) ??
    text.match(/^(.+?)(?:s)?\s+(?:phone|number|mobile|ka number)$/) ??
    text.match(/^how much (?:has|did)\s+(.+?)\s+(?:spent|spend|bought|buy)/);
  if (!match) return null;
  const found = matchByName(match[1], ctx.data.customers, (c) => [c.name, c.phone]);
  if (found.kind === "none") return null;
  if (found.kind === "ambiguous") {
    return { text: "Which customer?", suggestions: found.options.map((c) => `customer ${c.name}`) };
  }
  const c = found.item;
  const orders = ctx.data.orders.filter((o) => o.customerId === c.id && o.status === "completed");
  const spent = orders.reduce((sum, o) => sum + o.total, 0);
  const last = orders.sort((a, b) => b.date.localeCompare(a.date))[0];
  return {
    text: c.name,
    bullets: [
      `Phone: ${c.phone || "—"}`,
      `${orders.length} bill${orders.length === 1 ? "" : "s"}, ${formatMoney(spent, ctx.currency)} in total`,
      ...(last ? [`Last visit ${formatDateTime(last.date)}`] : []),
    ],
    link: { screen: "customers", query: c.name, label: "Show customer" },
  };
}

// ---------------------------------------------------------------------------
// Navigation
// ---------------------------------------------------------------------------

const SCREEN_WORDS: [RegExp, ScreenId][] = [
  [/^(dashboard|home)$/, "dashboard"],
  [/^(new sale|sale|sell|billing|bill|checkout|counter)$/, "sell"],
  [/^(products?|items?|inventory|stock)$/, "products"],
  [/^(orders?|bills|invoices|sales history)$/, "orders"],
  [/^(customers?|grahak)$/, "customers"],
  [/^(reports?|analytics)$/, "reports"],
  [/^(settings?|setup|preferences)$/, "settings"],
];

function navigationReply(text: string): AgentReply | null {
  const match = text.match(/^(?:open|go to|goto|show me|show|take me to|switch to|kholo)\s+(?:the\s+)?(.+?)(?:\s+(?:screen|page|tab|section))?$/) ??
    text.match(/^(.+?)\s+(?:kholo|khol do|screen|page)$/);
  if (!match) return null;
  for (const [pattern, screen] of SCREEN_WORDS) {
    if (pattern.test(match[1])) {
      return { text: `Opening ${screenLabel(screen)}.`, navigate: { screen } };
    }
  }
  return null;
}

export function screenLabel(screen: ScreenId): string {
  const labels: Record<ScreenId, string> = {
    dashboard: "Dashboard",
    sell: "New Sale",
    products: "Products",
    orders: "Orders",
    customers: "Customers",
    reports: "Reports",
    settings: "Settings",
  };
  return labels[screen];
}

// ---------------------------------------------------------------------------
// Small formatting helpers
// ---------------------------------------------------------------------------

function titleCase(text: string): string {
  return text
    .split(" ")
    .filter(Boolean)
    .map((word) => (/\d/.test(word) ? word : word.charAt(0).toUpperCase() + word.slice(1)))
    .join(" ");
}

function capitalise(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("en-IN", { day: "numeric", month: "short", hour: "numeric", minute: "2-digit" });
}

// Exposed for tests.
export const __test = { readItem, readPeriod, nameScore };
