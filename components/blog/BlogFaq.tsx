"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import type { BlogFaqItem } from "@/lib/blog";

export function BlogFaq({ items }: { items: BlogFaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  if (items.length === 0) return null;

  return (
    <section className="mt-14 border-t border-muted-line/30 pt-10">
      <h2 className="text-2xl font-bold tracking-tight text-ink">Frequently asked questions</h2>
      <div className="mt-6 divide-y divide-muted-line/30 border-y border-muted-line/30">
        {items.map((item, index) => {
          const isOpen = open === index;
          return (
            <div key={item.question}>
              <button
                type="button"
                onClick={() => setOpen(isOpen ? null : index)}
                aria-expanded={isOpen}
                className="flex w-full items-center justify-between gap-4 py-4 text-left"
              >
                <span className="font-semibold text-ink">{item.question}</span>
                <ChevronDown
                  className={`h-5 w-5 shrink-0 text-muted-warm transition-transform ${isOpen ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
              </button>
              {isOpen && <p className="pb-4 text-sm leading-relaxed text-muted">{item.answer}</p>}
            </div>
          );
        })}
      </div>
    </section>
  );
}
