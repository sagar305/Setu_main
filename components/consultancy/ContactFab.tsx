"use client";

import { useEffect, useState } from "react";
import { MessageCircle } from "lucide-react";

/**
 * The floating "Contact us" button on the consultancy page.
 *
 * It scrolls to the enquiry form at the foot of the page rather than leaving
 * it, and steps aside while the form itself is on screen, so it never sits on
 * top of the fields it points at.
 */
export function ContactFab({ label, targetId }: { label: string; targetId: string }) {
  const [formVisible, setFormVisible] = useState(false);

  useEffect(() => {
    const target = document.getElementById(targetId);
    if (!target || typeof IntersectionObserver === "undefined") return;
    const observer = new IntersectionObserver(
      ([entry]) => setFormVisible(entry.isIntersecting),
      { threshold: 0.15 },
    );
    observer.observe(target);
    return () => observer.disconnect();
  }, [targetId]);

  function handleClick(event: React.MouseEvent<HTMLAnchorElement>) {
    const target = document.getElementById(targetId);
    if (!target) return;
    event.preventDefault();
    const reduceMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    target.scrollIntoView({ behavior: reduceMotion ? "auto" : "smooth", block: "start" });
    // Move focus to the first field so keyboard and screen-reader users land in
    // the form too, not just the eye.
    const firstField = target.querySelector<HTMLElement>("input, select, textarea");
    window.setTimeout(() => firstField?.focus({ preventScroll: true }), reduceMotion ? 0 : 500);
    history.replaceState(null, "", `#${targetId}`);
  }

  return (
    <a
      href={`#${targetId}`}
      onClick={handleClick}
      aria-hidden={formVisible || undefined}
      tabIndex={formVisible ? -1 : undefined}
      className={`fixed bottom-5 right-5 z-40 inline-flex items-center gap-2 rounded-full bg-saffron px-5 py-3 text-sm font-semibold text-ink shadow-lg transition duration-300 hover:brightness-95 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-indigo sm:bottom-6 sm:right-6 ${
        formVisible ? "pointer-events-none translate-y-4 opacity-0" : "translate-y-0 opacity-100"
      }`}
    >
      <MessageCircle className="h-4 w-4" aria-hidden="true" />
      {label}
    </a>
  );
}
