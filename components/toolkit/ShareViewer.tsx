"use client";

// Public read-only viewer for a shared document. Decodes the #d=<payload>
// fragment (client-side only — the data never reaches a server) and renders
// the invoice / quotation / reminder / appointment, with a UPI pay control
// when an amount is owed and the business has a UPI ID.

import { useEffect, useState } from "react";
import {
  decodeDoc,
  docTitle,
  payableAmount,
  type ShareBusiness,
  type ShareLineItem,
  type SharedDoc,
} from "@/lib/toolkit/shareLink";
import { formatMoney } from "@/lib/pos/types";
import { supportsUpi } from "@/lib/upi";
import { UpiPayButton } from "@/components/toolkit/UpiPayButton";

function BusinessHeader({ b, accent = "#26306B" }: { b: ShareBusiness; accent?: string }) {
  return (
    <div className="border-b border-muted-line/30 pb-4 text-center">
      {b.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
      ) : null}
      <h1 className="text-xl font-bold" style={{ color: accent }}>
        {b.n}
      </h1>
      {b.a ? <p className="mt-1 text-sm text-muted">{b.a}</p> : null}
      <p className="text-sm text-muted">
        {[b.p, b.g ? `GSTIN: ${b.g}` : ""].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function ItemsTable({ items, currency }: { items: ShareLineItem[]; currency: string }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-muted-line/30 text-left text-muted">
            <th className="py-2 pr-3 font-semibold">Item</th>
            <th className="py-2 pr-3 text-right font-semibold">Qty</th>
            <th className="py-2 pr-3 text-right font-semibold">Rate</th>
            <th className="py-2 text-right font-semibold">Amount</th>
          </tr>
        </thead>
        <tbody>
          {items.map((it, i) => (
            <tr key={i} className="border-b border-muted-line/20">
              <td className="py-2 pr-3 text-ink">{it.n}</td>
              <td className="py-2 pr-3 text-right text-muted">{it.q}</td>
              <td className="py-2 pr-3 text-right text-muted">{formatMoney(it.r, currency)}</td>
              <td className="py-2 text-right text-ink">
                {formatMoney(it.q * it.r * (1 + (it.x ?? 0) / 100), currency)}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

function Row({ label, value, bold }: { label: string; value: string; bold?: boolean }) {
  return (
    <div className={`flex justify-between ${bold ? "text-base font-bold text-ink" : "text-sm text-muted"}`}>
      <span>{label}</span>
      <span>{value}</span>
    </div>
  );
}

export function ShareViewer() {
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const read = () => setDoc(decodeDoc(window.location.hash || window.location.search));
    read();
    setReady(true);
    // Re-decode if the fragment changes (e.g. the link is edited in place).
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, []);

  if (!ready) return null;

  if (!doc) {
    return (
      <div className="mx-auto max-w-md rounded-2xl border border-muted-line/30 bg-white p-8 text-center">
        <h1 className="text-lg font-bold text-ink">This link is empty or broken</h1>
        <p className="mt-2 text-sm text-muted">
          The document data lives inside the link itself. Ask the sender to share it again — the full
          link may have been cut off.
        </p>
      </div>
    );
  }

  const b = doc.b;
  const currency = b.cur;
  const amount = payableAmount(doc);
  const payNote =
    doc.t === "inv" || doc.t === "quo" || doc.t === "fee"
      ? doc.no
      : doc.t === "led"
        ? "Payment"
        : doc.t === "apt"
          ? "Advance"
          : "Payment";

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm">
        <BusinessHeader b={b} />

        <h2 className="mt-4 text-center text-lg font-bold text-ink">{docTitle(doc)}</h2>

        {doc.t === "inv" ? (
          <>
            <div className="mt-3 flex justify-between text-sm text-muted">
              <span>{doc.no}</span>
              <span>{doc.dt?.slice(0, 10)}</span>
            </div>
            {doc.cn ? <p className="mt-1 text-sm text-ink">Billed to: {doc.cn}</p> : null}
            <div className="my-4">
              <ItemsTable items={doc.it} currency={currency} />
            </div>
            <div className="space-y-1">
              <Row label="Subtotal" value={formatMoney(doc.sub, currency)} />
              {doc.dis ? <Row label="Discount" value={`-${formatMoney(doc.dis, currency)}`} /> : null}
              {doc.tax ? <Row label="Tax" value={formatMoney(doc.tax, currency)} /> : null}
              <Row label="Total" value={formatMoney(doc.tot, currency)} bold />
              {doc.pm ? <Row label="Payment" value={doc.pm} /> : null}
            </div>
          </>
        ) : null}

        {doc.t === "quo" ? (
          <>
            <div className="mt-3 flex justify-between text-sm text-muted">
              <span>{doc.no}</span>
              <span>{doc.dt?.slice(0, 10)}</span>
            </div>
            {doc.vu ? (
              <p className="mt-1 text-center text-xs font-semibold text-indigo">
                Valid until {doc.vu.slice(0, 10)}
              </p>
            ) : null}
            {doc.cn ? <p className="mt-2 text-sm text-ink">For: {doc.cn}</p> : null}
            <div className="my-4">
              <ItemsTable items={doc.it} currency={currency} />
            </div>
            <div className="space-y-1">
              <Row label="Subtotal" value={formatMoney(doc.sub, currency)} />
              {doc.tax ? <Row label="Tax" value={formatMoney(doc.tax, currency)} /> : null}
              <Row label="Total" value={formatMoney(doc.tot, currency)} bold />
            </div>
            {doc.note ? <p className="mt-3 text-xs text-muted">{doc.note}</p> : null}
          </>
        ) : null}

        {doc.t === "led" ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-ink">Dear {doc.cn},</p>
            <p className="mt-2 text-sm text-muted">Your outstanding balance is</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{formatMoney(doc.bal, currency)}</p>
            {doc.note ? <p className="mt-3 text-xs text-muted">{doc.note}</p> : null}
          </div>
        ) : null}

        {doc.t === "apt" ? (
          <div className="mt-4 space-y-2 text-sm">
            <Row label="For" value={doc.cn} />
            <Row label="Service" value={doc.svc} />
            <Row label="Date" value={doc.dt.slice(0, 10)} />
            <Row label="Time" value={doc.tm} />
            {doc.dur ? <Row label="Duration" value={`${doc.dur} min`} /> : null}
            {doc.note ? <p className="pt-1 text-xs text-muted">{doc.note}</p> : null}
          </div>
        ) : null}

        {doc.t === "fee" ? (
          <>
            <div className="mt-3 flex justify-between text-sm text-muted">
              <span>{doc.no}</span>
              <span>{doc.dt?.slice(0, 10)}</span>
            </div>
            <div className="mt-4 rounded-xl bg-cream-paper p-4 text-center">
              <p className="text-sm text-muted">Received with thanks from</p>
              <p className="mt-1 text-lg font-bold text-ink">{doc.sn}</p>
              {doc.cls ? <p className="text-xs text-muted">{doc.cls}</p> : null}
              <p className="mt-3 text-3xl font-bold text-indigo">
                {formatMoney(doc.amt, currency)}
              </p>
            </div>
            <div className="mt-4 space-y-1">
              {doc.tw && doc.tw.length > 0 ? (
                <Row label="Towards" value={doc.tw.join(", ")} />
              ) : null}
              {doc.mode ? <Row label="Paid by" value={doc.mode} /> : null}
              {doc.bal && doc.bal > 0 ? (
                <Row label="Still pending" value={formatMoney(doc.bal, currency)} bold />
              ) : (
                <p className="pt-2 text-center text-sm font-semibold text-emerald-600">
                  No dues pending
                </p>
              )}
            </div>
          </>
        ) : null}

        {doc.t === "mrk" ? (
          <>
            <div className="mt-3 flex justify-between text-sm text-muted">
              <span>{doc.tn}</span>
              <span>{doc.dt?.slice(0, 10)}</span>
            </div>
            <div className="mt-4 rounded-xl bg-cream-paper p-4 text-center">
              <p className="text-lg font-bold text-ink">{doc.sn}</p>
              {doc.sub ? <p className="text-xs text-muted">{doc.sub}</p> : null}
              {doc.mk === null ? (
                <p className="mt-3 text-xl font-bold text-saffron">Did not appear</p>
              ) : (
                <>
                  <p className="mt-3 text-3xl font-bold text-indigo">
                    {doc.mk}
                    <span className="text-lg text-muted"> / {doc.max}</span>
                  </p>
                  <p className="mt-1 text-sm font-semibold text-muted">
                    {doc.max ? Math.round((doc.mk / doc.max) * 1000) / 10 : 0}%
                  </p>
                </>
              )}
            </div>
            <div className="mt-4 space-y-1">
              {doc.avg !== undefined ? (
                <Row label="Class average" value={`${doc.avg} / ${doc.max}`} />
              ) : null}
              {doc.rnk ? (
                <Row
                  label="Rank"
                  value={doc.outOf ? `${doc.rnk} of ${doc.outOf}` : String(doc.rnk)}
                />
              ) : null}
            </div>
            {doc.rem ? <p className="mt-3 text-sm text-ink">{doc.rem}</p> : null}
          </>
        ) : null}

        {doc.t === "att" ? (
          <>
            <p className="mt-3 text-center text-sm text-muted">{doc.pd}</p>
            <div className="mt-4 rounded-xl bg-cream-paper p-4 text-center">
              <p className="text-lg font-bold text-ink">{doc.sn}</p>
              <p
                className={`mt-3 text-4xl font-bold ${
                  doc.pct >= 75 ? "text-emerald-600" : "text-saffron"
                }`}
              >
                {doc.pct}%
              </p>
              <p className="mt-1 text-sm text-muted">
                Present for {doc.prs} of {doc.tot} classes
              </p>
            </div>
            {doc.abs && doc.abs.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Days missed</p>
                <p className="mt-1 text-sm text-ink">{doc.abs.join(", ")}</p>
              </div>
            ) : null}
          </>
        ) : null}
      </div>

      {b.u && amount > 0 && supportsUpi(currency) ? (
        <UpiPayButton
          upiId={b.u}
          amount={amount}
          businessName={b.n}
          note={payNote}
          currency={currency}
        />
      ) : null}

      <p className="text-center text-xs text-muted">
        Shared with a free{" "}
        <a href="/tools" className="font-semibold text-indigo">
          Setu
        </a>{" "}
        tool. Your data stays in the link — nothing is stored on a server.
      </p>
    </div>
  );
}
