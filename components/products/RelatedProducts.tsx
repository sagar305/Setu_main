import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { tbAnalyserHidden } from "@/lib/featureFlags";

/**
 * Cross-links between products that belong together, so a reader on any one of
 * them can reach the others:
 *  - shops: the free Browser Based POS and the paid Setu Retail it grows into;
 *  - accounting: Bank Statement Analyzer, Setu Workflow and TB Analyser.
 */
type RelatedProduct = {
  id: string;
  name: string;
  tag: string;
  text: string;
  href: string;
  cta: string;
};

const GROUPS = {
  shop: {
    headline: "Free to start, room to grow",
    products: [
      {
        id: "browser-based-pos",
        name: "Browser Based POS",
        tag: "Free forever",
        text: "One counter, no login, works offline. Billing, stock, udhaar and reports with the data kept on your device.",
        href: "/products/browser-based-pos",
        cta: "Open the free POS",
      },
      {
        id: "retail",
        name: "Setu Retail",
        tag: "3 months free",
        text: "The cloud POS for more counters and branches, with owner, manager and cashier logins. Import your free POS backup in one step.",
        href: "/products/retail",
        cta: "Explore Setu Retail",
      },
    ],
  },
  accounting: {
    headline: "Tools for CA/CPA and accounting firms",
    products: [
      {
        id: "bank-statement-analyzer",
        name: "Bank Statement Analyzer",
        tag: "Free",
        text: "Import a client's statement, classify every transaction and reconcile against the ledger — nothing is uploaded.",
        href: "/products/bank-statement-analyzer",
        cta: "Open the Analyzer",
      },
      {
        id: "workflow",
        name: "Setu Workflow",
        tag: "Waiting list",
        text: "Practice management for the firm: engagements, stages, checklists, review points, time and capacity in one place.",
        href: "/products/workflow",
        cta: "Explore Setu Workflow",
      },
      {
        id: "tb-analyzer",
        name: "TB Analyser",
        tag: "Free",
        text: "Up to three periods of a client's trial balance: statements, ratios, variances and a review pack, all in your browser.",
        href: "/products/tb-analyzer",
        cta: "Open TB Analyser",
      },
    ],
  },
} satisfies Record<string, { headline: string; products: RelatedProduct[] }>;

export function RelatedProducts({ group, current }: { group: keyof typeof GROUPS; current: string }) {
  const { headline, products } = GROUPS[group];
  const others = products.filter((p) => p.id !== current && !(p.id === "tb-analyzer" && tbAnalyserHidden()));
  if (others.length === 0) return null;

  return (
    <section aria-labelledby={`related-${group}`} className="border-t border-muted-line/20 bg-white py-16">
      <div className="mx-auto max-w-5xl px-6">
        <h2 id={`related-${group}`} className="text-center text-2xl font-bold tracking-tight text-ink">
          {headline}
        </h2>
        <div className={`mt-8 grid gap-6 ${others.length > 1 ? "sm:grid-cols-2" : "mx-auto max-w-xl"}`}>
          {others.map((product) => (
            <Link
              key={product.id}
              prefetch={false}
              href={product.href}
              className="group flex h-full flex-col rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm transition duration-300 hover:-translate-y-1 hover:border-indigo/30 hover:shadow-md"
            >
              <div className="flex items-start justify-between gap-3">
                <h3 className="text-lg font-bold text-ink">{product.name}</h3>
                <span className="whitespace-nowrap rounded-full bg-saffron/20 px-3 py-1 text-xs font-semibold text-ink">{product.tag}</span>
              </div>
              <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{product.text}</p>
              <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo">
                {product.cta}
                <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
              </span>
            </Link>
          ))}
        </div>
      </div>
    </section>
  );
}
