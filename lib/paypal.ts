import "server-only";

import { randomBytes } from "node:crypto";
import type { QrMenuOrder } from "@/lib/qrMenuOrders";

// ---------------------------------------------------------------------------
// PayPal Orders API v2, for buyers outside India.
//
//   PAYPAL_CLIENT_ID      REST app client id from developer.paypal.com
//   PAYPAL_CLIENT_SECRET  that app's secret
//   PAYPAL_ENV            "production" for live payments, anything else is sandbox
//   PAYPAL_WEBHOOK_ID     id of the webhook registered on that app; only the
//                         webhook route needs it
//
// Sandbox and live apps have different credentials, so PAYPAL_ENV has to
// match the pair it is set beside.
//
// Unlike Cashfree, a PayPal order is not paid when the buyer approves it: we
// have to capture it. captureIfApproved() does that, and is called from both
// the return page's status check and the webhook, whichever comes first.
// ---------------------------------------------------------------------------

export type PayPalMode = "sandbox" | "production";

export type PayPalConfig = {
  clientId: string;
  clientSecret: string;
  mode: PayPalMode;
  webhookId: string | null;
};

export function paypalConfig(): PayPalConfig | null {
  const clientId = process.env.PAYPAL_CLIENT_ID;
  const clientSecret = process.env.PAYPAL_CLIENT_SECRET;
  if (!clientId || !clientSecret) return null;
  return {
    clientId,
    clientSecret,
    mode: process.env.PAYPAL_ENV === "production" ? "production" : "sandbox",
    webhookId: process.env.PAYPAL_WEBHOOK_ID || null,
  };
}

function baseUrl(mode: PayPalMode): string {
  return mode === "production" ? "https://api-m.paypal.com" : "https://api-m.sandbox.paypal.com";
}

/** PayPal order ids are short upper-case alphanumerics, e.g. 5O190127TN364715T. */
export function isPayPalOrderId(value: string): boolean {
  return /^[A-Z0-9]{10,36}$/.test(value);
}

// custom_id carries what Cashfree keeps in order_tags. PayPal caps it at 127
// characters, so the buyer's email rides along only when it fits; otherwise
// the PayPal account's own email is used for the key.
const CUSTOM_ID_MAX = 127;

export type PayPalTags = { product: string; billing: string; region: string; email?: string };

export function encodeCustomId(tags: PayPalTags): string {
  const base = `${tags.product}|${tags.billing}|${tags.region}`;
  const full = tags.email ? `${base}|${tags.email}` : base;
  return full.length <= CUSTOM_ID_MAX ? full : base;
}

export function decodeCustomId(value: string | null | undefined): Partial<PayPalTags> {
  if (!value) return {};
  const [product, billing, region, ...rest] = value.split("|");
  // An email can itself contain "|", so everything after the third bar is it.
  const email = rest.join("|");
  return { product, billing, region, ...(email ? { email } : {}) };
}

type Capture = { id: string; status: string; create_time?: string };

export type PayPalOrder = {
  id: string;
  /** CREATED / PAYER_ACTION_REQUIRED until approved, APPROVED, then COMPLETED once captured; VOIDED if abandoned. */
  status: string;
  create_time?: string;
  purchase_units?: {
    custom_id?: string;
    amount?: { currency_code: string; value: string };
    payments?: { captures?: Capture[] };
  }[];
  payer?: { email_address?: string };
  links?: { href: string; rel: string; method?: string }[];
};

/** A non-2xx answer from PayPal, keeping its reason for the buyer and the logs. */
export class PayPalError extends Error {
  constructor(
    readonly status: number,
    /** The first detail's issue code, e.g. INSTRUMENT_DECLINED, else PayPal's error name. */
    readonly issue: string,
    readonly paypalMessage: string,
    context: string
  ) {
    super(`PayPal ${context} failed (${status} ${issue}): ${paypalMessage}`);
  }
}

// Access tokens last about nine hours; one per server instance is plenty.
let cachedToken: { mode: PayPalMode; clientId: string; token: string; expiresAt: number } | null =
  null;

