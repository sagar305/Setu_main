"use client";

// Every invoice raised, and what is still owed on them.
//
// The board answers "where is this device"; this answers "what did we bill and
// did they pay". They are different questions asked by different people at
// different times of day, which is why the bills are not just a column on the
// board.

import { useMemo, useState } from "react";
import { Download, FileText, Printer, Share2 } from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import { billDue } from "@/lib/repair/calc";
import { billsCsv, downloadCsv } from "@/lib/repair/csv";
import { billShareUrl } from "@/lib/repair/share";
import { printInvoice } from "@/lib/repair/print";
import { deviceLabel, formatDate, todayKey } from "@/lib/repair/types";
import { formatMoney } from "@/lib/pos/types";
import {
  EmptyState,
  Pill,
  SearchInput,
  StatCard,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function BillingScreen({ onOpenJob }: { onOpenJob: (id: string) => void }) {
  const { bills, jobs, customers, technicians, settings, business } = useRepair();
  const currency = business?.currency ?? "INR";
  const [search, setSearch] = useState("");
  const [copied, setCopied] = useState("");

  const jobById = useMemo(() => new Map(jobs.map((job) => [job.id, job])), [jobs]);
  const customerById = useMemo(
    () => new Map(customers.map((customer) => [customer.id, customer])),
    [customers]
  );

  const rows = useMemo(() => {
    const needle = search.trim().toLowerCase();
    const list = [...bills].sort((a, b) => b.date.localeCompare(a.date));
    if (!needle) return list;
    return list.filter((bill) => {
      const job = jobById.get(bill.jobId);
      const customer = customerById.get(bill.customerId);
      return (
        bill.invoiceNo.toLowerCase().includes(needle) ||
        (job?.jobNo ?? "").toLowerCase().includes(needle) ||
        (customer?.name ?? "").toLowerCase().includes(needle) ||
        (customer?.phone ?? "").toLowerCase().includes(needle)
      );
    });
  }, [bills, search, jobById, customerById]);

  const money = (value: number) => formatMoney(value, currency);
  const billed = rows.reduce((sum, bill) => sum + bill.total, 0);
  const collected = rows.reduce((sum, bill) => sum + bill.paid, 0);
  const outstanding = rows.reduce((sum, bill) => sum + billDue(bill), 0);

  const share = async (billId: string) => {
    const bill = bills.find((row) => row.id === billId);
    const job = bill ? jobById.get(bill.jobId) : null;
    if (!bill || !job) return;
    const url = billShareUrl(
      business,
      job,
      bill,
      customerById.get(bill.customerId) ?? null,
      window.location.origin
    );
    try {
      await navigator.clipboard.writeText(url);
      setCopied(billId);
      window.setTimeout(() => setCopied(""), 1600);
    } catch {
      window.open(url, "_blank", "noopener");
    }
  };

  return (
    <div className="grid gap-4">
      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label="Billed" value={money(billed)} sub={`${rows.length} invoices`} />
        <StatCard label="Collected" value={money(collected)} />
        <StatCard
          label="Outstanding"
          value={money(outstanding)}
          sub={outstanding > 0 ? "Still to be collected" : "Nothing owed"}
        />
      </div>

      <div className="flex flex-wrap items-center gap-2">
        <div className="min-w-[200px] flex-1">
          <SearchInput
            value={search}
            onChange={setSearch}
            placeholder="Invoice, job no, name or phone"
          />
        </div>
        <button
          type="button"
          onClick={() =>
            downloadCsv(`bills-${todayKey()}.csv`, billsCsv(rows, jobs, customers))
          }
          className={secondaryBtnClass}
          disabled={rows.length === 0}
        >
          <Download className="h-4 w-4" aria-hidden="true" />
          CSV
        </button>
      </div>

      {rows.length === 0 ? (
        <EmptyState
          icon={<FileText className="h-6 w-6" />}
          title={bills.length === 0 ? "No invoices yet" : "Nothing matches"}
          message={
            bills.length === 0
              ? "An invoice is raised when a device is delivered and billed."
              : "No invoice matches that search."
          }
        />
      ) : (
        <ul className="grid gap-2">
          {rows.map((bill) => {
            const job = jobById.get(bill.jobId);
            const customer = customerById.get(bill.customerId);
            const due = billDue(bill);
            return (
              <li
                key={bill.id}
                className="rounded-2xl border border-muted-line/30 bg-white p-4"
              >
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="flex flex-wrap items-center gap-2 text-sm font-bold text-ink">
                      {bill.invoiceNo}
                      {due > 0 ? (
                        <Pill tone="danger">{money(due)} due</Pill>
                      ) : (
                        <Pill tone="good">Paid</Pill>
                      )}
                    </p>
                    <p className="text-xs text-muted">
                      {formatDate(bill.date)} · {customer?.name ?? "—"}
                      {job ? ` · ${job.jobNo} · ${deviceLabel(job)}` : ""}
                    </p>
                  </div>
                  <div className="flex shrink-0 items-center gap-2">
                    <span className="text-lg font-bold text-ink">{money(bill.total)}</span>
                    <button
                      type="button"
                      onClick={() => void share(bill.id)}
                      className="rounded-lg p-2 text-muted transition hover:text-indigo"
                      aria-label={`Share invoice ${bill.invoiceNo}`}
                      title={copied === bill.id ? "Link copied" : "Copy a link to this bill"}
                    >
                      <Share2 className="h-4 w-4" />
                    </button>
                    {job && (
                      <button
                        type="button"
                        onClick={() =>
                          printInvoice({
                            business,
                            job,
                            customer: customer ?? null,
                            technician:
                              technicians.find((tech) => tech.id === job.technicianId) ?? null,
                            settings,
                            bill,
                          })
                        }
                        className="rounded-lg p-2 text-muted transition hover:text-indigo"
                        aria-label={`Print invoice ${bill.invoiceNo}`}
                      >
                        <Printer className="h-4 w-4" />
                      </button>
                    )}
                    {job && (
                      <button
                        type="button"
                        onClick={() => onOpenJob(job.id)}
                        className={`${primaryBtnClass} px-3 py-2`}
                      >
                        Open job
                      </button>
                    )}
                  </div>
                </div>
                {copied === bill.id && (
                  <p className="mt-2 text-xs font-semibold text-green-700">
                    Link copied — paste it into WhatsApp.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
