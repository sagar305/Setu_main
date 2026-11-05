import { describe, expect, it } from "vitest";
import {
  checkSplit,
  isUpiMethod,
  looksLikeUpiId,
  orderPaymentParts,
  splitLabel,
  toOrderPayments,
  upiAmountForOrder,
  upiPaymentLink,
} from "@/lib/pos/payments";
import type { PaymentMethod } from "@/lib/pos/types";

const m = (id: string, name: string): PaymentMethod => ({
  id,
  name,
  isDefault: true,
  createdAt: "2026-01-01T00:00:00.000Z",
});
const methods = [m("cash", "Cash"), m("upi", "UPI"), m("card", "Card")];

describe("checkSplit", () => {
  it("accepts parts that add up to the total", () => {
    const r = checkSplit(
      [
        { methodId: "cash", amount: 200 },
        { methodId: "upi", amount: 43 },
      ],
      243,
      methods
    );
    expect(r).toMatchObject({ ok: true, paid: 243, remaining: 0 });
  });

  it("handles paise without float drift", () => {
    const r = checkSplit(
      [
        { methodId: "cash", amount: 0.1 },
        { methodId: "upi", amount: 0.2 },
      ],
      0.3,
      methods
    );
    expect(r.ok).toBe(true);
  });

  it("rejects short, over, zero and unknown parts", () => {
    expect(checkSplit([{ methodId: "cash", amount: 243 }], 243, methods).ok).toBe(false);
    expect(
      checkSplit([{ methodId: "cash", amount: 200 }, { methodId: "upi", amount: 40 }], 243, methods)
    ).toMatchObject({ ok: false, remaining: 3 });
    expect(
      checkSplit([{ methodId: "cash", amount: 250 }, { methodId: "upi", amount: -7 }], 243, methods)
        .ok
    ).toBe(false);
    expect(
      checkSplit([{ methodId: "cash", amount: 243 }, { methodId: "upi", amount: 0 }], 243, methods)
        .ok
    ).toBe(false);
    expect(
      checkSplit([{ methodId: "x", amount: 200 }, { methodId: "upi", amount: 43 }], 243, methods).ok
    ).toBe(false);
  });
});

describe("toOrderPayments / splitLabel", () => {
  it("merges repeated methods and names them", () => {
    const parts = toOrderPayments(
      [
        { methodId: "cash", amount: 100 },
        { methodId: "upi", amount: 43 },
        { methodId: "cash", amount: 100 },
      ],
      methods
    );
    expect(parts).toEqual([
      { methodId: "cash", methodName: "Cash", amount: 200 },
      { methodId: "upi", methodName: "UPI", amount: 43 },
    ]);
    expect(splitLabel(parts)).toBe("Cash + UPI");
  });
});

describe("UPI helpers", () => {
  it("recognises UPI methods by name", () => {
    expect(isUpiMethod({ name: "UPI" })).toBe(true);
    expect(isUpiMethod({ name: "UPI / GPay" })).toBe(true);
    expect(isUpiMethod({ name: "Cash" })).toBe(false);
    expect(isUpiMethod({ name: "Coupon" })).toBe(false);
  });

  it("accepts real merchant handles the strict list misses", () => {
    expect(looksLikeUpiId("shop@paytm")).toBe(true);
    expect(looksLikeUpiId("9876543210@axl")).toBe(true);
    expect(looksLikeUpiId("shop.name@okhdfcbank")).toBe(true);
    expect(looksLikeUpiId("shop")).toBe(false);
    expect(looksLikeUpiId("a@b@c")).toBe(false);
    expect(looksLikeUpiId("")).toBe(false);
  });

  it("builds an exact-amount link only for INR with a UPI ID", () => {
    const link = upiPaymentLink({ upiId: "shop@paytm", amount: 43, currency: "INR", businessName: "Shop" });
    const params = new URLSearchParams(link.replace("upi://pay?", ""));
    expect(link.startsWith("upi://pay?")).toBe(true);
    expect(params.get("pa")).toBe("shop@paytm");
    expect(params.get("am")).toBe("43");
    expect(params.get("pn")).toBe("Shop");
    expect(upiPaymentLink({ upiId: "shop@paytm", amount: 43, currency: "USD" })).toBe("");
    expect(upiPaymentLink({ upiId: "", amount: 43, currency: "INR" })).toBe("");
    expect(upiPaymentLink({ upiId: "shop@paytm", amount: 0, currency: "INR" })).toBe("");
  });
});

describe("order payment parts", () => {
  const base = {
    total: 243,
    status: "completed" as const,
  };

  it("treats old single-method orders as one part", () => {
    expect(
      orderPaymentParts({ ...base, paymentMethodId: "cash", paymentMethodName: "Cash" })
    ).toEqual([{ methodId: "cash", methodName: "Cash", amount: 243 }]);
  });

  it("QR amount is the UPI share of a split", () => {
    expect(
      upiAmountForOrder({
        ...base,
        paymentMethodId: "split",
        paymentMethodName: "Cash + UPI",
        payments: [
          { methodId: "cash", methodName: "Cash", amount: 200 },
          { methodId: "upi", methodName: "UPI", amount: 43 },
        ],
      })
    ).toBe(43);
  });

  it("QR amount is the total for UPI and credit, zero for cash or cancelled", () => {
    expect(upiAmountForOrder({ ...base, paymentMethodId: "upi", paymentMethodName: "UPI" })).toBe(243);
    expect(
      upiAmountForOrder({ ...base, paymentMethodId: "credit", paymentMethodName: "Customer Credit" })
    ).toBe(243);
    expect(upiAmountForOrder({ ...base, paymentMethodId: "cash", paymentMethodName: "Cash" })).toBe(0);
    expect(
      upiAmountForOrder({
        ...base,
        status: "cancelled",
        paymentMethodId: "upi",
        paymentMethodName: "UPI",
      })
    ).toBe(0);
  });
});
