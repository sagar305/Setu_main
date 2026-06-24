import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { CalculatorIcon } from "@/components/calculators/CalculatorIcon";
import type { CalculatorItem } from "@/lib/content";

export function CalculatorCard({ item }: { item: CalculatorItem }) {
  return (
    <Link
      href={`/calculators/${item.slug}`}
      className="group flex flex-col rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm transition hover:-translate-y-0.5 hover:border-indigo/30 hover:shadow-md"
    >
      <span className="flex h-11 w-11 items-center justify-center rounded-xl bg-cream text-indigo">
        <CalculatorIcon name={item.icon} className="h-5 w-5" />
      </span>
      <h3 className="mt-4 text-lg font-bold text-ink">{item.name}</h3>
      <p className="mt-2 flex-1 text-sm leading-relaxed text-muted">{item.shortDescription}</p>
      <span className="mt-4 inline-flex items-center gap-1.5 text-sm font-semibold text-indigo">
        Try it
        <ArrowRight className="h-4 w-4 transition group-hover:translate-x-0.5" aria-hidden="true" />
      </span>
    </Link>
  );
}
