// Product milestones: what the free apps may announce, and how little.
//
// tests/analytics/boundary.test.ts keeps the measurement pipeline out of the
// apps that hold a shop's real work. The apps still say "an order was created"
// through lib/activity.ts, and that is only acceptable while three things stay
// true: the file they call can reach nothing, a signal can carry nothing but a
// listed name and a count, and every call names something on the list.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import { PRODUCT_ACTIVITIES, parseActivity, type ActivityProduct } from "@/lib/activity";

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^[ \t]*\/\/.*$/gm, "");
}

function sourceFiles(directory: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(directory)) {
    const full = join(directory, entry);
    if (statSync(full).isDirectory()) found.push(...sourceFiles(full));
    else if (/\.(ts|tsx)$/.test(entry)) found.push(full);
  }
  return found;
}

const PRODUCTS = Object.keys(PRODUCT_ACTIVITIES) as ActivityProduct[];

describe("the signal an app raises", () => {
  it("accepts a listed milestone", () => {
    expect(parseActivity({ product: "pos", name: "order_created" })).toEqual({
      product: "pos",
      name: "order_created",
    });
  });

  it("refuses a product or a name that is not on the list", () => {
    expect(parseActivity({ product: "bank", name: "order_created" })).toBeNull();
    expect(parseActivity({ product: "pos", name: "student_created" })).toBeNull();
    expect(parseActivity({ product: "pos", name: "Ramesh bought 2 kg sugar" })).toBeNull();
    expect(parseActivity({ product: "toString", name: "length" })).toBeNull();
    expect(parseActivity(null)).toBeNull();
    expect(parseActivity("order_created")).toBeNull();
  });

  it("leaves behind everything except the product, the name and a count", () => {
    const parsed = parseActivity({
      product: "clinic",
      name: "patient_registered",
      patientName: "A. Sharma",
      phone: "9876543210",
      amount: 450,
    });
    expect(parsed).toEqual({ product: "clinic", name: "patient_registered" });
  });

  it("keeps a count only when it is a plain whole number", () => {
    expect(parseActivity({ product: "tuition", name: "students_imported", count: 40 })?.count).toBe(40);
    for (const count of [12.5, -1, Number.NaN, Infinity, "40", { rows: 40 }]) {
      expect(parseActivity({ product: "tuition", name: "students_imported", count })?.count).toBeUndefined();
    }
  });

  it("names every milestone in snake_case, so no name can be mistaken for content", () => {
    for (const product of PRODUCTS) {
      for (const name of PRODUCT_ACTIVITIES[product]) {
        expect(name, `${product}.${name}`).toMatch(/^[a-z]+(_[a-z]+)+$/);
      }
    }
  });
});

describe("the file the apps call", () => {
  const source = stripComments(readFileSync(join(process.cwd(), "lib", "activity.ts"), "utf8"));

  it("imports nothing", () => {
    expect(source).not.toMatch(/\bimport\b|\brequire\s*\(/);
  });

  it("cannot reach the network or storage", () => {
    expect(source).not.toMatch(
      /\b(fetch|XMLHttpRequest|WebSocket|EventSource|sendBeacon|localStorage|sessionStorage|indexedDB)\b/
    );
  });
});

describe("the calls inside the apps", () => {
  // One call per line, with the product, the name and at most a count. The
  // type checker already refuses an unlisted name; this is the same rule for
  // anyone reading the diff, plus the two things types cannot say.
  const CALL = /reportActivity\(([^)]*)\)/g;
  const calls: { file: string; product: string; name: string; count: string | undefined }[] = [];

  for (const product of PRODUCTS) {
    for (const file of sourceFiles(join(process.cwd(), "lib", product))) {
      const source = stripComments(readFileSync(file, "utf8"));
      for (const match of source.matchAll(CALL)) {
        const [first, second, third] = match[1].split(",").map((part) => part.trim());
        calls.push({
          file,
          product: first?.replace(/"/g, "") ?? "",
          name: second?.replace(/"/g, "") ?? "",
          count: third,
        });
      }
    }
  }

  it("finds them", () => {
    expect(calls.length).toBeGreaterThan(50);
  });

  it("announce only as the product they live in, and only listed names", () => {
    for (const call of calls) {
      expect(call.file, `${call.product} announced from ${call.file}`).toContain(
        join("lib", call.product)
      );
      expect(PRODUCT_ACTIVITIES[call.product as ActivityProduct], call.file).toContain(call.name);
    }
  });

  it("pass nothing but a row count as the third argument", () => {
    // `created.length`, `rows.length` — how many, never which or how much.
    for (const call of calls) {
      if (call.count === undefined) continue;
      expect(call.count, `${call.file}: ${call.name}`).toMatch(/^[A-Za-z]+\.length$/);
    }
  });

  it("use every name on the list, so the list is not a wish", () => {
    for (const product of PRODUCTS) {
      const used = new Set(calls.filter((call) => call.product === product).map((call) => call.name));
      expect([...used].sort(), product).toEqual([...PRODUCT_ACTIVITIES[product]].sort());
    }
  });
});
