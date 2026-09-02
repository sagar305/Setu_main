"use client";

// Public read-only viewer for a shared document.
//
// Two link shapes arrive here, and the difference matters to the reader:
//
//   /view#d=<payload>   the whole document is in the link. Nothing was ever
//                       uploaded, and the page renders with no network at all —
//                       so it still opens on a phone with no signal.
//   /view/<code>        the sender chose to shorten. The document was stored by
//                       the shortener, and this page has to fetch it, which
//                       means the reader needs a connection.
//
// The footer says which of the two happened rather than claiming the stronger
// promise in both cases.

import { useCallback, useEffect, useState } from "react";
import {
  decodeDoc,
  docTitle,
  payableAmount,
  type ShareBusiness,
  type ShareLineItem,
  type SharedDoc,
} from "@/lib/toolkit/shareLink";
import { formatMoney } from "@/lib/pos/types";
import { resolveShortLink } from "@/lib/toolkit/shortLink";
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

function Notice({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="mx-auto max-w-md rounded-2xl border border-muted-line/30 bg-white p-8 text-center">
      <h1 className="text-lg font-bold text-ink">{title}</h1>
      <div className="mt-2 text-sm text-muted">{children}</div>
    </div>
  );
}

type LoadState = "loading" | "ready" | "broken" | "expired" | "failed";

/**
 * @param code Present when the reader followed a shortened /view/<code> link.
 *             Absent for a self-contained /view#d= link.
 */
