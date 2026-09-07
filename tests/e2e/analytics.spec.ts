// The delivery guarantee, proved in a browser.
//
// Vitest covers the policy. What it cannot cover is the thing the feature was
// actually built for: a visitor who clicks around with no connection, and
// whose events still arrive — once each, with the times they really happened —
// when the connection comes back.
//
// The collector is stubbed by the test so it can record exactly what arrived
// and answer the way the real one does.

import { expect, test, type Page, type Route } from "@playwright/test";

type CapturedEvent = {
  eventId: string;
  seq: number;
  name: string;
  clientTs: number;
  props: Record<string, unknown>;
};

/**
 * Stand in for /api/events, recording every batch.
 *
 * `accepted` echoes the ids back, which is what tells the client it may delete
 * them. A collector that acknowledged nothing would leave the queue intact —
 * that asymmetry is the whole design and is exercised below.
 */
async function stubCollector(page: Page, received: CapturedEvent[], acknowledge = true) {
  await page.route("**/api/events", async (route: Route) => {
    const body = route.request().postDataJSON() as { events: CapturedEvent[] };
    received.push(...body.events);
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        accepted: acknowledge ? body.events.map((event) => event.eventId) : [],
      }),
    });
  });
}

/**
 * How many events are still waiting.
 *
 * `indexedDB.open` would CREATE the database if it is absent — and create it
 * empty, at the current version, so no upgrade would ever be due and the real
 * code could never add its stores. Check the database exists before opening
 * it, or the test quietly breaks the thing it is testing.
 */
async function queuedCount(page: Page): Promise<number> {
  return page.evaluate(async () => {
    const databases = await indexedDB.databases();
    if (!databases.some((entry) => entry.name === "SETU_ANALYTICS")) return 0;
    return new Promise<number>((resolve) => {
      const request = indexedDB.open("SETU_ANALYTICS");
      request.onsuccess = () => {
        const db = request.result;
        if (!db.objectStoreNames.contains("queue")) return resolve(0);
        const count = db.transaction("queue", "readonly").objectStore("queue").count();
        count.onsuccess = () => resolve(count.result);
        count.onerror = () => resolve(-1);
      };
      request.onerror = () => resolve(-1);
    });
  });
}

/** Wait for a named event to reach the collector. */
async function waitForEvent(received: CapturedEvent[], name: string) {
  await expect
    .poll(() => received.filter((event) => event.name === name).length, { timeout: 25_000 })
    .toBeGreaterThan(0);
}

/** Wait until everything queued has been acknowledged and deleted. */
async function waitForQueueEmpty(page: Page) {
  await expect.poll(() => queuedCount(page), { timeout: 25_000 }).toBe(0);
}

test.beforeEach(async ({ page }) => {
  await page.goto("/");
  await page.evaluate(async () => {
    window.localStorage.clear();
    window.sessionStorage.clear();
    await new Promise<void>((resolve) => {
      const request = indexedDB.deleteDatabase("SETU_ANALYTICS");
      request.onsuccess = () => resolve();
      request.onerror = () => resolve();
      request.onblocked = () => resolve();
    });
  });
});

test("a page view is recorded on arrival", async ({ page }) => {
  const received: CapturedEvent[] = [];
  await stubCollector(page, received);

  await page.goto("/");
  await waitForEvent(received, "page_view");
});

