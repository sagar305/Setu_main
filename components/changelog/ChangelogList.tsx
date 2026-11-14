"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { CHANGE_TYPE_LABELS, type ChangeType, type ChangelogEntry } from "@/lib/changelog";

/** How far back the page shows by default, and how much more each "Load more" adds. */
const WINDOW_DAYS = 30;
const DAY_MS = 86_400_000;

const TYPE_STYLES: Record<ChangeType, string> = {
  launch: "bg-indigo text-cream-paper",
  feature: "bg-saffron/20 text-ink",
  improvement: "bg-cream text-ink",
  fix: "bg-ink/5 text-muted",
};

const time = (date: string) => Date.parse(`${date}T00:00:00Z`);

const monthLabel = (date: string) =>
  new Date(time(date)).toLocaleDateString("en-IN", { month: "long", year: "numeric", timeZone: "UTC" });

const dayLabel = (date: string) =>
  new Date(time(date)).toLocaleDateString("en-IN", { day: "numeric", month: "short", timeZone: "UTC" });

/**
 * `now` comes from the server so the first render here matches the HTML it
 * hydrates, whatever the visitor's clock says.
 */
export function ChangelogList({ entries, now }: { entries: ChangelogEntry[]; now: number }) {
  const [windows, setWindows] = useState(1);

  const cutoff = now - windows * WINDOW_DAYS * DAY_MS;
  const visible = entries.filter((e) => time(e.date) >= cutoff);
  const hasMore = visible.length < entries.length;

  // Each click reaches back at least one more window, and further when that
  // window was quiet, so "Load more" never does nothing.
  const loadMore = () => {
    const nextOlder = entries.find((e) => time(e.date) < cutoff);
    if (!nextOlder) return;
    let next = windows + 1;
    while (now - next * WINDOW_DAYS * DAY_MS > time(nextOlder.date)) next += 1;
    setWindows(next);
  };

  const months = useMemo(() => {
    const groups: { label: string; items: ChangelogEntry[] }[] = [];
    for (const entry of visible) {
      const label = monthLabel(entry.date);
      const last = groups[groups.length - 1];
      if (last?.label === label) last.items.push(entry);
      else groups.push({ label, items: [entry] });
    }
    return groups;
  }, [visible]);

  return (
    <div>
      {months.length === 0 && (
        <p className="rounded-2xl border border-muted-line/40 bg-white px-6 py-8 text-center text-muted">
          No changes shipped in the last {WINDOW_DAYS} days.
        </p>
      )}

      {months.map((month) => (
        <section key={month.label} className="mb-12 last:mb-0">
          <h2 className="mb-5 text-xs font-semibold uppercase tracking-[0.2em] text-muted-warm">
            {month.label}
          </h2>
          <ol className="flex flex-col gap-4">
            {month.items.map((entry, i) => (
              <li
                key={`${entry.date}-${i}-${entry.title}`}
                className="rounded-2xl border border-muted-line/40 bg-white p-5 sm:p-6"
              >
                <div className="flex flex-wrap items-center gap-x-3 gap-y-2 text-xs">
                  <time dateTime={entry.date} className="font-semibold text-muted">
                    {dayLabel(entry.date)}
                  </time>
                  <span className={`rounded-full px-2.5 py-0.5 font-semibold ${TYPE_STYLES[entry.type]}`}>
                    {CHANGE_TYPE_LABELS[entry.type]}
                  </span>
                  <span className="text-muted-warm">{entry.product}</span>
                </div>
                <h3 className="mt-3 text-base font-semibold text-ink sm:text-lg">{entry.title}</h3>
                {entry.description && (
                  <p className="mt-2 text-sm leading-relaxed text-muted">{entry.description}</p>
                )}
                {entry.href && (
                  <Link
                    prefetch={false}
                    href={entry.href}
                    className="mt-3 inline-block text-sm font-semibold text-indigo underline-offset-4 hover:underline"
                  >
                    See it →
                  </Link>
                )}
              </li>
            ))}
          </ol>
        </section>
      ))}

      {hasMore && (
        <div className="mt-10 text-center">
          <button
            type="button"
            onClick={loadMore}
            className="rounded-full border border-ink px-6 py-3 text-sm font-semibold text-ink transition hover:bg-ink hover:text-cream-paper"
          >
            Load more
          </button>
        </div>
      )}
    </div>
  );
}