export function ShareViewer({ code }: { code?: string } = {}) {
  const [doc, setDoc] = useState<SharedDoc | null>(null);
  const [state, setState] = useState<LoadState>("loading");
  const [attempt, setAttempt] = useState(0);

  // Self-contained link: everything needed is already in the URL.
  useEffect(() => {
    if (code) return undefined;

    const read = () => {
      const decoded = decodeDoc(window.location.hash || window.location.search);
      setDoc(decoded);
      setState(decoded ? "ready" : "broken");
    };
    read();
    // Re-decode if the fragment changes (e.g. the link is edited in place).
    window.addEventListener("hashchange", read);
    return () => window.removeEventListener("hashchange", read);
  }, [code]);

  // Shortened link: fetch the stored payload, then decode it exactly as a
  // fragment would have been decoded.
  useEffect(() => {
    if (!code) return undefined;
    let cancelled = false;

    setState("loading");
    resolveShortLink(code)
      .then((link) => {
        if (cancelled) return;
        if (!link) {
          // Unknown and expired are the same answer from the service, and the
          // same thing to the reader: the link no longer resolves.
          setState("expired");
          return;
        }
        const decoded = decodeDoc(link.payload);
        setDoc(decoded);
        setState(decoded ? "ready" : "broken");
      })
      .catch(() => {
        if (!cancelled) setState("failed");
      });

    return () => {
      cancelled = true;
    };
  }, [code, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);

  if (state === "loading") {
    return code ? (
      <Notice title="Opening the link…">
        <p>One moment.</p>
      </Notice>
    ) : null;
  }

  if (state === "expired") {
    return (
      <Notice title="This link has expired">
        <p>
          Shortened links are kept for 180 days after they were last opened, then deleted. Ask the
          sender to share it again.
        </p>
      </Notice>
    );
  }

  if (state === "failed") {
    return (
      <Notice title="Couldn&apos;t open this link">
        <p>
          This link needs an internet connection, because the document is stored rather than carried
          inside the link. Check your connection and try again.
        </p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white"
        >
          Try again
        </button>
      </Notice>
    );
  }

  if (!doc) {
    return (
      <Notice title="This link is empty or broken">
        <p>
          The document data lives inside the link itself. Ask the sender to share it again — the full
          link may have been cut off.
        </p>
      </Notice>
    );
  }

  const b = doc.b;
  const currency = b.cur;
  const amount = payableAmount(doc);
  const payNote =
    doc.t === "inv" || doc.t === "quo" || doc.t === "fee" || doc.t === "rnt"
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

        {doc.t === "rnt" ? (
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

            <div className="mt-3 rounded-xl bg-cream-paper p-3 text-sm">
              {doc.ev ? <Row label="Event" value={doc.ev} /> : null}
              {doc.vn ? <Row label="Venue" value={doc.vn} /> : null}
              <Row
                label="Hire period"
                value={`${doc.fd}${doc.td && doc.td !== doc.fd ? ` to ${doc.td}` : ""}`}
              />
              {doc.ft || doc.tt ? (
                <Row label="Time" value={[doc.ft, doc.tt].filter(Boolean).join(" – ")} />
              ) : null}
            </div>

            <div className="my-4">
              <ItemsTable items={doc.it} currency={currency} />
            </div>

            <div className="space-y-1">
              <Row label="Rent" value={formatMoney(doc.sub, currency)} />
              {doc.trn ? <Row label="Transport" value={formatMoney(doc.trn, currency)} /> : null}
              {doc.lab ? <Row label="Labour" value={formatMoney(doc.lab, currency)} /> : null}
              {doc.dis ? (
                <Row label="Discount" value={`-${formatMoney(doc.dis, currency)}`} />
              ) : null}
              {doc.tax ? <Row label="Tax" value={formatMoney(doc.tax, currency)} /> : null}
              <Row label="Hire total" value={formatMoney(doc.tot, currency)} bold />
              {doc.dep ? <Row label="Deposit (refundable)" value={formatMoney(doc.dep, currency)} /> : null}
              {doc.adv ? <Row label="Received" value={formatMoney(doc.adv, currency)} /> : null}

              {doc.st === "settled" ? (
                <div className="mt-2 space-y-1 border-t border-muted-line/30 pt-2">
                  {doc.ld ? (
                    <Row
                      label={`Late return (${doc.ld} ${doc.ld === 1 ? "day" : "days"})`}
                      value={formatMoney(doc.lf ?? 0, currency)}
                    />
                  ) : null}
                  {doc.dmg ? <Row label="Damage" value={formatMoney(doc.dmg, currency)} /> : null}
                  {doc.los ? <Row label="Loss" value={formatMoney(doc.los, currency)} /> : null}
                  {doc.ref ? (
                    <Row label="Deposit refunded" value={formatMoney(doc.ref, currency)} />
                  ) : null}
                  <Row
                    label={(doc.due ?? 0) > 0 ? "Still payable" : "Settled in full"}
                    value={formatMoney(doc.due ?? 0, currency)}
                    bold
                  />
                </div>
              ) : null}
            </div>
            {doc.note ? <p className="mt-3 text-xs text-muted">{doc.note}</p> : null}
          </>
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

        {doc.t === "rx" ? (
          <>
            {doc.dr ? (
              <div className="mt-1 text-center text-sm text-muted">
                <p className="font-semibold text-ink">{doc.dr}</p>
                {doc.drq ? <p className="text-xs">{doc.drq}</p> : null}
                {doc.reg ? <p className="text-xs">Reg. No: {doc.reg}</p> : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-y border-muted-line/30 py-2 text-sm">
              <span className="font-semibold text-ink">{doc.pn}</span>
              {doc.ag ? <span className="text-muted">{doc.ag}</span> : null}
              {doc.fl ? <span className="text-muted">File: {doc.fl}</span> : null}
              <span className="text-muted">{doc.dt?.slice(0, 10)}</span>
            </div>

            {doc.alg && doc.alg.length > 0 ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-700">
                Allergies: {doc.alg.join(", ")}
              </p>
            ) : null}

            {doc.vit && doc.vit.length > 0 ? (
              <p className="mt-2 text-xs text-muted">{doc.vit.join(" · ")}</p>
            ) : null}

            {doc.dx ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Diagnosis</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">{doc.dx}</p>
              </div>
            ) : null}

            {doc.med.length > 0 ? (
              <div className="mt-4">
                <p className="text-lg font-bold text-indigo">℞</p>
                <div className="mt-1 overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-muted-line/30 text-left text-muted">
                        <th className="py-2 pr-3 font-semibold">Medicine</th>
                        <th className="py-2 pr-3 font-semibold">Dosage</th>
                        <th className="py-2 font-semibold">Duration</th>
                      </tr>
                    </thead>
                    <tbody>
                      {doc.med.map((line, i) => (
                        <tr key={i} className="border-b border-muted-line/20 align-top">
                          <td className="py-2 pr-3">
                            <span className="font-semibold text-ink">
                              {i + 1}. {line.n}
                            </span>
                            {line.nt ? (
                              <span className="block text-xs text-muted">{line.nt}</span>
                            ) : null}
                            {line.q ? (
                              <span className="block text-xs text-muted">Qty: {line.q}</span>
                            ) : null}
                          </td>
                          <td className="py-2 pr-3 text-muted">{line.f ?? ""}</td>
                          <td className="py-2 text-muted">{line.d ?? ""}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            ) : null}

            {doc.inv && doc.inv.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  Investigations advised
                </p>
                <ol className="mt-1 list-decimal pl-5 text-sm text-ink">
                  {doc.inv.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ol>
              </div>
            ) : null}

            {doc.adv ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">Advice</p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">{doc.adv}</p>
              </div>
            ) : null}

            {doc.fu ? (
              <p className="mt-4 text-center text-sm font-semibold text-indigo">
                Review after {doc.fu} days
              </p>
            ) : null}

            {doc.ft ? (
              <p className="mt-4 border-t border-muted-line/30 pt-3 text-center text-xs text-muted">
                {doc.ft}
              </p>
            ) : null}

            <p className="mt-3 text-center text-xs text-muted">
              This is a copy of a prescription issued by your doctor. Take medicines only as
              directed, and ask the clinic if anything here is unclear.
            </p>
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
        tool.{" "}
        {code
          ? "This is a shortened link, so the document is stored until 180 days after it was last opened."
          : "Your data stays in the link — nothing is stored on a server."}
      </p>
    </div>
  );
}
