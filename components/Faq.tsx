"use client";

import { useState } from "react";
import { ChevronDown } from "lucide-react";
import { FadeIn } from "@/components/motion/FadeIn";

type FaqItem = { question: string; answer: string };

export function Faq({ headline, items }: { headline: string; items: FaqItem[] }) {
  const [open, setOpen] = useState<number | null>(0);

  return (
    <section className="bg-white py-16">
      <div className="mx-auto max-w-3xl px-6">
        <FadeIn>
          <h2 className="text-3xl font-bold tracking-tight text-ink">{headline}</h2>
        </FadeIn>

        <div className="mt-8 divide-y divide-muted-line/30 border-y border-muted-line/30">
          {items.map((item, index) => {
            const isOpen = open === index;
            return (
              <div key={item.question}>
                <button
                  type="button"
                  onClick={() => setOpen(isOpen ? null : index)}
                  aria-expanded={isOpen}
                  className="flex w-full items-center justify-between gap-4 py-5 text-left"
                >
                  <span className="font-semibold text-ink">{item.question}</span>
                  <ChevronDown
                    className={`h-5 w-5 shrink-0 text-muted-warm transition-transform ${isOpen ? "rotate-180" : ""}`}
                    aria-hidden="true"
                  />
                </button>
                {isOpen && <p className="pb-5 text-sm leading-relaxed text-muted">{item.answer}</p>}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
