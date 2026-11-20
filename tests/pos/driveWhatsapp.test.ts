import { describe, expect, it } from "vitest";
import { buildBooksAndArchive, publicMembers, type TeamMember } from "@/lib/pos/drive/hub";
import { syncedStores } from "@/lib/pos/drive/scope";
import {
  defaultCountryFor,
  formatPhone,
  inviteMessage,
  normalizePhone,
  whatsappUrl,
} from "@/lib/pos/drive/whatsapp";

describe("staff mobile numbers", () => {
  it("accepts Indian numbers written the usual ways", () => {
    for (const raw of ["98765 43210", "9876543210", "09876543210", "+91 98765-43210", "0091 9876543210"]) {
      expect(normalizePhone(raw, "91")).toBe("919876543210");
    }
  });

  it("keeps a foreign number's own country code", () => {
    expect(normalizePhone("+971 50 123 4567", "91")).toBe("971501234567");
    expect(normalizePhone("+44 7700 900123", null)).toBe("447700900123");
  });

  it("needs a country code when the shop isn't Indian", () => {
    expect(normalizePhone("9876543210", null)).toBe("9876543210"); // 10 digits, used as typed
    expect(normalizePhone("98765", null)).toBeNull();
  });

  it("rejects things that aren't phone numbers", () => {
    expect(normalizePhone("12345", "91")).toBeNull();
    expect(normalizePhone("abc", "91")).toBeNull();
    expect(normalizePhone("1".repeat(16), "91")).toBeNull();
    expect(normalizePhone("   ", "91")).toBeNull();
  });

  it("uses +91 for local numbers only when the shop bills in rupees", () => {
    expect(defaultCountryFor("INR")).toBe("91");
    expect(defaultCountryFor("USD")).toBeNull();
  });

  it("shows numbers readably", () => {
    expect(formatPhone("919876543210")).toBe("+91 98765 43210");
    expect(formatPhone("447700900123")).toBe("+447700900123");
  });
});

describe("WhatsApp invite", () => {
  const message = inviteMessage({
    name: "Ramesh",
    shopName: "Sharma Kirana",
    email: "ramesh@gmail.com",
    link: "https://setutechnology.com/products/browser-based-pos?join=abc",
  });

  it("explains the one-time link and the sign-in after it", () => {
    expect(message).toContain("Hi Ramesh,");
    expect(message).toContain("Sharma Kirana");
    expect(message).toContain("ramesh@gmail.com");
    expect(message).toContain("?join=abc");
    expect(message).toMatch(/Sign in with Google" on any phone or computer/);
  });

  it("opens WhatsApp to that number with the message typed in", () => {
    const url = whatsappUrl("919876543210", message);
    expect(url.startsWith("https://wa.me/919876543210?text=")).toBe(true);
    expect(decodeURIComponent(url.split("text=")[1])).toBe(message);
  });
});

describe("phone numbers stay private to owners", () => {
  const members: TeamMember[] = [
    { email: "owner@x", role: "owner", code: "O", addedAt: "", fileId: "f-o" },
    { email: "ramesh@x", role: "cashier", code: "C1", addedAt: "", fileId: "f-c1", phone: "919876543210" },
  ];

  it("are left out of the team list cashiers can read", () => {
    expect(JSON.stringify(publicMembers(members))).not.toContain("9876543210");
  });

  it("are kept in books.json for owners and a new main device", () => {
    const { books } = buildBooksAndArchive({}, syncedStores([]), {}, members);
    expect(books.memberPhones).toEqual({ C1: "919876543210" });
  });
});
