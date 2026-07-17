import type { Metadata } from "next";
import { FreePosApp } from "@/components/tools/FreePos/FreePosApp";

export const metadata: Metadata = {
  title: "Browser Based POS - Free, Offline, No Login | Setu Technology",
  description:
    "Free browser-based POS system for small businesses. Bill customers, manage products, inventory and customers — works offline, no signup, no subscription. Your data stays on your device.",
  keywords: [
    "browser based POS",
    "free POS",
    "offline POS",
    "browser POS",
    "free billing software",
    "POS for small business",
    "free POS software India",
    "no login POS",
    "retail billing",
  ],
  alternates: {
    canonical: "/products/browser-based-pos",
  },
  openGraph: {
    title: "Browser Based POS - Free, Offline, No Login",
    description:
      "Bill customers, manage products and inventory, print receipts. 100% free, works offline, data stays in your browser.",
    url: "/products/browser-based-pos",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Browser Based POS",
      },
    ],
  },
};

const faqSchema = {
  "@context": "https://schema.org",
  "@type": "FAQPage",
  mainEntity: [
    {
      "@type": "Question",
      name: "Is this POS really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. There is no login, no subscription and no hidden tier. The POS runs entirely in your browser and stores everything on your device.",
      },
    },
    {
      "@type": "Question",
      name: "Does it work without internet?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. After your first visit the POS is cached in your browser, so you can open it, bill customers and print receipts completely offline. Your data is stored locally in IndexedDB and survives browser restarts.",
      },
    },
    {
      "@type": "Question",
      name: "Where is my data stored?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "All data — products, customers, orders and settings — is stored in your browser's IndexedDB on your device. Nothing is uploaded to any server. Use the backup feature to export a POS_BACKUP.json file you can restore on any device.",
      },
    },
    {
      "@type": "Question",
      name: "Can I print receipts on a thermal printer?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Receipts print on 80mm and 58mm thermal roll printers (like Epson TM series) as well as regular A4 printers — pick your paper size in Settings. You can also download any receipt as a PDF.",
      },
    },
    {
      "@type": "Question",
      name: "What happens if I clear my browser data?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Clearing site data deletes your POS data, so export a backup regularly. The POS reminds you when your last backup is more than a week old, and a backup file restores everything — products, orders, customers and settings.",
      },
    },
    {
      "@type": "Question",
      name: "Can it sync my data to a Google Sheet?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Connect your own Google Sheet (Settings → Google Sheet sync) and the POS automatically keeps your orders, products and customers updated in it. Data goes directly from your browser to your Google account — never through our servers. If your browser data is ever lost, you can restore the whole POS from that sheet.",
      },
    },
    {
      "@type": "Question",
      name: "Does it support barcode scanners?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Any USB or Bluetooth scanner that types the barcode works: scan into the billing search box and the matching product is added to the cart instantly.",
      },
    },
  ],
};

export default function BrowserBasedPosPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Page Header */}
      <section className="mx-auto max-w-7xl px-6 py-12 sm:py-16">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
            <span className="text-sm font-semibold text-indigo">Free Tool — Works Offline</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            Browser Based POS
          </h1>
          <p className="mx-auto mt-4 max-w-2xl text-xl text-muted">
            Bill customers, manage products and track inventory — right from your browser. No
            login, no subscription, no internet needed.
          </p>
        </div>
      </section>

      {/* The POS app */}
      <section className="mx-auto max-w-7xl px-4 pb-12 sm:px-6">
        <FreePosApp />
      </section>

      {/* Features */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">
            Everything a small shop needs
          </h2>
          <div className="grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">⚡</div>
              <h3 className="mb-2 font-bold text-ink">Fast Billing</h3>
              <p className="text-sm text-muted">
                Search or scan, tap to add, charge. Complete a sale in seconds with barcode
                scanner support.
              </p>
            </div>
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📴</div>
              <h3 className="mb-2 font-bold text-ink">Works Offline</h3>
              <p className="text-sm text-muted">
                No internet? No problem. The POS loads and works fully offline after your first
                visit.
              </p>
            </div>
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🔐</div>
              <h3 className="mb-2 font-bold text-ink">Your Data, Your Device</h3>
              <p className="text-sm text-muted">
                Everything is stored locally in your browser. No cloud, no server, no account —
                complete ownership.
              </p>
            </div>
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🧾</div>
              <h3 className="mb-2 font-bold text-ink">Receipts & PDF</h3>
              <p className="text-sm text-muted">
                Print to thermal or normal printers, or download receipts as PDF — generated on
                your device.
              </p>
            </div>
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📦</div>
              <h3 className="mb-2 font-bold text-ink">Inventory Tracking</h3>
              <p className="text-sm text-muted">
                Opening stock, stock sold, current stock — with low-stock alerts and a full
                movement log.
              </p>
            </div>
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">💾</div>
              <h3 className="mb-2 font-bold text-ink">Backup & Restore</h3>
              <p className="text-sm text-muted">
                Export everything to a single JSON file and restore it on any device. CSV exports
                for Excel included.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Info */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Who is this POS for?</h2>
            <p className="mb-4 text-muted">
              Built for small businesses that want fast billing without paying for software or
              creating accounts:
            </p>
            <ul className="space-y-2 text-muted">
              {[
                "Small retailers and local shops",
                "Small restaurants, cafes and food stalls",
                "Home businesses and independent sellers",
                "Freelancers and service providers",
              ].map((item) => (
                <li key={item} className="flex gap-3">
                  <span className="text-indigo">✓</span>
                  <span>{item}</span>
                </li>
              ))}
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Keep your data safe</h2>
            <div className="rounded-lg border-l-4 border-saffron bg-saffron/10 p-4">
              <p className="text-sm text-muted">
                <strong>Important:</strong> your data lives only in this browser. If you clear
                site data or uninstall the browser, it is gone. Export a backup (Settings →
                Backup) regularly and keep the file somewhere safe — restoring it brings back
                everything.
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">
              Need more? Try Setu&apos;s full POS
            </h2>
            <p className="mb-4 text-muted">
              When you outgrow a single browser — multiple counters, cloud sync, staff accounts,
              GST reports — take a look at our full products:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/products/restaurant-pos"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Setu Dine (Restaurant POS)
              </a>
              <a
                href="/products/retail"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Setu Retail
              </a>
              <a
                href="/tools/invoice-generator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Invoice Generator
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
