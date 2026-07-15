"use client";

import { ChevronDown } from "lucide-react";

interface AccordionSectionProps {
  title: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}

export function AccordionSection({
  title,
  icon,
  isOpen,
  onToggle,
  children,
}: AccordionSectionProps) {
  return (
    <div className="border-b border-muted-line/20">
      <button
        onClick={onToggle}
        className="flex w-full items-center justify-between px-6 py-4 transition hover:bg-cream/30"
      >
        <div className="flex items-center gap-3">
          <div className="text-indigo">{icon}</div>
          <h3 className="text-sm font-semibold uppercase tracking-wider text-ink">
            {title}
          </h3>
        </div>
        <ChevronDown
          className={`h-5 w-5 text-muted transition-transform ${
            isOpen ? "rotate-180" : ""
          }`}
        />
      </button>
      {isOpen && (
        <div className="space-y-6 border-t border-muted-line/20 bg-cream/10 px-6 py-6">
          {children}
        </div>
      )}
    </div>
  );
}
