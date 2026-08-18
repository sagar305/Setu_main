// End-to-end browser tests.
// ---------------------------------------------------------------------------
// These cover what Vitest cannot: PDF.js running in its worker, IndexedDB
// persistence across a reload, and the workflow a CA actually clicks through.
// The last test is the important one — it proves the tool refuses to present an
// incomplete extraction as a clean parse (§30).

import { expect, test } from "@playwright/test";
import { join } from "node:path";
import { DEMO_TOTALS } from "../../lib/bankStatement/demo/sampleStatement";

const fixtures = join(process.cwd(), "tests", "fixtures", "generic");

const ANALYZER = "/products/bank-statement-analyzer";

/** Start every test from a clean browser so state never leaks between them. */
test.beforeEach(async ({ page }) => {
  await page.goto(ANALYZER);
  await page.evaluate(async () => {
    window.localStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("setu_bank_statement_analyzer");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
});

test("landing page states the privacy promise and offers the demo", async ({ page }) => {
  await page.goto(ANALYZER);
  await expect(page.getByRole("heading", { level: 1 })).toHaveText("Bank Statement Analyzer");
  await expect(page.getByText("Your financial data stays on your device.")).toBeVisible();
  // Listed as a free product, so the product page carries the app itself.
  await expect(page.getByRole("button", { name: "Try a demo statement" })).toBeVisible();
  await expect(page.getByRole("heading", { name: "No AI. No upload. No account." })).toBeVisible();
});

test("demo statement loads and reports the published figures", async ({ page }) => {
  await page.goto(ANALYZER);
  await page.getByRole("button", { name: "Try a demo statement" }).click();

  await expect(page.getByText("Imported statements (1)")).toBeVisible({ timeout: 20_000 });
  await expect(page.getByRole("link", { name: /Review 247 transactions/ })).toBeVisible();

  await page.goto(`${ANALYZER}/analyze`);
  // ₹18,42,000 in and ₹15,76,500 out — the numbers quoted on the landing page.
  // Exact match so the summary cards are checked, not the category bars that
  // happen to repeat the same figure with a percentage appended.
  await expect(page.getByText("₹18,42,000.00", { exact: true })).toBeVisible();
  await expect(page.getByText("₹15,76,500.00", { exact: true })).toBeVisible();
  await expect(page.getByText("247", { exact: true })).toBeVisible();
});

test("imports a text-layer PDF, reconstructing rows from positioned text", async ({ page }) => {
  await page.goto(`${ANALYZER}/import`);
  await page.locator('input[type="file"]').setInputFiles(join(fixtures, "statement-04.pdf"));

  await expect(page.getByText("statement-04.pdf")).toBeVisible({ timeout: 30_000 });
  await expect(page.getByRole("button", { name: /Import 12 transactions/ })).toBeVisible();

  // The narration column has to come through intact. This fixture clips each
  // cell to its own column width, as a real statement does, so the assertion
  // uses a narration that fits rather than one the layout would truncate.
  await expect(page.getByText("VALID", { exact: true }).first()).toBeVisible();
  await expect(page.getByText("NEFT DR/SALARY/RAHUL MEHTA")).toBeVisible();

  await page.getByRole("button", { name: /Import 12 transactions/ }).click();
  await expect(page.getByText("Imported statements (1)")).toBeVisible();
});

test("classifies, filters and survives a reload", async ({ page }) => {
  await page.goto(`${ANALYZER}/import`);
  await page.locator('input[type="file"]').setInputFiles(join(fixtures, "statement-01.csv"));
  await page.getByRole("button", { name: /Import 12 transactions/ }).click();

  await page.goto(`${ANALYZER}/review`);
  await page.getByRole("button", { name: "Run classification" }).click();

  // Rent and salary are unambiguous patterns — they must land automatically.
  await expect(page.getByText("ACH DR/OFFICE RENT/SKYLINE PROPERTIES")).toBeVisible();
  await expect(page.locator("select").filter({ hasText: "Rent" }).first()).toBeVisible({
    timeout: 15_000,
  });

  // IndexedDB, not memory: the work is still here after a full reload.
  await page.reload();
  await expect(page.getByText(/Transactions \(12\)/)).toBeVisible({ timeout: 15_000 });
});

test("exports an Excel workbook without contacting a server", async ({ page }) => {
  await page.goto(`${ANALYZER}/import`);
  await page.locator('input[type="file"]').setInputFiles(join(fixtures, "statement-01.csv"));
  await page.getByRole("button", { name: /Import 12 transactions/ }).click();

  // Fail the test if anything tries to leave the machine while we export.
  const outbound: string[] = [];
  page.on("request", (request) => {
    const url = request.url();
    if (!url.startsWith("http://localhost:3000") && !url.startsWith("data:") && !url.startsWith("blob:")) {
      outbound.push(url);
    }
  });

  await page.goto(`${ANALYZER}/export`);
  const download = page.waitForEvent("download");
  await page.getByRole("button", { name: /Download .xlsx/ }).click();
  expect((await download).suggestedFilename()).toMatch(/^bank-statement-analysis-.*\.xlsx$/);
  expect(outbound).toEqual([]);
});

test("refuses to present a broken extraction as a clean parse", async ({ page }) => {
  await page.goto(`${ANALYZER}/import`);
  await page.locator('input[type="file"]').setInputFiles(join(fixtures, "statement-03-broken.csv"));

  await expect(page.getByText("UNRESOLVED").first()).toBeVisible({ timeout: 20_000 });
  // The verdict appears twice by design — once as the summary line, once as the
  // explanation of what to do about it.
  await expect(
    page.getByText(/We could not confidently extract every transaction/).first()
  ).toBeVisible();
  // The import button must not pretend the number is complete.
  await expect(page.getByRole("button", { name: /Import 4 extracted anyway/ })).toBeVisible();
});

test("asks for a password rather than failing on an encrypted PDF", async ({ page }) => {
  await page.goto(`${ANALYZER}/import`);

  // Build an encrypted PDF in the page so the fixture needs no committed secret.
  await page.locator('input[type="file"]').setInputFiles({
    name: "locked.pdf",
    mimeType: "application/pdf",
    buffer: Buffer.from(await makeEncryptedPdf()),
  });

  await expect(page.getByRole("heading", { name: "Password required" })).toBeVisible({
    timeout: 20_000,
  });
  await expect(page.getByText(/never stored, logged or sent anywhere/)).toBeVisible();
});

/** A minimal RC4-encrypted PDF, generated with jsPDF's own encryption. */
async function makeEncryptedPdf(): Promise<ArrayBuffer> {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({
    unit: "pt",
    format: "a4",
    encryption: { userPassword: "setu-test" },
  });
  doc.text("Locked statement", 40, 60);
  return doc.output("arraybuffer");
}

// The round trip that matters: the sample we hand out has to survive our own
// parser. It is generated as a real multi-page statement with RIGHT-aligned
// amount columns, so this also proves the PDF column reconstruction copes with
// the way banks actually print numbers.
test.describe("downloadable sample statement", () => {
  for (const [format, button, extension] of [
    ["PDF", "Sample PDF", "pdf"],
    ["Excel", "Sample Excel", "xlsx"],
    ["CSV", "Sample CSV", "csv"],
  ] as const) {
    test(`${format} sample downloads and re-imports to ${DEMO_TOTALS.count} transactions`, async ({
      page,
    }, testInfo) => {
      await page.goto(ANALYZER);

      const downloadPromise = page.waitForEvent("download");
      await page.getByRole("button", { name: button }).first().click();
      const download = await downloadPromise;
      expect(download.suggestedFilename()).toBe(`setu-sample-bank-statement.${extension}`);

      const saved = testInfo.outputPath(`sample.${extension}`);
      await download.saveAs(saved);

      // Feed it straight back in through the ordinary import path.
      await page.goto(`${ANALYZER}/import`);
      await page.locator('input[type="file"]').setInputFiles(saved);

      await expect(
        page.getByRole("button", { name: new RegExp(`Import ${DEMO_TOTALS.count} transactions`) })
      ).toBeVisible({ timeout: 60_000 });
      // Extraction must reconcile against the statement's own running balance.
      await expect(page.getByText("VALID", { exact: true }).first()).toBeVisible();
    });
  }
});

// The ruled-table layout, end to end in a real browser. This is the one that
// needs PDF.js's operator list, which only works on the legacy build.
test("imports a ruled-table PDF with stacked headers and wrapped dates", async ({ page }) => {
  await page.goto(`${ANALYZER}/import`);
  await page.locator('input[type="file"]').setInputFiles(join(fixtures, "statement-05-ruled.pdf"));

  await expect(page.getByRole("button", { name: /Import 26 transactions/ })).toBeVisible({
    timeout: 60_000,
  });
  await expect(page.getByText("VALID", { exact: true }).first()).toBeVisible();

  // All eight columns must be offered, named from the reassembled header.
  const referenceSelect = page.locator("select").filter({ hasText: "Ref No./Cheque No." }).first();
  await expect(referenceSelect).toBeVisible();
  const options = await referenceSelect.locator("option").allTextContents();
  expect(options.filter((o) => o !== "Not in this file")).toHaveLength(8);
});

// One condition, several keywords, ORed — so a category is one rule rather
// than one rule per merchant.
test("a rule condition accepts several keywords, any of which matches", async ({ page }) => {
  await page.goto(`${ANALYZER}/import?demo=1`);
  await expect(page.getByText("Imported statements (1)")).toBeVisible({ timeout: 25_000 });

  await page.goto(`${ANALYZER}/review`);
  await page.getByRole("button", { name: /Rules \(/ }).click();
  await page.getByRole("button", { name: "New rule" }).click();
  await page.getByPlaceholder("e.g. Swiggy → Business Meals").fill("Food and ads");

  const keywords = page.getByLabel("Keywords, any of which matches");
  for (const word of ["SWIGGY", "GOOGLE ADS", "IRCTC"]) {
    await keywords.fill(word);
    await keywords.press("Enter");
  }

  // Each keyword becomes a removable chip, and the live count covers all three.
  await expect(page.getByText("SWIGGY", { exact: true })).toBeVisible();
  await expect(page.getByText("GOOGLE ADS", { exact: true })).toBeVisible();
  const summary = await page.getByText(/matches .* of the/).innerText();
  const matched = Number(summary.replace(/\s+/g, " ").match(/matches (\d+) of/)?.[1] ?? "0");
  expect(matched).toBeGreaterThan(3);

  await page.getByRole("button", { name: "Save rule" }).click();
  await expect(
    page.getByText(/narration contains any of "SWIGGY", "GOOGLE ADS", "IRCTC"/)
  ).toBeVisible({ timeout: 20_000 });
});
