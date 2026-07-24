"use client";

import { useEffect, useState } from "react";

export type TocHeading = { id: string; text: string; level: 2 | 3 };

export function BlogTableOfContents({ headings }: { headings: TocHeading[] }) {
  const [activeId, setActiveId] = useState<string>(headings[0]?.id ?? "");

  useEffect(() => {
    if (headings.length === 0) return;

    const observer = new IntersectionObserver(
      (entries) => {
        const visible = entries
          .filter((entry) => entry.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { rootMargin: "-96px 0px -70% 0px", threshold: 0 },
    );

    for (const heading of headings) {
      const el = document.getElementById(heading.id);
      if (el) observer.observe(el);
    }
    return () => observer.disconnect();
  }, [headings]);

  const handleClick = (event: React.MouseEvent<HTMLAnchorElement>, id: string) => {
    event.preventDefault();
    const el = document.getElementById(id);
    if (!el) return;
    const top = el.getBoundingClientRect().top + window.scrollY - 96;
    window.scrollTo({ top, behavior: "smooth" });
    setActiveId(id);
    history.replaceState(null, "", `#${id}`);
  };

  if (headings.length === 0) return null;

  return (
    <nav aria-label="On this page" className="text-sm">
      <p className="mb-3 text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">On this page</p>
      <ul className="space-y-1 border-l border-muted-line/30">
        {headings.map((heading) => {
          const isActive = heading.id === activeId;
          return (
            <li key={heading.id}>
              <a
                href={`#${heading.id}`}
                onClick={(event) => handleClick(event, heading.id)}
                className={`-ml-px block border-l-2 py-1 leading-snug transition ${
                  heading.level === 3 ? "pl-6" : "pl-4"
                } ${
                  isActive
                    ? "border-indigo font-semibold text-indigo"
                    : "border-transparent text-muted hover:border-muted-line hover:text-ink"
                }`}
              >
                {heading.text}
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
