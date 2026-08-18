"use client";

// Several keywords in one condition, matched with OR.
// ---------------------------------------------------------------------------
// A category is usually a list of merchants, not a single one. Typing Enter or
// a comma turns what you have typed into a chip, so "Business Meals" is one
// condition reading "narration contains any of Swiggy, Zomato, Dominos" rather
// than three separate rules that all have to be kept in step.

import { useState, type KeyboardEvent } from "react";
import { X } from "lucide-react";

export function KeywordInput({
  values,
  onChange,
  placeholder,
  ariaLabel,
}: {
  values: string[];
  onChange: (values: string[]) => void;
  placeholder?: string;
  ariaLabel?: string;
}) {
  const [draft, setDraft] = useState("");

  const commit = (raw: string) => {
    // Pasting a comma-separated list adds every entry at once.
    const additions = raw
      .split(",")
      .map((entry) => entry.trim())
      .filter((entry) => entry !== "" && !values.includes(entry));
    if (additions.length === 0) return;
    onChange([...values, ...additions]);
  };

  const onKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      commit(draft);
      setDraft("");
      return;
    }
    // Backspace on an empty box removes the last chip.
    if (event.key === "Backspace" && draft === "" && values.length > 0) {
      onChange(values.slice(0, -1));
    }
  };

  return (
    <div
      className="flex w-full flex-wrap items-center gap-1.5 rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 transition focus-within:border-indigo focus-within:ring-2 focus-within:ring-indigo/20"
    >
      {values.map((value) => (
        <span
          key={value}
          className="inline-flex items-center gap-1 rounded-md bg-indigo/10 py-0.5 pl-2 pr-1 text-xs font-semibold text-indigo"
        >
          {value}
          <button
            type="button"
            onClick={() => onChange(values.filter((entry) => entry !== value))}
            className="rounded p-0.5 transition hover:bg-indigo/20"
            aria-label={`Remove ${value}`}
          >
            <X className="h-3 w-3" aria-hidden="true" />
          </button>
        </span>
      ))}

      <input
        value={draft}
        onChange={(event) => setDraft(event.target.value)}
        onKeyDown={onKeyDown}
        // Losing focus should not quietly discard what was typed.
        onBlur={() => {
          commit(draft);
          setDraft("");
        }}
        placeholder={values.length === 0 ? placeholder : "Add another…"}
        aria-label={ariaLabel}
        className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-sm text-ink outline-none placeholder:text-muted/70"
      />
    </div>
  );
}
