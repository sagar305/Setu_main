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
import { useI18n } from "@/lib/i18n";
import { fill, splitAround } from "@/lib/i18n/translate";
import { resolveShortLink } from "@/lib/toolkit/shortLink";
import { supportsUpi } from "@/lib/upi";
import { UpiPayButton } from "@/components/toolkit/UpiPayButton";

function BusinessHeader({ b, accent = "#26306B" }: { b: ShareBusiness; accent?: string }) {
  const { t } = useI18n();
  return (
    <div className="border-b border-muted-line/30 pb-4 text-center">
      {b.logo ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={b.logo} alt="" className="mx-auto mb-2 h-14 w-14 object-contain" />
      ) : null}
      <h1 className="text-xl font-bold" style={{ color: accent }}>
        {b.n || t("stYourBusiness")}
      </h1>
      {b.a ? <p className="mt-1 text-sm text-muted">{b.a}</p> : null}
      <p className="text-sm text-muted">
        {[b.p, b.g ? `GSTIN: ${b.g}` : ""].filter(Boolean).join(" · ")}
      </p>
    </div>
  );
}

function ItemsTable({ items, currency }: { items: ShareLineItem[]; currency: string }) {
  const { t } = useI18n();
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-muted-line/30 text-left text-muted">
            <th className="py-2 pr-3 font-semibold">{t("itemLabel")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("quantity")}</th>
            <th className="py-2 pr-3 text-right font-semibold">{t("rate")}</th>
            <th className="py-2 text-right font-semibold">{t("amount")}</th>
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
  // The reader here is the recipient, not the sender, so the page follows the
  // recipient's own language preference.
  const { t, lang } = useI18n();
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
      <Notice title={t("svOpeningLink")}>
        <p>{t("svOneMoment")}</p>
      </Notice>
    ) : null;
  }

  if (state === "expired") {
    return (
      <Notice title={t("svExpiredTitle")}>
        <p>{t("svExpiredBody")}</p>
      </Notice>
    );
  }

  if (state === "failed") {
    return (
      <Notice title={t("svFailedTitle")}>
        <p>{t("svFailedBody")}</p>
        <button
          type="button"
          onClick={retry}
          className="mt-4 rounded-lg bg-indigo px-4 py-2 text-sm font-semibold text-white"
        >
          {t("qmTryAgain")}
        </button>
      </Notice>
    );
  }

  if (!doc) {
    return (
      <Notice title={t("svBrokenTitle")}>
        <p>{t("svBrokenBody")}</p>
      </Notice>
    );
  }

  // The credit line has the brand mid-sentence, so the sentence stays one
  // dictionary entry with the link marked by a placeholder.
  const sharedWith = splitAround(t("svSharedWith"), "link");

  const b = doc.b;
  const currency = b.cur;
  const amount = payableAmount(doc);
  const payNote =
    doc.t === "inv" || doc.t === "quo" || doc.t === "fee" || doc.t === "rnt"
      ? doc.no
      : doc.t === "led"
        ? t("svPayment")
        : doc.t === "apt"
          ? t("svAdvance")
          : t("svPayment");

  return (
    <div className="mx-auto max-w-lg space-y-5">
      <div className="rounded-2xl border border-muted-line/30 bg-white p-6 shadow-sm">
        <BusinessHeader b={b} />

        <h2 className="mt-4 text-center text-lg font-bold text-ink">{docTitle(doc, lang)}</h2>

        {doc.t === "inv" ? (
          <>
            <div className="mt-3 flex justify-between text-sm text-muted">
              <span>{doc.no}</span>
              <span>{doc.dt?.slice(0, 10)}</span>
            </div>
            {doc.cn ? (
              <p className="mt-1 text-sm text-ink">{fill(t("svBilledTo"), { name: doc.cn })}</p>
            ) : null}
            <div className="my-4">
              <ItemsTable items={doc.it} currency={currency} />
            </div>
            <div className="space-y-1">
              <Row label={t("subtotal")} value={formatMoney(doc.sub, currency)} />
              {doc.dis ? (
                <Row label={t("discDiscount")} value={`-${formatMoney(doc.dis, currency)}`} />
              ) : null}
              {doc.tax ? <Row label={t("taxLabel")} value={formatMoney(doc.tax, currency)} /> : null}
              <Row label={t("total")} value={formatMoney(doc.tot, currency)} bold />
              {doc.pm ? <Row label={t("svPayment")} value={doc.pm} /> : null}
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
                {fill(t("qgValidUntil"), { date: doc.vu.slice(0, 10) })}
              </p>
            ) : null}
            {doc.cn ? (
              <p className="mt-2 text-sm text-ink">
                {t("svFor")}: {doc.cn}
              </p>
            ) : null}
            <div className="my-4">
              <ItemsTable items={doc.it} currency={currency} />
            </div>
            <div className="space-y-1">
              <Row label={t("subtotal")} value={formatMoney(doc.sub, currency)} />
              {doc.tax ? <Row label={t("taxLabel")} value={formatMoney(doc.tax, currency)} /> : null}
              <Row label={t("total")} value={formatMoney(doc.tot, currency)} bold />
            </div>
            {doc.note ? <p className="mt-3 text-xs text-muted">{doc.note}</p> : null}
          </>
        ) : null}

        {doc.t === "led" ? (
          <div className="mt-4 text-center">
            <p className="text-sm text-ink">{fill(t("svDear"), { name: doc.cn })}</p>
            <p className="mt-2 text-sm text-muted">{t("svOutstandingBalance")}</p>
            <p className="mt-1 text-3xl font-bold text-red-600">{formatMoney(doc.bal, currency)}</p>
            {doc.note ? <p className="mt-3 text-xs text-muted">{doc.note}</p> : null}
          </div>
        ) : null}

        {doc.t === "apt" ? (
          <div className="mt-4 space-y-2 text-sm">
            <Row label={t("svFor")} value={doc.cn} />
            <Row label={t("service")} value={doc.svc} />
            <Row label={t("date")} value={doc.dt.slice(0, 10)} />
            <Row label={t("svTime")} value={doc.tm} />
            {doc.dur ? (
              <Row label={t("svDuration")} value={fill(t("svMinutes"), { n: doc.dur })} />
            ) : null}
            {doc.note ? <p className="pt-1 text-xs text-muted">{doc.note}</p> : null}
          </div>
        ) : null}

        {doc.t === "rnt" ? (
          <>
            {/* Why this link arrived, when it is a reminder rather than a
                document. Stated before the figures, because it is the reason
                the customer is looking at all. */}
            {doc.rm ? (
              <div
                className={`mt-3 rounded-xl border p-3 text-sm ${
                  doc.rm.k === "overdue"
                    ? "border-red-300 bg-red-50 text-red-800"
                    : "border-indigo/30 bg-indigo/5 text-ink"
                }`}
              >
                {doc.rm.k === "overdue" ? (
                  <p className="font-semibold">
                    {doc.rm.ld
                      ? fill(t("svDaysOverdue"), {
                          n: doc.rm.ld,
                          unit: t(doc.rm.ld === 1 ? "svDayUnit" : "svDaysUnit"),
                        })
                      : t("svOverdue")}
                    {doc.rm.d ? fill(t("svDueBackOn"), { date: doc.rm.d }) : ""}.
                    {doc.rm.lf
                      ? fill(t("svLateFeeSoFar"), {
                          amount: formatMoney(doc.rm.lf, currency),
                        })
                      : ""}
                  </p>
                ) : null}
                {doc.rm.k === "returnDue" ? (
                  <p className="font-semibold">
                    {fill(t("svReturnDueOn"), { date: doc.rm.d ?? "" })}
                  </p>
                ) : null}
                {doc.rm.k === "dispatch" ? (
                  <p className="font-semibold">
                    {fill(t("svDeliveringOn"), { date: doc.rm.d ?? "" })}
                    {doc.rm.c ? fill(t("svWillCall"), { phone: doc.rm.c }) : ""}
                  </p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-3 flex justify-between text-sm text-muted">
              <span>{doc.no}</span>
              <span>{doc.dt?.slice(0, 10)}</span>
            </div>
            {doc.vu ? (
              <p className="mt-1 text-center text-xs font-semibold text-indigo">
                {fill(t("qgValidUntil"), { date: doc.vu.slice(0, 10) })}
              </p>
            ) : null}
            {doc.cn ? (
              <p className="mt-2 text-sm text-ink">
                {t("svFor")}: {doc.cn}
              </p>
            ) : null}

            <div className="mt-3 rounded-xl bg-cream-paper p-3 text-sm">
              {doc.ev ? <Row label={t("svEvent")} value={doc.ev} /> : null}
              {doc.vn ? <Row label={t("svVenue")} value={doc.vn} /> : null}
              <Row
                label={t("svHirePeriod")}
                value={[doc.fd, doc.td && doc.td !== doc.fd ? doc.td : ""]
                  .filter(Boolean)
                  .join(" – ")}
              />
              {doc.ft || doc.tt ? (
                <Row label={t("svTime")} value={[doc.ft, doc.tt].filter(Boolean).join(" – ")} />
              ) : null}
            </div>

            <div className="my-4">
              <ItemsTable items={doc.it} currency={currency} />
            </div>

            <div className="space-y-1">
              <Row label={t("svRent")} value={formatMoney(doc.sub, currency)} />
              {doc.trn ? (
                <Row label={t("svTransport")} value={formatMoney(doc.trn, currency)} />
              ) : null}
              {doc.lab ? (
                <Row label={t("svLabour")} value={formatMoney(doc.lab, currency)} />
              ) : null}
              {doc.dis ? (
                <Row label={t("discDiscount")} value={`-${formatMoney(doc.dis, currency)}`} />
              ) : null}
              {doc.tax ? <Row label={t("taxLabel")} value={formatMoney(doc.tax, currency)} /> : null}
              <Row label={t("svHireTotal")} value={formatMoney(doc.tot, currency)} bold />
              {doc.dep ? (
                <Row label={t("svDeposit")} value={formatMoney(doc.dep, currency)} />
              ) : null}
              {doc.adv ? (
                <Row label={t("svReceived")} value={formatMoney(doc.adv, currency)} />
              ) : null}
              {doc.st === "quote" && doc.adue ? (
                <Row label={t("svAdvanceToConfirm")} value={formatMoney(doc.adue, currency)} bold />
              ) : null}

              {doc.st === "settled" ? (
                <div className="mt-2 space-y-1 border-t border-muted-line/30 pt-2">
                  {doc.ld ? (
                    <Row
                      label={fill(t("svLateReturn"), {
                        days: `${doc.ld} ${t(doc.ld === 1 ? "svDayUnit" : "svDaysUnit")}`,
                      })}
                      value={formatMoney(doc.lf ?? 0, currency)}
                    />
                  ) : null}
                  {doc.dmg ? (
                    <Row label={t("svDamage")} value={formatMoney(doc.dmg, currency)} />
                  ) : null}
                  {doc.los ? (
                    <Row label={t("svLoss")} value={formatMoney(doc.los, currency)} />
                  ) : null}
                  {doc.ref ? (
                    <Row label={t("svDepositRefunded")} value={formatMoney(doc.ref, currency)} />
                  ) : null}
                  <Row
                    label={t((doc.due ?? 0) > 0 ? "svStillPayable" : "svSettledInFull")}
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
              <p className="text-sm text-muted">{t("svReceivedWithThanks")}</p>
              <p className="mt-1 text-lg font-bold text-ink">{doc.sn}</p>
              {doc.cls ? <p className="text-xs text-muted">{doc.cls}</p> : null}
              <p className="mt-3 text-3xl font-bold text-indigo">
                {formatMoney(doc.amt, currency)}
              </p>
            </div>
            <div className="mt-4 space-y-1">
              {doc.tw && doc.tw.length > 0 ? (
                <Row label={t("svTowards")} value={doc.tw.join(", ")} />
              ) : null}
              {doc.mode ? <Row label={t("svPaidBy")} value={doc.mode} /> : null}
              {doc.bal && doc.bal > 0 ? (
                <Row label={t("svStillPending")} value={formatMoney(doc.bal, currency)} bold />
              ) : (
                <p className="pt-2 text-center text-sm font-semibold text-emerald-600">
                  {t("svNoDuesPending")}
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
                <p className="mt-3 text-xl font-bold text-saffron">{t("svDidNotAppear")}</p>
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
                <Row label={t("svClassAverage")} value={`${doc.avg} / ${doc.max}`} />
              ) : null}
              {doc.rnk ? (
                <Row
                  label={t("svRank")}
                  value={
                    doc.outOf
                      ? fill(t("svRankOf"), { rank: doc.rnk, total: doc.outOf })
                      : String(doc.rnk)
                  }
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
                {doc.reg ? (
                  <p className="text-xs">{fill(t("svRegNo"), { no: doc.reg })}</p>
                ) : null}
              </div>
            ) : null}

            <div className="mt-4 flex flex-wrap justify-between gap-x-4 gap-y-1 border-y border-muted-line/30 py-2 text-sm">
              <span className="font-semibold text-ink">{doc.pn}</span>
              {doc.ag ? <span className="text-muted">{doc.ag}</span> : null}
              {doc.fl ? (
                <span className="text-muted">{fill(t("svFile"), { no: doc.fl })}</span>
              ) : null}
              <span className="text-muted">{doc.dt?.slice(0, 10)}</span>
            </div>

            {doc.alg && doc.alg.length > 0 ? (
              <p className="mt-2 rounded-lg bg-red-50 px-3 py-2 text-xs font-bold uppercase tracking-wide text-red-700">
                {fill(t("svAllergies"), { list: doc.alg.join(", ") })}
              </p>
            ) : null}

            {doc.vit && doc.vit.length > 0 ? (
              <p className="mt-2 text-xs text-muted">{doc.vit.join(" · ")}</p>
            ) : null}

            {doc.dx ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {t("svDiagnosis")}
                </p>
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
                        <th className="py-2 pr-3 font-semibold">{t("svMedicine")}</th>
                        <th className="py-2 pr-3 font-semibold">{t("svDosage")}</th>
                        <th className="py-2 font-semibold">{t("svDuration")}</th>
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
                              <span className="block text-xs text-muted">
                                {fill(t("svQtyOf"), { n: line.q })}
                              </span>
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
                  {t("svInvestigations")}
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
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {t("svAdvice")}
                </p>
                <p className="mt-1 whitespace-pre-line text-sm text-ink">{doc.adv}</p>
              </div>
            ) : null}

            {doc.fu ? (
              <p className="mt-4 text-center text-sm font-semibold text-indigo">
                {fill(t("svReviewAfter"), { n: doc.fu })}
              </p>
            ) : null}

            {doc.ft ? (
              <p className="mt-4 border-t border-muted-line/30 pt-3 text-center text-xs text-muted">
                {doc.ft}
              </p>
            ) : null}

            <p className="mt-3 text-center text-xs text-muted">{t("svRxDisclaimer")}</p>
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
                {fill(t("svPresentFor"), { present: doc.prs, total: doc.tot })}
              </p>
            </div>
            {doc.abs && doc.abs.length > 0 ? (
              <div className="mt-4">
                <p className="text-xs font-bold uppercase tracking-wide text-muted">
                  {t("svDaysMissed")}
                </p>
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
        {sharedWith[0]}
        <a href="/tools" className="font-semibold text-indigo">
          Setu
        </a>
        {sharedWith[1]}{" "}
        {t(code ? "svFootShortened" : "svFootInline")}
      </p>
    </div>
  );
}
