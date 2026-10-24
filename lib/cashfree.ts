import "server-only";

import { createHmac, createHash, randomBytes, timingSafeEqual } from "node:crypto";
import type { QrMenuOrder } from "@/lib/qrMenuOrders";

// ---------------------------------------------------------------------------
// Cashfree Payment Gateway, PG API version 2023-08-01.
//
//   CASHFREE_APP_ID       x-client-id from the Cashfree dashboard
//   CASHFREE_SECRET_KEY   x-client-secret; also signs webhooks
//   CASHFREE_ENV          "production" for live payments, anything else is sandbox
//
// Sandbox and production keys are different pairs, so CASHFREE_ENV has to
// match the keys it is set beside.
// ---------------------------------------------------------------------------

const API_VERSION = "2023-08-01";

export type CashfreeMode = "sandbox" | "production";

export type CashfreeConfig = { appId: string; secretKey: string; mode: CashfreeMode };

export function cashfreeConfig(): CashfreeConfig | null {
  const appId = process.env.CASHFREE_APP_ID;
  const secretKey = process.env.CASHFREE_SECRET_KEY;
  if (!appId || !secretKey) return null;
  return {
    appId,
    secretKey,
    mode: process.env.CASHFREE_ENV === "production" ? "production" : "sandbox",
  };
}

function baseUrl(mode: CashfreeMode): string {
  return mode === "production" ? "https://api.cashfree.com/pg" : "https://sandbox.cashfree.com/pg";
}

/** Order ids are public (they ride on the return URL) so they must be unguessable. */
export function newOrderId(): string {
  return `qrm_${Date.now().toString(36)}_${randomBytes(12).toString("hex")}`;
}

/** Cashfree only allows these characters in an order id. */
export function isOrderId(value: string): boolean {
  return /^[A-Za-z0-9_-]{1,45}$/.test(value);
}

/** A stable customer id that does not put the email address in Cashfree's logs twice. */
export function customerIdFor(email: string): string {
  return `c_${createHash("sha256").update(email.toLowerCase()).digest("hex").slice(0, 32)}`;
}

export type CashfreeOrder = {
  order_id: string;
  order_amount: number;
  order_currency: string;
  /** ACTIVE until paid, then PAID; EXPIRED or TERMINATED if abandoned. */
  order_status: string;
  order_tags?: Record<string, string> | null;
  /** ISO timestamp; the invoice date. */
  created_at?: string;
  payment_session_id?: string;
  customer_details?: { customer_email?: string | null; customer_phone?: string } | null;
};

/** The gateway-neutral view of a Cashfree order. */
export function qrMenuOrderFromCashfree(order: CashfreeOrder): QrMenuOrder {
  const tags = order.order_tags ?? {};
  return {
    provider: "cashfree",
    orderId: order.order_id,
    status:
      order.order_status === "PAID" ? "paid" : order.order_status === "ACTIVE" ? "pending" : "failed",
    amount: order.order_amount,
    currency: order.order_currency,
    createdAt: order.created_at,
    email: order.customer_details?.customer_email,
    phone: order.customer_details?.customer_phone,
    product: tags.product,
    billing: tags.billing,
  };
}

/** A non-2xx answer from Cashfree, keeping its own explanation for the buyer and the logs. */
export class CashfreeError extends Error {
  constructor(
    readonly status: number,
    readonly cashfreeMessage: string,
    context: string
  ) {
    super(`Cashfree ${context} failed (${status}): ${cashfreeMessage}`);
  }
}

async function call<T>(config: CashfreeConfig, path: string, init: RequestInit = {}): Promise<T> {
  const response = await fetch(`${baseUrl(config.mode)}${path}`, {
    ...init,
    headers: {
      "content-type": "application/json",
      "x-api-version": API_VERSION,
      "x-client-id": config.appId,
      "x-client-secret": config.secretKey,
      ...init.headers,
    },
    cache: "no-store",
  });
  const data = (await response.json().catch(() => null)) as T & { message?: string };
  if (!response.ok) {
    throw new CashfreeError(
      response.status,
      data?.message ?? "no message",
      `${init.method ?? "GET"} ${path}`
    );
  }
  return data;
}

export type CreateOrderInput = {
  orderId: string;
  amount: number;
  currency: string;
  customer: { id: string; email: string; phone: string };
  returnUrl: string;
  /** Cashfree only accepts https here, so it is left off in local development. */
  notifyUrl?: string;
  note: string;
  tags: Record<string, string>;
};

export function createOrder(config: CashfreeConfig, input: CreateOrderInput): Promise<CashfreeOrder> {
  return call<CashfreeOrder>(config, "/orders", {
    method: "POST",
    body: JSON.stringify({
      order_id: input.orderId,
      order_amount: input.amount,
      order_currency: input.currency,
      customer_details: {
        customer_id: input.customer.id,
        customer_email: input.customer.email,
        customer_phone: input.customer.phone,
      },
      order_meta: {
        return_url: input.returnUrl,
        ...(input.notifyUrl ? { notify_url: input.notifyUrl } : {}),
      },
      order_note: input.note,
      order_tags: input.tags,
    }),
  });
}

/** Null when Cashfree has no such order. */
export async function getOrder(config: CashfreeConfig, orderId: string): Promise<CashfreeOrder | null> {
  try {
    return await call<CashfreeOrder>(config, `/orders/${encodeURIComponent(orderId)}`);
  } catch (error) {
    if (error instanceof CashfreeError && error.status === 404) return null;
    throw error;
  }
}

/**
 * Webhooks are signed as base64(HMAC-SHA256(timestamp + rawBody, secret key)).
 * The raw body must be the exact bytes received — re-serialised JSON will not
 * match.
 */
export function verifyWebhookSignature(
  secretKey: string,
  timestamp: string | null,
  rawBody: string,
  signature: string | null
): boolean {
  if (!timestamp || !signature) return false;
  const expected = createHmac("sha256", secretKey).update(timestamp + rawBody).digest("base64");
  const a = Buffer.from(expected);
  const b = Buffer.from(signature);
  return a.length === b.length && timingSafeEqual(a, b);
}
