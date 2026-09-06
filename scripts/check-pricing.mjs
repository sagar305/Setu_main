#!/usr/bin/env node
/**
 * Keeps published prices consistent.
 *
 * The same numbers appear in three places: content/en/pricing.json (which
 * drives /pricing and the Offer schema on product pages) and the `pricing`
 * block on each product page's own content file, which renders the price the
 * customer actually reads.
 *
 * A price that disagrees between the product page and the pricing page is a
 * commercial problem, not a typo, so this fails the build rather than warning.
 *
 * A product that is not on sale has neither: no `price` in pricing.json and no
 * `pricing` block on its page. That pair is fine — half of it is not. A page
 * quoting a price the pricing page does not publish, or a plan whose price
 * never reaches the page a customer reads, both fail here.
 *
 * Run: node scripts/check-pricing.mjs   (wired into `npm run build`)
 */
import fs from "node:fs";

const pricing = JSON.parse(fs.readFileSync("content/en/pricing.json", "utf8"));

/** Product content file -> the plan slug in pricing.json it must agree with. */
const PRODUCT_FILES = {
  "content/en/restaurant-pos.json": "setu-dine",
  "content/en/queue.json": "setu-queue",
  "content/en/qr-menu.json": "qr-menu",
};

/** Product page region label -> region id in pricing.json. */
const REGION_IDS = { India: "IN", "Rest of the world": "INTL" };

function formatAmount(amount, regionId) {
  if (regionId === "IN") {
    return `₹${new Intl.NumberFormat("en-IN", { maximumFractionDigits: 0 }).format(amount)}`;
  }
  return `$${amount.toFixed(2)}`;
}

const problems = [];
/** Products deliberately carrying no price at all, on either side. */
let unpriced = 0;

for (const [file, slug] of Object.entries(PRODUCT_FILES)) {
  const plan = pricing.plans.find((p) => p.slug === slug);
  if (!plan) {
    problems.push(`${file}: no plan "${slug}" in pricing.json`);
    continue;
  }
  const block = JSON.parse(fs.readFileSync(file, "utf8")).pricing;

  if (!plan.price) {
    // Not on sale. The page must not quote a price either.
    if (block) {
      problems.push(
        `${file}: shows a pricing block, but plan "${slug}" has no price in pricing.json`,
      );
    } else {
      unpriced += 1;
    }
    continue;
  }

  if (!block) {
    problems.push(`${file}: no pricing block to check, but plan "${slug}" is priced`);
    continue;
  }

  for (const shown of block.plans) {
    const regionId = REGION_IDS[shown.region];
    if (!regionId) {
      problems.push(`${file}: unknown region "${shown.region}"`);
      continue;
    }
    const { monthly, yearly } = plan.price[regionId];

    const expectedMonthly = formatAmount(monthly, regionId);
    const expectedYearly = formatAmount(yearly, regionId);
    // Savings vs paying monthly for twelve months.
    const expectedSaving = formatAmount(
      regionId === "IN"
        ? monthly * 12 - yearly
        : Number((monthly * 12 - yearly).toFixed(2)),
      regionId,
    );

    if (shown.monthlyLabel !== expectedMonthly)
      problems.push(`${file} (${shown.region}): monthly "${shown.monthlyLabel}" ≠ ${expectedMonthly}`);
    if (shown.yearlyLabel !== expectedYearly)
      problems.push(`${file} (${shown.region}): yearly "${shown.yearlyLabel}" ≠ ${expectedYearly}`);
    if (!shown.saveLabel.includes(expectedSaving))
      problems.push(
        `${file} (${shown.region}): saving "${shown.saveLabel}" should be ${expectedSaving}`,
      );
  }
}

if (problems.length > 0) {
  console.error(`\ncheck-pricing: ${problems.length} inconsistency(ies):\n`);
  for (const p of problems) console.error(`  ${p}`);
  console.error("\ncontent/en/pricing.json is the source of truth — update the product page to match.\n");
  process.exit(1);
}

const total = Object.keys(PRODUCT_FILES).length;
console.log(
  `check-pricing: ${total} product pages agree with pricing.json ` +
    `(${total - unpriced} priced, ${unpriced} not on sale).`,
);
