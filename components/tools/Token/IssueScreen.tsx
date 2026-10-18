"use client";

import { useEffect, useState } from "react";
import { ChevronDown, MessageCircle, Printer, QrCode, Star, Ticket } from "lucide-react";
import { useI18n } from "@/lib/i18n";
import type { LanguageCode } from "@/lib/i18n/config";
import { fill } from "@/lib/i18n/translate";
import { useToken } from "@/lib/token/store";
import {
  activeCountersForService,
  estimateForNewToken,
  formatWait,
  waitingAhead,
} from "@/lib/token/calc";
import { estimateWaitMinutes } from "@/lib/token/calc";
import { whatsAppLinkFor } from "@/lib/token/messages";
import { printQrPoster, printTokenSlip } from "@/lib/token/print";
import { tokenLabel, type Service, type Token } from "@/lib/token/types";
import {
  Field,
  SectionCard,
  ServiceDot,
  chipBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function IssueScreen() {
  const { t, lang } = useI18n();
  const { services, counters, todayTokens, settings, business, issueToken, serviceById } =
    useToken();

  const active = services.filter((service) => service.active);
  const [serviceId, setServiceId] = useState("");
  const [showDetails, setShowDetails] = useState(false);
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const [note, setNote] = useState("");
  const [priority, setPriority] = useState(false);
  const [issuing, setIssuing] = useState(false);
  const [issued, setIssued] = useState<Token | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!serviceId && active.length > 0) setServiceId(active[0].id);
  }, [active, serviceId]);

  const service = active.find((row) => row.id === serviceId);
  const estimate = service ? estimateForNewToken(todayTokens, service, counters) : 0;

  /**
   * Ten digits, with the spacing and punctuation people actually type stripped
   * out, and an optional +91 allowed in front. Anything stricter starts
   * rejecting real numbers at a busy counter, which is worse than a typo.
   */
  const phoneDigits = phone.replace(/\D/g, "");
  const phoneLooksRight = phoneDigits.length >= 10;
  const canIssue = Boolean(service) && name.trim().length > 0 && phoneLooksRight;

  const handleIssue = async () => {
    if (!service) return;
    if (!name.trim()) {
      setError(t("tkIsErrName"));
      return;
    }
    if (!phoneLooksRight) {
      setError(t("tkIsErrPhone"));
      return;
    }
    setError("");
    setIssuing(true);
    try {
      const token = await issueToken({
        serviceId: service.id,
        customerName: name,
        phone,
        note,
        priority,
      });
      setIssued(token);
      setName("");
      setPhone("");
      setNote("");
      setPriority(false);
      setShowDetails(false);
      // The card stays until it is dismissed. It used to clear itself after two
      // seconds, which took the Print and WhatsApp buttons with it before
      // anyone could reach them — the number is only half the job, and handing
      // it over is the other half.
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : t("tkIsErrIssue"));
    } finally {
      setIssuing(false);
    }
  };

  if (active.length === 0) {
    return (
      <SectionCard title={t("tkIsTitle")}>
        <p className="py-6 text-center text-sm text-muted">
          {t("tkIsNoService")}
        </p>
      </SectionCard>
    );
  }

  return (
    <div className="grid gap-4">
      {issued ? (
        <IssuedCard
          token={issued}
          service={serviceById(issued.serviceId)}
          businessName={business?.name ?? ""}
          waitMinutes={estimateWaitMinutes(
            Math.max(0, waitingAhead(todayTokens, issued.serviceId) - 1),
            serviceById(issued.serviceId)?.avgServiceMinutes ?? 5,
            activeCountersForService(counters, issued.serviceId)
          )}
          whatsAppHref={whatsAppLinkFor("tokenIssued", settings, {
            token: issued,
            service: serviceById(issued.serviceId),
            businessName: business?.name ?? "",
            tokens: todayTokens,
            counters,
            lang,
          })}
          onDismiss={() => setIssued(null)}
        />
      ) : (
        <SectionCard title={t("tkIsTitle")}>
          <div className="grid gap-4">
            {active.length > 1 && (
              <div className="grid gap-2 sm:grid-cols-2">
                {active.map((row) => {
                  const ahead = waitingAhead(todayTokens, row.id);
                  return (
                    <button
                      key={row.id}
                      type="button"
                      onClick={() => setServiceId(row.id)}
                      className={`flex min-h-[68px] flex-col items-start justify-center gap-1 rounded-xl border-2 px-4 py-3 text-left transition ${
                        row.id === serviceId
                          ? "border-indigo bg-indigo/5"
                          : "border-muted-line/30 bg-white hover:border-indigo/40"
                      }`}
                    >
                      <span className="flex items-center gap-2 text-base font-bold text-ink">
                        <ServiceDot colour={row.colour} />
                        {row.name}
                      </span>
                      <span className="text-xs text-muted">
                        {ahead === 0
                          ? t("tkIsNoOneWaiting")
                          : fill(t("tkIsAheadWaiting"), { count: ahead })}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-cream-paper px-4 py-3">
              <span className="text-sm font-semibold text-ink">{t("tkIsEstimatedWait")}</span>
              <span className="text-sm font-bold text-indigo">{formatWait(estimate, lang)}</span>
            </div>

            <button
              type="button"
              onClick={() => setPriority((value) => !value)}
              className={`flex min-h-[52px] items-center justify-center gap-2 rounded-xl border-2 px-4 text-sm font-bold transition ${
                priority
                  ? "border-saffron bg-saffron/15 text-ink"
                  : "border-muted-line/30 bg-white text-muted hover:border-saffron/50"
              }`}
              aria-pressed={priority}
            >
              <Star className="h-4 w-4" aria-hidden="true" />
              {t("tkIsPriorityNote")}
            </button>

            {/* Name and phone are required. Every token now belongs to a
                named person with a number we can reach — which is what makes
                the WhatsApp nudge and any follow-up possible at all. The note
                stays folded away, because it is the one field that is genuinely
                occasional. */}
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label={t("name")} required>
                <input
                  className={inputClass}
                  value={name}
                  onChange={(event) => setName(event.target.value)}
                  placeholder={t("tkIsCustomerNamePh")}
                />
              </Field>
              <Field label={t("phone")} required hint={t("tkIsPhoneHint")}>
                <input
                  className={inputClass}
                  value={phone}
                  onChange={(event) => setPhone(event.target.value)}
                  inputMode="tel"
                  placeholder="98765 43210"
                />
              </Field>
            </div>

            <div>
              <button
                type="button"
                onClick={() => setShowDetails((value) => !value)}
                className="inline-flex items-center gap-1 text-sm font-semibold text-muted hover:text-indigo"
                aria-expanded={showDetails}
              >
                <ChevronDown
                  className={`h-4 w-4 transition ${showDetails ? "rotate-180" : ""}`}
                  aria-hidden="true"
                />
                {t("tkIsAddNote")}
              </button>
              {showDetails && (
                <div className="mt-3">
                  <Field label={t("notes")}>
                    <input
                      className={inputClass}
                      value={note}
                      onChange={(event) => setNote(event.target.value)}
                      placeholder={t("tkIsNotePh")}
                    />
                  </Field>
                </div>
              )}
            </div>

            {error && (
              <p className="text-sm font-semibold text-red-600" role="alert">
                {error}
              </p>
            )}

            <button
              type="button"
              onClick={() => void handleIssue()}
              disabled={issuing || !canIssue}
              className="inline-flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-indigo px-5 text-lg font-bold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ticket className="h-6 w-6" aria-hidden="true" />
              {issuing ? t("tkIsIssuing") : t("tkIsGiveToken")}
            </button>
          </div>
        </SectionCard>
      )}

      <QrPosterCard services={active} businessName={business?.name ?? ""} lang={lang} />
    </div>
  );
}

function IssuedCard({
  token,
  service,
  businessName,
  waitMinutes,
  whatsAppHref,
  onDismiss,
}: {
  token: Token;
  service: Service | undefined;
  businessName: string;
  waitMinutes: number;
  whatsAppHref: string;
  onDismiss: () => void;
}) {
  const { t, lang } = useI18n();
  return (
    <section className="rounded-2xl border-2 border-indigo bg-indigo/5 p-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {service?.name || t("tkToken")}
      </p>
      <p className="mt-2 text-7xl font-extrabold leading-none tracking-tight text-ink sm:text-8xl">
        {tokenLabel(token, service)}
      </p>
      <p className="mt-3 text-sm font-semibold text-indigo">{formatWait(waitMinutes, lang)}</p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={() =>
            printTokenSlip({ token, service, businessName, waitMinutes, lang })
          }
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          {t("tkIsPrintSlip")}
        </button>
        {token.phone && (
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryBtnClass}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            {t("tkIsSendWhatsApp")}
          </a>
        )}
        <button type="button" className={primaryBtnClass} onClick={onDismiss}>
          {t("tkIsNextPerson")}
        </button>
      </div>
    </section>
  );
}

/**
 * The QR poster.
 *
 * In the free app the code cannot issue a token — two devices cannot share one
 * browser's database — so the poster is honest about what it does: it opens a
 * page the customer shows at the counter. Saying so on the poster is better
 * than a customer standing in front of a screen that claims they are seventh
 * in a queue their phone knows nothing about.
 */
function QrPosterCard({
  services,
  businessName,
  lang,
}: {
  services: Service[];
  businessName: string;
  lang: LanguageCode;
}) {
  const { t } = useI18n();
  const [printing, setPrinting] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((row) => row.id === serviceId) ?? services[0];

  const handlePrint = async () => {
    if (!service) return;
    setPrinting(true);
    try {
      const url = new URL(
        "/products/free-token-system/view",
        window.location.origin
      );
      url.searchParams.set("b", businessName);
      url.searchParams.set("s", service.name);
      await printQrPoster({
        businessName,
        serviceName: service.name,
        url: url.toString(),
        lang,
      });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SectionCard title={t("tkIsPosterTitle")}>
      <p className="text-sm text-muted">{t("tkIsPosterBlurb")}</p>
      <div className="mt-3 flex flex-wrap items-center gap-2">
        {services.length > 1 &&
          services.map((row) => (
            <button
              key={row.id}
              type="button"
              onClick={() => setServiceId(row.id)}
              className={`${chipBtnClass} ${
                row.id === service?.id ? "border-indigo bg-indigo/10 text-indigo" : ""
              }`}
            >
              {row.name}
            </button>
          ))}
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={() => void handlePrint()}
          disabled={printing || !service}
        >
          <QrCode className="h-4 w-4" aria-hidden="true" />
          {printing ? t("tkIsPreparing") : t("tkIsPrintPoster")}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        {t("tkIsPosterFoot")}
      </p>
    </SectionCard>
  );
}
