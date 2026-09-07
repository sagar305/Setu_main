"use client";

// §3.5 — warranty is not a screen, it is a question asked at the counter.
//
// Someone walks in holding a phone and says "you fixed this last month". The
// only thing that matters in the next fifteen seconds is whether that is true
// and whether it is still covered. So: one box, three ways of finding the job
// (job number, IMEI, phone), and a plain yes or no with a date.
//
// The claim is raised from here too, because the moment you have the answer is
// the moment you act on it.

import { useMemo, useState } from "react";
import { Search, ShieldCheck, ShieldQuestion, ShieldX } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import { warrantyDaysLeft, warrantyEndOf, warrantyStateOf } from "@/lib/repair/calc";
import { deviceLabel, formatDate } from "@/lib/repair/types";
import { Modal, inputClass, primaryBtnClass, secondaryBtnClass } from "./ui";

export function WarrantyLookup({
  open,
  onClose,
  onOpenJob,
}: {
  open: boolean;
  onClose: () => void;
  onOpenJob: (id: string) => void;
}) {
  const { jobs, customers, today, raiseWarrantyClaim } = useRepair();
  const [query, setQuery] = useState("");
  const [error, setError] = useState("");

  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  /**
   * Delivered jobs only, newest first.
   *
   * A job still on the bench has no warranty to look up — the clock starts at
   * delivery — and showing one here would answer a different question than the
   * one being asked.
   */
  const matches = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return [];
    return jobs
      .filter((job) => job.deliveredOn)
      .filter((job) => {
        const customer = customerById.get(job.customerId);
        return (
          job.jobNo.toLowerCase().includes(needle) ||
          job.serialNo.toLowerCase().includes(needle) ||
          (customer?.phone ?? "").toLowerCase().includes(needle) ||
          (customer?.name ?? "").toLowerCase().includes(needle)
        );
      })
      .sort((a, b) => (b.deliveredOn ?? "").localeCompare(a.deliveredOn ?? ""))
      .slice(0, 8);
  }, [jobs, query, customerById]);

  return (
    <Modal open={open} onClose={onClose} title="Check a warranty" wide>
      <p className="text-sm text-muted">
        Job number, IMEI or the customer&apos;s phone number — whichever they can tell you.
      </p>

      <div className="relative mt-3">
        <Search
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60"
          aria-hidden="true"
        />
        <input
          className={`${inputClass} pl-9`}
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="JC-0412, 8698… or 98765 43210"
          autoFocus
        />
      </div>

      {query.trim() && matches.length === 0 && (
        <p className="mt-4 rounded-xl bg-cream-paper p-4 text-center text-sm text-muted">
          No delivered job matches that. If the device was repaired here, try the IMEI.
        </p>
      )}

      <ul className="mt-4 grid gap-2">
        {matches.map((job) => {
          const state = warrantyStateOf(job, today);
          const end = warrantyEndOf(job);
          const left = warrantyDaysLeft(job, today);
          const customer = customerById.get(job.customerId);

          const banner =
            state === "covered"
              ? {
                  icon: ShieldCheck,
                  className: "border-green-300 bg-green-50 text-green-900",
                  text: `Covered until ${formatDate(end)} — ${left} ${left === 1 ? "day" : "days"} left`,
                }
              : state === "expired"
                ? {
                    icon: ShieldX,
                    className: "border-red-200 bg-red-50 text-red-800",
                    text: `Warranty ended ${formatDate(end)}`,
                  }
                : {
                    icon: ShieldQuestion,
                    className: "border-muted-line/40 bg-white text-muted",
                    text: "No warranty was given on this repair",
                  };

          return (
            <li key={job.id} className="rounded-2xl border border-muted-line/30 bg-white p-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="text-sm font-bold text-ink">
                    {job.jobNo} · {deviceLabel(job)}
                  </p>
                  <p className="text-xs text-muted">
                    {customer?.name ?? "—"} · delivered{" "}
                    {job.deliveredOn ? formatDate(job.deliveredOn) : "—"}
                    {job.serialNo ? ` · ${job.serialNo}` : ""}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => {
                    onOpenJob(job.id);
                    onClose();
                  }}
                  className={secondaryBtnClass}
                >
                  Open job
                </button>
              </div>

              <p
                className={`mt-3 flex items-center gap-2 rounded-lg border p-2.5 text-sm font-semibold ${banner.className}`}
              >
                <banner.icon className="h-4 w-4 shrink-0" aria-hidden="true" />
                {banner.text}
              </p>

              {state === "covered" && (
                <button
                  type="button"
                  onClick={async () => {
                    setError("");
                    try {
                      const claim = await raiseWarrantyClaim(job.id);
                      onOpenJob(claim.id);
                      onClose();
                    } catch (caught) {
                      setError(
                        caught instanceof Error ? caught.message : "Could not raise the claim."
                      );
                    }
                  }}
                  className={`${primaryBtnClass} mt-3`}
                >
                  <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
                  Take it back in under warranty
                </button>
              )}
            </li>
          );
        })}
      </ul>

      {error && (
        <p className="mt-3 text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}
    </Modal>
  );
}