async function accessToken(config: PayPalConfig): Promise<string> {
  if (
    cachedToken &&
    cachedToken.mode === config.mode &&
    cachedToken.clientId === config.clientId &&
    cachedToken.expiresAt > Date.now()
  ) {
    return cachedToken.token;
  }
  const basic = Buffer.from(`${config.clientId}:${config.clientSecret}`).toString("base64");
  const response = await fetch(`${baseUrl(config.mode)}/v1/oauth2/token`, {
    method: "POST",
    headers: {
      authorization: `Basic ${basic}`,
      "content-type": "application/x-www-form-urlencoded",
    },
    body: "grant_type=client_credentials",
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as {
    access_token?: string;
    expires_in?: number;
    error_description?: string;
  } | null;
  if (!response.ok || !data?.access_token) {
    // Usually sandbox credentials with PAYPAL_ENV=production, or the reverse.
    throw new PayPalError(
      response.status,
      "AUTHENTICATION_FAILURE",
      data?.error_description ?? "no access token",
      "POST /v1/oauth2/token"
    );
  }
  cachedToken = {
    mode: config.mode,
    clientId: config.clientId,
    token: data.access_token,
    // Renew a minute early so a token never expires mid-request.
    expiresAt: Date.now() + Math.max(0, (data.expires_in ?? 0) - 60) * 1000,
  };
  return data.access_token;
}

async function call<T>(config: PayPalConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl(config.mode)}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${await accessToken(config)}`,
      ...init.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as T & {
    name?: string;
    message?: string;
    details?: { issue?: string; description?: string }[];
  };
  if (!response.ok) {
    const detail = data?.details?.[0];
    throw new PayPalError(
      response.status,
      detail?.issue ?? data?.name ?? "UNKNOWN",
      detail?.description ?? data?.message ?? "no message",
      `${init.method ?? "GET"} ${path}`
    );
  }
  return data;
}

export type CreatePayPalOrderInput = {
  amount: number;
  currency: string;
  email: string;
  returnUrl: string;
  cancelUrl: string;
  description: string;
  tags: Omit<PayPalTags, "email">;
};

export function createPayPalOrder(
  config: PayPalConfig,
  input: CreatePayPalOrderInput
): Promise<PayPalOrder> {
  return call<PayPalOrder>(config, "/v2/checkout/orders", {
    method: "POST",
    headers: {
      // Makes a retried request create one order, not two.
      "paypal-request-id": `qrm-create-${randomBytes(12).toString("hex")}`,
      prefer: "return=representation",
    },
    body: JSON.stringify({
      intent: "CAPTURE",
      purchase_units: [
        {
          description: input.description,
          custom_id: encodeCustomId({ ...input.tags, email: input.email }),
          amount: { currency_code: input.currency, value: input.amount.toFixed(2) },
        },
      ],
      payment_source: {
        paypal: {
          email_address: input.email,
          experience_context: {
            brand_name: "Setu Technology",
            shipping_preference: "NO_SHIPPING",
            user_action: "PAY_NOW",
            payment_method_preference: "IMMEDIATE_PAYMENT_REQUIRED",
            return_url: input.returnUrl,
            cancel_url: input.cancelUrl,
          },
        },
      },
    }),
  });
}

/** Where to send the buyer to approve the order, checked to be PayPal's own site. */
export function approveUrl(order: PayPalOrder): string | null {
  const link = order.links?.find((l) => l.rel === "payer-action" || l.rel === "approve");
  if (!link) return null;
  try {
    const url = new URL(link.href);
    const host = url.hostname;
    const isPayPal = host === "paypal.com" || host.endsWith(".paypal.com");
    return url.protocol === "https:" && isPayPal ? url.toString() : null;
  } catch {
    return null;
  }
}

/** Null when PayPal has no such order. */
export async function getPayPalOrder(
  config: PayPalConfig,
  orderId: string
): Promise<PayPalOrder | null> {
  try {
    return await call<PayPalOrder>(config, `/v2/checkout/orders/${encodeURIComponent(orderId)}`);
  } catch (error) {
    if (error instanceof PayPalError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Takes the money for an order the buyer has approved, and returns the order
 * as it now stands; any other order comes back unchanged.
 *
 * Safe to call from the webhook and the return page at once: the request id
 * is fixed per order, so PayPal treats a repeat as the same capture, and an
 * ORDER_ALREADY_CAPTURED answer just means the other caller got there first.
 * A declined card leaves the order APPROVED; it is reported as failed so the
 * buyer is sent back to try again rather than left waiting.
 */
export async function captureIfApproved(
  config: PayPalConfig,
  order: PayPalOrder
): Promise<{ order: PayPalOrder; declined: boolean }> {
  if (order.status !== "APPROVED") return { order, declined: false };
  try {
    const captured = await call<PayPalOrder>(
      config,
      `/v2/checkout/orders/${encodeURIComponent(order.id)}/capture`,
      {
        method: "POST",
        headers: { "paypal-request-id": `qrm-capture-${order.id}`, prefer: "return=representation" },
      }
    );
    return { order: captured, declined: false };
  } catch (error) {
    if (!(error instanceof PayPalError) || error.status !== 422) throw error;
    if (error.issue === "ORDER_ALREADY_CAPTURED") {
      return { order: (await getPayPalOrder(config, order.id)) ?? order, declined: false };
    }
    if (error.issue === "INSTRUMENT_DECLINED" || error.issue === "PAYER_ACTION_REQUIRED") {
      return { order, declined: true };
    }
    throw error;
  }
}

/** The gateway-neutral view of a PayPal order. */
export function qrMenuOrderFromPayPal(order: PayPalOrder, declined = false): QrMenuOrder {
  const unit = order.purchase_units?.[0];
  const tags = decodeCustomId(unit?.custom_id);
  const capture = unit?.payments?.captures?.[0];

  let status: QrMenuOrder["status"];
  if (order.status === "COMPLETED") {
    // A completed order can still hold a capture PayPal is reviewing (PENDING)
    // or one that bounced; only a completed capture is money received.
    status =
      capture?.status === "COMPLETED" ? "paid" : capture?.status === "PENDING" ? "pending" : "failed";
  } else if (order.status === "VOIDED" || declined) {
    status = "failed";
  } else {
    status = "pending";
  }

  return {
    provider: "paypal",
    orderId: order.id,
    status,
    amount: Number(unit?.amount?.value ?? 0),
    currency: unit?.amount?.currency_code ?? "USD",
    createdAt: order.create_time,
    email: tags.email ?? order.payer?.email_address ?? null,
    product: tags.product,
    billing: tags.billing,
  };
}

/**
 * Asks PayPal whether a webhook really came from it. PayPal checks the
 * signature against the event as we send it back, parsed from the raw body.
 */
export async function verifyPayPalWebhook(
  config: PayPalConfig,
  headers: Headers,
  rawBody: string
): Promise<boolean> {
  if (!config.webhookId) return false;
  const header = (name: string) => headers.get(name);
  const required = [
    "paypal-auth-algo",
    "paypal-cert-url",
    "paypal-transmission-id",
    "paypal-transmission-sig",
    "paypal-transmission-time",
  ];
  if (required.some((name) => !header(name))) return false;
  let event: unknown;
  try {
    event = JSON.parse(rawBody);
  } catch {
    return false;
  }
  const result = await call<{ verification_status?: string }>(
    config,
    "/v1/notifications/verify-webhook-signature",
    {
      method: "POST",
      body: JSON.stringify({
        auth_algo: header("paypal-auth-algo"),
        cert_url: header("paypal-cert-url"),
        transmission_id: header("paypal-transmission-id"),
        transmission_sig: header("paypal-transmission-sig"),
        transmission_time: header("paypal-transmission-time"),
        webhook_id: config.webhookId,
        webhook_event: event,
      }),
    }
  );
  return result.verification_status === "SUCCESS";
}
