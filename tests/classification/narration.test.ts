// Normalising Indian bank narrations into something a language model can read.
// These are the shapes the parsers actually hand us, taken from real statement
// formats: UPI, IMPS P2P/P2A, NEFT, RTGS, ACH/NACH, card and ATM.

import { describe, expect, it } from "vitest";
import {
  detectChannel,
  merchantContext,
  merchantKey,
  narrationToSentence,
  parseNarration,
  splitCounterparty,
} from "@/lib/bankStatement/ai/narration";

describe("channel detection", () => {
  it("recognises the rails an Indian statement uses", () => {
    expect(detectChannel("UPI/9033/BigBasket/BBNow")).toBe("UPI");
    expect(detectChannel("IMPS/P2P/Ankit Sharma/Trip split")).toBe("IMPS");
    expect(detectChannel("NEFT CR/ACME CORP SAL NOV25")).toBe("NEFT");
    expect(detectChannel("RTGS DR/VERTEX SUPPLIES")).toBe("RTGS");
    expect(detectChannel("ACH DR/BAJAJ FINANCE")).toBe("ACH");
    expect(detectChannel("POS 4412XXXX8890 CROMA")).toBe("CARD");
    expect(detectChannel("ATM WDL/SELF")).toBe("ATM");
    expect(detectChannel("CHQ CLG 004512")).toBe("CHEQUE");
  });

  // "NACH" contains "ACH" — the longer marker has to win or every mandate is
  // read as a plain auto-debit.
  it("does not mistake NACH for ACH", () => {
    expect(detectChannel("NACH DR/HDFC LIFE MANDATE")).toBe("NACH");
  });

  it("returns nothing rather than guessing", () => {
    expect(detectChannel("MISC ADJUSTMENT 4471")).toBeUndefined();
  });
});

describe("counterparty extraction", () => {
  it("pulls the merchant out from between the rails", () => {
    expect(splitCounterparty("UPI/9033/BigBasket/BBNow").name).toBe("Bigbasket");
    expect(splitCounterparty("UPI/5512/Netflix.com/Monthly").name).toBe("Netflix.com");
    expect(splitCounterparty("UPI/8122/UrbanCompany/Salon").name).toBe("Urbancompany");
  });

  it("keeps the payer's note separately from the counterparty", () => {
    const upi = splitCounterparty("UPI/9033/BigBasket/BBNow");
    expect(upi.note).toBe("BBNow");

    const imps = splitCounterparty("IMPS/P2P/Ankit Sharma/Trip split");
    expect(imps.name).toBe("Ankit Sharma");
    expect(imps.note).toBe("Trip split");
  });

  it("tells a person from a business", () => {
    expect(splitCounterparty("IMPS/P2P/Ankit Sharma/Trip split").isPerson).toBe(true);
    // P2A says "account", so the same name shape is not treated as a friend.
    expect(splitCounterparty("IMPS/P2A/BAJAJ FIN EMI 8831").isPerson).toBe(false);
    expect(splitCounterparty("NEFT CR/ACME CORP SAL NOV25").isPerson).toBe(false);
  });

  it("ignores reference numbers, IFSC codes and UPI handles", () => {
    const parsed = splitCounterparty("UPI/DR/402318/SWIGGY/UTIB/swiggy@axis");
    expect(parsed.name).toBe("Swiggy");
  });

  it("says nothing when there is no name in there at all", () => {
    expect(splitCounterparty("4471/99201/00").name).toBeUndefined();
  });
});

describe("merchant context", () => {
  it("knows what a few opaque merchant strings actually are", () => {
    expect(merchantContext("UPI/9033/BigBasket/BBNow")?.canonical).toBe("BigBasket");
    expect(merchantContext("UPI/5512/Netflix.com/Monthly")?.context).toContain("streaming");
    expect(merchantContext("IMPS/P2A/BAJAJ FIN EMI 8831")?.canonical).toBe("Bajaj Finance");
    expect(merchantContext("UPI/8122/UrbanCompany/Salon")?.context).toContain("salon");
  });

  it("leaves an unknown merchant alone rather than inventing a meaning", () => {
    expect(merchantContext("UPI/7781/Kalyani Provision Stores/Bill")).toBeUndefined();
  });
});

describe("the sentence that gets embedded", () => {
  it("turns the spec's examples into prose", () => {
    const groceries = narrationToSentence("UPI/9033/BigBasket/BBNow", "DEBIT");
    expect(groceries).toContain("BigBasket");
    expect(groceries).toContain("grocer");
    expect(groceries).toContain("UPI");

    const salary = narrationToSentence("NEFT CR/ACME CORP SAL NOV25", "CREDIT");
    expect(salary).toContain("Money received");
    expect(salary).toContain("salary or payroll");

    const emi = narrationToSentence("IMPS/P2A/BAJAJ FIN EMI 8831", "DEBIT");
    expect(emi).toContain("Bajaj Finance");
    expect(emi).toContain("EMI");

    const split = narrationToSentence("IMPS/P2P/Ankit Sharma/Trip split", "DEBIT");
    expect(split).toContain("individual person named Ankit Sharma");
    expect(split).toContain("splitting a shared expense");
  });

  it("states the direction, because a salary paid is not a salary received", () => {
    expect(narrationToSentence("NEFT/SALARY/RAHUL", "DEBIT")).toContain("Money paid out");
    expect(narrationToSentence("NEFT/SALARY/RAHUL", "CREDIT")).toContain("Money received");
  });

  it("produces something usable even from an unrecognisable narration", () => {
    const sentence = narrationToSentence("XZ/9981/QQ", "DEBIT");
    expect(sentence.length).toBeGreaterThan(0);
    expect(sentence).toContain("Money paid out");
  });
});

describe("merchant keys", () => {
  // The key is what learned corrections and the embedding cache hang off, so
  // the same shop with a different reference number has to collapse to one key.
  it("is stable across reference numbers", () => {
    expect(merchantKey("UPI/9033/BigBasket/BBNow", "DEBIT")).toBe(
      merchantKey("UPI/4471/BigBasket/Order", "DEBIT")
    );
  });

  it("separates the two directions", () => {
    expect(merchantKey("UPI/9033/BigBasket/BBNow", "DEBIT")).not.toBe(
      merchantKey("UPI/9033/BigBasket/BBNow", "CREDIT")
    );
  });

  it("keeps different merchants apart", () => {
    expect(merchantKey("UPI/9033/BigBasket/BBNow", "DEBIT")).not.toBe(
      merchantKey("UPI/5512/Netflix.com/Monthly", "DEBIT")
    );
  });

  it("still returns something for a narration with no name in it", () => {
    expect(merchantKey("4471/99201/00", "DEBIT")).toContain("DEBIT:");
  });
});

describe("parseNarration", () => {
  it("keeps a person out of the merchant field and vice versa", () => {
    const person = parseNarration("IMPS/P2P/Ankit Sharma/Trip split", "DEBIT");
    expect(person.person).toBe("Ankit Sharma");
    expect(person.merchant).toBeUndefined();

    const merchant = parseNarration("UPI/9033/BigBasket/BBNow", "DEBIT");
    expect(merchant.merchant).toBe("BigBasket");
    expect(merchant.person).toBeUndefined();
  });
});
