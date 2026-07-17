---
name: verify
description: How to build, run and drive this Next.js site to verify changes end-to-end.
---

# Verifying changes in this repo

Next.js 15 site, no test suite. Verification = build, serve, drive in a browser.

## Build & serve

```bash
npm install            # first time only
npm run build          # also runs the TypeScript check (there is no separate lint config)
npm start              # production server on http://localhost:3000
```

To restart the server, kill it by port (`fuser -k 3000/tcp`) — do NOT
`pkill -f "next start"`; the pattern matches your own shell and kills it.

## Drive it

Playwright is installed globally in the remote environment
(`/opt/node22/lib/node_modules/playwright`, browsers in /opt/pw-browsers).
In an ESM script import it by absolute path:

```js
import { chromium } from "/opt/node22/lib/node_modules/playwright/index.mjs";
```

Flows worth driving:
- Calculators/tools are client components with localStorage persistence — reload
  the page to check state survives.
- `/free-pos` stores everything in IndexedDB (database POS_DATABASE). Full flow:
  welcome → create POS → add product → New Sale → charge → receipt modal →
  orders list → reload for persistence. Use a fresh browser context for a
  clean first-visit state. Downloads (backup JSON, CSV, receipt PDF) can be
  captured with page.waitForEvent("download").
- Check mobile at 390px viewport; assert
  `document.documentElement.scrollWidth <= clientWidth` and, for new panels,
  compare child getBoundingClientRect() against the parent — grid items
  need `min-w-0` to avoid blowing out their track.

## Gotchas

- Buttons often share names across nav and quick actions — scope locators
  (e.g. `page.getByLabel("POS sections").getByRole("button", …)`).
- The POS keeps all screens mounted (hidden with CSS), so `getByText` can hit
  hidden duplicates — scope to a row/dialog first.
