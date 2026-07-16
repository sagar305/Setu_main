import type { Metadata } from "next";
import { QrMenuGeneratorTool } from "@/components/tools/QrMenuGenerator/QrMenuGeneratorTool";

export const metadata: Metadata = {
  title: "Free QR Menu Generator for Restaurants | No Signup, No Hosting",
  description:
    "Create a digital menu QR code for your restaurant in minutes. The whole menu is stored inside the QR code — no hosting, no subscription, no signup. Print and go.",
  keywords: [
    "QR menu generator",
    "digital menu QR code",
    "restaurant QR menu",
    "free QR menu",
    "contactless menu",
    "menu QR code maker",
    "digital menu for restaurants",
  ],
  alternates: {
    canonical: "/tools/qr-menu-generator",
  },
  openGraph: {
    title: "Free QR Menu Generator for Restaurants",
    description:
      "Build your menu, get a QR code, print it. The entire menu lives inside the QR — no hosting or subscription needed.",
    url: "/tools/qr-menu-generator",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology QR Menu Generator",
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
      name: "How does the QR menu work without hosting?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Your entire menu is compressed and stored inside the QR code itself. When a customer scans it, their phone opens our menu display page which reads the menu data from the QR link and renders it instantly. There is no database, no account, and nothing to expire.",
      },
    },
    {
      "@type": "Question",
      name: "Is the QR menu generator really free?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes, completely free with no signup, no subscription, and no watermark on your menu. Since the menu lives inside the QR code, we have no hosting costs to pass on to you.",
      },
    },
    {
      "@type": "Question",
      name: "How do I update my menu or prices?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Come back to this page — your menu is saved automatically in your browser. Edit the items or prices, download the new QR code, and replace the printed one. Note that a printed QR code always shows the menu it was generated with.",
      },
    },
    {
      "@type": "Question",
      name: "How many items can I fit in one QR code?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A QR code holds about 2,900 characters, and we compress your menu to make the most of it. Typically that fits 60–100 items depending on how long your descriptions are. The capacity meter shows how much room is left, and for very large menus you can create separate QR codes for food and drinks.",
      },
    },
    {
      "@type": "Question",
      name: "Can I import my menu from Excel or CSV?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes. Upload an Excel (.xlsx, .xls) or CSV file with columns for Category, Item Name, Price, Description, and Type (Veg/Non-veg) and your whole menu is filled in at once. You can also export your current menu to Excel, update prices there, and re-import it — no retyping.",
      },
    },
    {
      "@type": "Question",
      name: "Does my menu data get uploaded to a server?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No. The QR code is generated entirely in your browser, and your menu is saved only in your browser's local storage. Your menu data never touches our servers.",
      },
    },
    {
      "@type": "Question",
      name: "Do customers need to install an app?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No app needed. Any phone camera or QR scanner opens the menu directly in the browser. The menu page is lightweight and loads fast even on slow connections.",
      },
    },
  ],
};

export default function QrMenuGeneratorPage() {
  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(faqSchema) }}
      />

      {/* Page Header */}
      <section className="mx-auto max-w-6xl px-6 py-12 sm:py-16">
        <div className="text-center">
          <div className="mb-4 inline-block rounded-full bg-indigo/10 px-4 py-2">
            <span className="text-sm font-semibold text-indigo">Free Tool</span>
          </div>
          <h1 className="text-4xl font-bold tracking-tight text-ink sm:text-5xl">
            QR Menu Generator
          </h1>
          <p className="mt-4 text-xl text-muted">
            Build your digital menu and get a print-ready QR code. The whole menu is stored inside
            the QR — no hosting, no subscription, nothing to expire.
          </p>
        </div>
      </section>

      {/* Generator */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <QrMenuGeneratorTool />
      </section>

      {/* Features Section */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">
            Why Use Setu QR Menu Generator?
          </h2>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📦</div>
              <h3 className="mb-2 font-bold text-ink">Menu Lives in the QR</h3>
              <p className="text-sm text-muted">
                Your entire menu is compressed into the QR code itself. No database, no hosting
                fees, no link that stops working.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🆓</div>
              <h3 className="mb-2 font-bold text-ink">Free Forever</h3>
              <p className="text-sm text-muted">
                No signup, no subscription, no per-scan charges. Generate and reprint as many menu
                QR codes as you need.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🥗</div>
              <h3 className="mb-2 font-bold text-ink">Built for Indian Menus</h3>
              <p className="text-sm text-muted">
                Veg and non-veg markers, ₹ pricing, and categories like starters, mains, and
                beverages — ready out of the box.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🎨</div>
              <h3 className="mb-2 font-bold text-ink">Your Brand Colour</h3>
              <p className="text-sm text-muted">
                Pick a theme colour that matches your restaurant. The scanned menu page uses it for
                headers and highlights.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🔐</div>
              <h3 className="mb-2 font-bold text-ink">Private by Design</h3>
              <p className="text-sm text-muted">
                Everything happens in your browser. Your menu is saved locally on your device and
                never uploaded to our servers.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📱</div>
              <h3 className="mb-2 font-bold text-ink">No App for Customers</h3>
              <p className="text-sm text-muted">
                Customers scan with their phone camera and the menu opens in the browser — fast,
                lightweight, and mobile-first.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">How does it work?</h2>
            <ol className="space-y-3 text-muted">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  1
                </span>
                <span>Enter your restaurant name and pick a theme colour</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  2
                </span>
                <span>Add categories and dishes with prices, descriptions, and veg/non-veg tags</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  3
                </span>
                <span>Your menu is compressed and packed into the QR code automatically</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  4
                </span>
                <span>Download the print-ready QR code and place it on tables, counters, or doors</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  5
                </span>
                <span>Customers scan it and the full menu opens instantly — no app needed</span>
              </li>
            </ol>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Where can I use a QR menu?</h2>
            <ul className="space-y-2 text-muted">
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Table tents and stickers in your restaurant or café</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Cloud kitchen packaging and delivery bags</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Food stalls, food trucks, and pop-up counters</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Share the menu link directly on WhatsApp or Instagram</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Hotel room-service cards and banquet menus</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Related Tools</h2>
            <p className="mb-4 text-muted">Check out our other business tools:</p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/tools/upi-qr-generator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                UPI QR Generator
              </a>
              <a
                href="/tools/invoice-generator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Invoice Generator
              </a>
              <a
                href="/calculators/food-cost-calculator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Food Cost Calculator
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
