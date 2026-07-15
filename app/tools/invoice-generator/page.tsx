import type { Metadata } from "next";
import { InvoiceGeneratorTool } from "@/components/tools/InvoiceGenerator/InvoiceGeneratorTool";

export const metadata: Metadata = {
  title: "Free Invoice Generator - GST Compliant Invoices",
  description:
    "Create professional GST-compliant invoices for free. No signup required. Features: multiple templates, automatic calculations, UPI support, and instant PDF download.",
  keywords: [
    "free invoice generator",
    "invoice maker",
    "GST invoice",
    "invoice template",
    "free invoice",
    "online invoice generator",
    "India invoice",
  ],
  alternates: {
    canonical: "/tools/invoice-generator",
  },
  openGraph: {
    title: "Free Invoice Generator - GST Compliant",
    description:
      "Create professional invoices with GST calculations. No login needed. Download as PDF instantly.",
    url: "/tools/invoice-generator",
    type: "website",
    images: [
      {
        url: "/og/setu-og-image-1200x627.png",
        width: 1200,
        height: 627,
        alt: "Setu Technology Invoice Generator",
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
      name: "What is a GST-compliant invoice?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "A GST-compliant invoice includes your GSTIN, the client's GSTIN, line item details with tax rates, and a breakdown of tax (CGST/SGST or IGST). Our invoice generator automatically handles all calculations.",
      },
    },
    {
      "@type": "Question",
      name: "Do I need to sign up or login?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "No! This invoice generator is completely free with no signup required. Your invoice data is saved locally in your browser using localStorage for convenient repeat use.",
      },
    },
    {
      "@type": "Question",
      name: "Can I download invoices as PDF?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! Click the 'Download PDF' button to instantly generate and download your invoice. All PDF generation happens on your device—your data never reaches our servers.",
      },
    },
    {
      "@type": "Question",
      name: "What payment methods can I show on invoices?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "You can add bank account details (account number, IFSC code) and UPI ID. The invoice will display these payment options for your clients.",
      },
    },
    {
      "@type": "Question",
      name: "Are there different invoice templates?",
      acceptedAnswer: {
        "@type": "Answer",
        text: "Yes! We offer 3 professionally designed templates: Classic (formal), Modern (minimal), and Colorful (creative). You can customize the brand color for each template.",
      },
    },
  ],
};

export default function InvoiceGeneratorPage() {
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
            Free Invoice Generator
          </h1>
          <p className="mt-4 text-xl text-muted">
            Create professional GST-compliant invoices instantly. No signup required.
          </p>
        </div>
      </section>

      {/* Invoice Generator */}
      <section className="mx-auto max-w-6xl px-6 pb-12">
        <InvoiceGeneratorTool />
      </section>

      {/* Features Section */}
      <section className="border-t border-muted-line/20 bg-cream-paper py-16">
        <div className="mx-auto max-w-6xl px-6">
          <h2 className="mb-12 text-center text-3xl font-bold text-ink">Why Use Setu Invoice Generator?</h2>

          <div className="grid gap-8 sm:grid-cols-3">
            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🎨</div>
              <h3 className="mb-2 font-bold text-ink">Multiple Templates</h3>
              <p className="text-sm text-muted">
                Choose from 3 professionally designed templates and customize with your brand color.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">⚡</div>
              <h3 className="mb-2 font-bold text-ink">Auto-Save</h3>
              <p className="text-sm text-muted">
                Your invoice data is automatically saved to your browser. Create invoices faster next time.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📊</div>
              <h3 className="mb-2 font-bold text-ink">GST Calculations</h3>
              <p className="text-sm text-muted">
                Automatic GST calculations with CGST/SGST split, support for multiple tax rates per line item.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">📱</div>
              <h3 className="mb-2 font-bold text-ink">Mobile-Friendly</h3>
              <p className="text-sm text-muted">
                Create and send invoices from your phone, tablet, or desktop. Works everywhere.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🔐</div>
              <h3 className="mb-2 font-bold text-ink">Privacy First</h3>
              <p className="text-sm text-muted">
                All PDF generation happens on your device. Your invoice data never reaches our servers.
              </p>
            </div>

            <div className="rounded-xl border border-muted-line/20 bg-white p-6 shadow-sm">
              <div className="mb-4 text-3xl">🎯</div>
              <h3 className="mb-2 font-bold text-ink">India-Specific</h3>
              <p className="text-sm text-muted">
                Built for Indian SMBs. GSTIN validation, CGST/SGST split, UPI IDs, and amount in words (lakh/crore).
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* Info Section */}
      <section className="mx-auto max-w-4xl px-6 py-16">
        <div className="space-y-8">
          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">What fields should an invoice include?</h2>
            <p className="mb-4 text-muted">
              A professional invoice should include:
            </p>
            <ul className="space-y-2 text-muted">
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Business name, address, phone, and email</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Client name and address</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Invoice number and date</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Itemized list of products/services with quantities and rates</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Applicable taxes (GST in India)</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Total amount and payment terms</span>
              </li>
              <li className="flex gap-3">
                <span className="text-indigo">✓</span>
                <span>Payment details (bank account, UPI, etc.)</span>
              </li>
            </ul>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">GST Compliance</h2>
            <div className="rounded-lg border-l-4 border-saffron bg-saffron/10 p-4">
              <p className="text-sm text-muted">
                <strong>Disclaimer:</strong> This invoice generator is a formatting and calculation tool only. It does not file GST returns or ensure compliance with all tax regulations. For tax advice and filing, please consult with your accountant or tax professional.
              </p>
            </div>
          </div>

          <div>
            <h2 className="mb-4 text-2xl font-bold text-ink">Related Tools</h2>
            <p className="mb-4 text-muted">
              Check out our other business calculators:
            </p>
            <div className="flex flex-wrap gap-3">
              <a
                href="/calculators/gst-calculator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                GST Calculator
              </a>
              <a
                href="/calculators/income-tax-calculator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Income Tax Calculator
              </a>
              <a
                href="/calculators/profit-margin-calculator"
                className="inline-block rounded-lg border border-indigo/30 px-4 py-2 text-sm font-semibold text-indigo transition hover:bg-indigo/5"
              >
                Profit Margin Calculator
              </a>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
