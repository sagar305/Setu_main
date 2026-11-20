import { describe, expect, it } from "vitest";
import {
  DecryptError,
  fingerprint,
  isKey,
  keysFromFragment,
  keysToFragment,
  newKey,
  openEnvelope,
  parseRecoveryKey,
  recoveryKey,
  seal,
} from "@/lib/pos/drive/crypto";

const sample = {
  products: Array.from({ length: 300 }, (_, i) => ({ id: `p${i}`, name: `Parle-G ${i}`, sellingPrice: 10, stock: 5 })),
  customers: [{ id: "c1", name: "Asha", phone: "9876543210" }],
};

describe("encrypted Drive files", () => {
  it("round-trips with the right key and label", async () => {
    const key = newKey();
    const env = await seal("shop", key, "catalog", sample);
    expect(await openEnvelope(key, "catalog", env)).toEqual(sample);
  });

  it("is unreadable in Drive: no names, prices or phone numbers", async () => {
    const env = await seal("shop", newKey(), "catalog", sample);
    const text = JSON.stringify(env);
    expect(text).not.toContain("Parle");
    expect(text).not.toContain("Asha");
    expect(text).not.toContain("9876543210");
    expect(env.key).toBe("shop");
  });

  it("is compressed (much smaller than the plain JSON)", async () => {
    const env = await seal("shop", newKey(), "catalog", sample);
    expect(JSON.stringify(env).length).toBeLessThan(JSON.stringify(sample).length / 3);
  });

  it("can't be opened with another key, another label, or after tampering", async () => {
    const key = newKey();
    const env = await seal("books", key, "books", sample);
    await expect(openEnvelope(newKey(), "books", env)).rejects.toBeInstanceOf(DecryptError);
    await expect(openEnvelope(key, "catalog", env)).rejects.toBeInstanceOf(DecryptError);
    const tampered = { ...env, data: env.data.slice(0, -6) + (env.data.endsWith("AAAA==") ? "BBBB==" : "AAAA==") };
    await expect(openEnvelope(key, "books", tampered)).rejects.toBeInstanceOf(DecryptError);
  });

  it("tells old unencrypted files apart", async () => {
    await expect(openEnvelope(newKey(), "live", { app: "setu-pos-team", members: [] })).rejects.toThrow(/older, unencrypted/);
  });

  it("uses a fresh random IV every time", async () => {
    const key = newKey();
    const a = await seal("shop", key, "live", { x: 1 });
    const b = await seal("shop", key, "live", { x: 1 });
    expect(a.iv).not.toBe(b.iv);
    expect(a.data).not.toBe(b.data);
  });
});

describe("keys", () => {
  it("are 256-bit and random", () => {
    const a = newKey();
    expect(isKey(a)).toBe(true);
    expect(a).not.toBe(newKey());
    expect(isKey("short")).toBe(false);
  });

  it("travel in the invite link after #", () => {
    const keys = { shop: newKey(), books: newKey() };
    const link = `https://x/products/browser-based-pos?join=abc#${keysToFragment(keys)}`;
    expect(keysFromFragment(new URL(link).hash)).toEqual(keys);
    expect(keysFromFragment(`#${keysToFragment({ shop: keys.shop, books: null })}`)).toEqual({ shop: keys.shop, books: null });
    expect(keysFromFragment("#nothing")).toBeNull();
  });

  it("make a recovery key the owner can print and type back", () => {
    const keys = { shop: newKey(), books: newKey() };
    const text = recoveryKey(keys);
    expect(text.startsWith("SETU-POS-KEY.")).toBe(true);
    expect(parseRecoveryKey(`  ${text}\n`)).toEqual(keys);
    expect(parseRecoveryKey("SETU-POS-KEY.bad.bad")).toBeNull();
  });

  it("fingerprints content so unchanged files aren't uploaded again", async () => {
    expect(await fingerprint("a")).toBe(await fingerprint("a"));
    expect(await fingerprint("a")).not.toBe(await fingerprint("b"));
  });
});