test("events made offline arrive once the connection returns", async ({ page, context }) => {
  const received: CapturedEvent[] = [];
  await stubCollector(page, received);

  await page.goto("/calculators");
  await waitForEvent(received, "page_view");
  await waitForQueueEmpty(page);
  received.length = 0;

  // Now the visitor loses their connection and carries on working.
  await context.setOffline(true);

  const offlineAt = Date.now();
  for (let i = 0; i < 5; i += 1) {
    await page.evaluate((index) => {
      const button = document.createElement("button");
      button.setAttribute("data-analytics", "offline_probe");
      button.setAttribute("data-analytics-index", String(index));
      document.body.appendChild(button);
      button.click();
      button.remove();
    }, i);
  }

  // Nothing should have got through.
  expect(received).toHaveLength(0);

  await context.setOffline(false);
  // Coming back online is what closes the circuit and drains the queue.
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await waitForEvent(received, "offline_probe");
  await waitForQueueEmpty(page);

  const probes = received.filter((event) => event.name === "offline_probe");
  expect(probes).toHaveLength(5);

  // Each carries the time it actually happened, not the time it was sent.
  for (const probe of probes) {
    expect(probe.clientTs).toBeGreaterThanOrEqual(offlineAt - 1000);
    expect(probe.clientTs).toBeLessThan(Date.now());
  }

  // And they arrive in the order they were made.
  const order = probes.map((event) => Number(event.props.index));
  expect(order).toEqual([0, 1, 2, 3, 4]);
});

test("no event is delivered twice", async ({ page, context }) => {
  const received: CapturedEvent[] = [];
  await stubCollector(page, received);

  await page.goto("/calculators");
  await context.setOffline(true);
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.setAttribute("data-analytics", "dedupe_probe");
    document.body.appendChild(button);
    button.click();
    button.remove();
  });
  await context.setOffline(false);
  await page.evaluate(() => window.dispatchEvent(new Event("online")));
  await waitForEvent(received, "dedupe_probe");
  await waitForQueueEmpty(page);

  // Several more flush opportunities, none of which should resend anything.
  for (let i = 0; i < 3; i += 1) {
    await page.evaluate(() => window.dispatchEvent(new Event("online")));
  }
  await waitForQueueEmpty(page);

  const ids = received.filter((e) => e.name === "dedupe_probe").map((e) => e.eventId);
  expect(ids).toHaveLength(1);
  expect(new Set(ids).size).toBe(1);
});

test("a collector that acknowledges nothing leaves the events queued", async ({ page }) => {
  const received: CapturedEvent[] = [];
  await stubCollector(page, received, false);

  await page.goto("/calculators");
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.setAttribute("data-analytics", "unacknowledged_probe");
    document.body.appendChild(button);
    button.click();
    button.remove();
  });

  // It was sent...
  await waitForEvent(received, "unacknowledged_probe");

  // ...but nothing was deleted, so it is still there to go again.
  expect(await queuedCount(page)).toBeGreaterThan(0);
});

test("a click on the Google review button is measured as a funnel", async ({ page }) => {
  const received: CapturedEvent[] = [];
  await stubCollector(page, received);

  await page.goto("/calculators/gst-calculator");

  // Work the calculator hard enough that lib/review decides to ask.
  const field = page.locator("input[type='number']").first();
  for (const value of ["100", "200", "300", "400", "500"]) {
    await field.fill(value);
  }

  const prompt = page.getByRole("link", { name: /review us on google/i });
  await expect(prompt).toBeVisible({ timeout: 15_000 });

  await waitForEvent(received, "review_prompt_shown");

  // Clicking opens Google in a new tab; the event must be banked regardless.
  await prompt.click({ modifiers: [] });
  await waitForEvent(received, "review_google_clicked");

  const clicked = received.find((e) => e.name === "review_google_clicked");
  expect(clicked?.props.surface).toBe("/calculators/gst-calculator");
  expect(clicked?.props.variant).toBe("inline");
});

test("opting out stops collection", async ({ page }) => {
  const received: CapturedEvent[] = [];
  await stubCollector(page, received);

  await page.goto("/privacy");
  await page.getByRole("button", { name: /stop counting my visits/i }).click();
  await expect(page.getByText(/you are not being counted/i)).toBeVisible();

  received.length = 0;
  await page.goto("/calculators");
  await page.evaluate(() => {
    const button = document.createElement("button");
    button.setAttribute("data-analytics", "post_optout_probe");
    document.body.appendChild(button);
    button.click();
    button.remove();
  });
  await page.waitForTimeout(2000);

  expect(received).toHaveLength(0);
});
