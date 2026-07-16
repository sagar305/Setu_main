import type { Metadata } from "next";
import { UpiQrGeneratorTool } from "@/components/tools/UpiQrGenerator/UpiQrGeneratorTool";

export const metadata: Metadata = {
  title: "Free Dynamic UPI QR Generator | Instant Payment Codes",
  description:
    "Generate dynamic UPI QR codes instantly. Enter your UPI ID, amount, and notes to create QR codes for quick payments. No signup required.",
  keywords: [
    "UPI QR generator",
    "dynamic QR code",
    "UPI payment QR",
    "free QR generator",
    "instant payment QR",
    "UPI deep link",
    "payment QR code",
  ],
  alternates: {
    canonical: "/tools/upi-qr-generator",
  },
  openGraph: {
    title: "Free Dynamic UPI QR Generator",
    description:
      "Generate custom UPI QR codes with amounts and notes instantly. Share for quick payments.",
    url: "/tools/upi-qr-generator",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology UPI QR Generator",
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
      name: "What is a dynamic UPI QR code?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A dynamic UPI QR code is a customized code that includes your UPI ID, payment amount, and reference notes. When scanned, it automatically fills in payment details in any UPI app, making payments faster and more convenient.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to sign up?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No! This UPI QR code generator is completely free with no signup required. Generate as many QR codes as you need instantly.",
      },
    },
    {
      "@type": "Question",
      name: "How do I use the generated QR code?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Download the QR code and display it in your store, restaurant, or invoice. Customers can scan it with any UPI app (Google Pay, PhonePe, Paytm, etc.) to make instant payments.",
      },
    },
    {
      "@type": "Question",
      name: "Can I specify the payment amount?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! You can optionally include a fixed payment amount in the QR code. This will pre-fill the amount when the customer opens their UPI app.",
      },
    },
    {
      "@type": "Question",
      name: "What UPI providers are supported?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Our generator supports all major Indian UPI providers including SBI, ICICI, HDFC, Axis, IDFC, Kotak, Airtel Payments Bank, Google Pay, PhonePe, Paytm, and 80+ other banks and payment apps.",
      },
    },
  ],
};

export default function UpiQrGeneratorPage() {
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
            Dynamic UPI QR Generator
          </h1>
          <p className="mt-4 text-xl text-muted">
            Generate custom UPI QR codes with amounts and notes. Share instantly for quick payments.
          </p>
        </div>
      </section>

      {/* UPI QR Generator */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <UpiQrGeneratorTool />
      </section>

      {/* Features Section */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">
            Why Use Setu UPI QR Generator?
          </h2>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">⚡</div>
              <h3 className="mb-2 font-bold text-ink">Instant Generation</h3>
              <p className="text-sm text-muted">
                Generate QR codes instantly. No signup, no delays. Create as many codes as you need.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🎯</div>
              <h3 className="mb-2 font-bold text-ink">Customizable</h3>
              <p className="text-sm text-muted">
                Set payment amounts and add reference notes. Perfect for bills, invoices, or fixed pricing.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🏦</div>
              <h3 className="mb-2 font-bold text-ink">All Banks Supported</h3>
              <p className="text-sm text-muted">
                Works with all major Indian banks and UPI apps. Your customers can pay from any app.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📱</div>
              <h3 className="mb-2 font-bold text-ink">Mobile-Friendly</h3>
              <p className="text-sm text-muted">
                Works perfectly on mobile, tablet, and desktop. Download and share instantly.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🔐</div>
              <h3 className="mb-2 font-bold text-ink">Secure & Private</h3>
              <p className="text-sm text-muted">
                All QR generation happens on your device. Your UPI ID never reaches our servers.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">💾</div>
              <h3 className="mb-2 font-bold text-ink">Download & Share</h3>
              <p className="text-sm text-muted">
                Download QR codes as images or copy the UPI deep link. Use anywhere you want.
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
            <p className="mb-4 text-muted">
              Follow these simple steps to generate a UPI QR code:
            </p>
            <ol className="space-y-3 text-muted">
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  1
                </span>
                <span>Enter your UPI ID (e.g., yourname@upi)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  2
                </span>
                <span>Optionally add a payment amount</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  3
                </span>
                <span>Add reference notes (optional)</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  4
                </span>
                <span>Download the QR code or copy the UPI link</span>
              </li>
              <li className="flex gap-3">
                <span className="flex h-6 w-6 items-center justify-center rounded-full bg-indigo text-sm font-semibold text-white">
                  5
                </span>
                <span>Share with customers or display in your store</span>
              </li>
            </ol>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Where can I use UPI QR codes?</h2>
            <ul className="space-y-2 text-muted">
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Display in your restaurant, café, or retail store</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Add to your invoices or bills</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Share on WhatsApp or social media</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Include in email communication</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Print and put on delivery packages</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Related Tools</h2>
            <p className="mb-4 text-muted">
              Check out our other business tools:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/tools/invoice-generator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Invoice Generator
              </a>
              <a
                href="/calculators/gst-calculator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                GST Calculator
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
