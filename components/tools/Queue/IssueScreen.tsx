"use client";

import { useEffect, useRef, useState } from "react";
import { ChevronDown, MessageCircle, Printer, QrCode, Star, Ticket } from "lucide-react";
import { useQueue } from "@/lib/queue/store";
import {
  activeCountersForService,
  estimateForNewToken,
  formatWait,
  waitingAhead,
} from "@/lib/queue/calc";
import { estimateWaitMinutes } from "@/lib/queue/calc";
import { queueWhatsAppLink } from "@/lib/queue/messages";
import { printQrPoster, printTokenSlip } from "@/lib/queue/print";
import { tokenLabel, type Service, type Token } from "@/lib/queue/types";
import {
  Field,
  SectionCard,
  ServiceDot,
  chipBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

/** How long the just-issued number stays on screen before the form returns. */
const CONFIRMATION_MS = 2000;

export function IssueScreen() {
  const { services, counters, todayTokens, settings, business, issueToken, serviceById } =
    useQueue();

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
  const confirmationTimer = useRef(0);

  useEffect(() => {
    if (!serviceId && active.length > 0) setServiceId(active[0].id);
  }, [active, serviceId]);

  useEffect(() => () => window.clearTimeout(confirmationTimer.current), []);

  const service = active.find((row) => row.id === serviceId);
  const estimate = service ? estimateForNewToken(todayTokens, service, counters) : 0;

  const handleIssue = async () => {
    if (!service) return;
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
      // The number stays up for two seconds so the receptionist can read it
      // out while handing the slip over, then the form comes back ready for
      // the next person — this screen is used in bursts.
      window.clearTimeout(confirmationTimer.current);
      confirmationTimer.current = window.setTimeout(() => setIssued(null), CONFIRMATION_MS);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not issue a token.");
    } finally {
      setIssuing(false);
    }
  };

  if (active.length === 0) {
    return (
      <SectionCard title="Issue a token">
        <p className="py-6 text-center text-sm text-muted">
          Add a service in Settings first — a token has to be for something.
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
          whatsAppHref={queueWhatsAppLink("tokenIssued", settings, {
            token: issued,
            service: serviceById(issued.serviceId),
            businessName: business?.name ?? "",
            tokens: todayTokens,
            counters,
          })}
          onDismiss={() => setIssued(null)}
        />
      ) : (
        <SectionCard title="Issue a token">
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
                        {ahead === 0 ? "No one waiting" : `${ahead} waiting`}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}

            <div className="flex items-center justify-between rounded-xl bg-cream-paper px-4 py-3">
              <span className="text-sm font-semibold text-ink">Estimated wait</span>
              <span className="text-sm font-bold text-indigo">{formatWait(estimate)}</span>
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
              Priority — senior citizen, emergency or appointment
            </button>

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
                Add details
              </button>
              {showDetails && (
                <div className="mt-3 grid gap-3 sm:grid-cols-2">
                  <Field label="Name">
                    <input
                      className={inputClass}
                      value={name}
                      onChange={(event) => setName(event.target.value)}
                      placeholder="Optional"
                    />
                  </Field>
                  <Field label="Phone" hint="Lets you send the token on WhatsApp.">
                    <input
                      className={inputClass}
                      value={phone}
                      onChange={(event) => setPhone(event.target.value)}
                      inputMode="tel"
                      placeholder="Optional"
                    />
                  </Field>
                  <div className="sm:col-span-2">
                    <Field label="Note">
                      <input
                        className={inputClass}
                        value={note}
                        onChange={(event) => setNote(event.target.value)}
                        placeholder="Anything the counter should know"
                      />
                    </Field>
                  </div>
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
              disabled={issuing || !service}
              className="inline-flex min-h-[64px] w-full items-center justify-center gap-2 rounded-xl bg-indigo px-5 text-lg font-bold text-white transition hover:bg-ink disabled:cursor-not-allowed disabled:opacity-40"
            >
              <Ticket className="h-6 w-6" aria-hidden="true" />
              {issuing ? "Issuing…" : "Give a token"}
            </button>
          </div>
        </SectionCard>
      )}

      <QrPosterCard services={active} businessName={business?.name ?? ""} />
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
  return (
    <section className="rounded-2xl border-2 border-indigo bg-indigo/5 p-6 text-center">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted">
        {service?.name ?? "Token"}
      </p>
      <p className="mt-2 text-7xl font-extrabold leading-none tracking-tight text-ink sm:text-8xl">
        {tokenLabel(token, service)}
      </p>
      <p className="mt-3 text-sm font-semibold text-indigo">{formatWait(waitMinutes)}</p>

      <div className="mt-5 flex flex-wrap items-center justify-center gap-2">
        <button
          type="button"
          className={secondaryBtnClass}
          onClick={() =>
            printTokenSlip({ token, service, businessName, waitMinutes })
          }
        >
          <Printer className="h-4 w-4" aria-hidden="true" />
          Print slip
        </button>
        {token.phone && (
          <a
            href={whatsAppHref}
            target="_blank"
            rel="noopener noreferrer"
            className={secondaryBtnClass}
          >
            <MessageCircle className="h-4 w-4" aria-hidden="true" />
            Send on WhatsApp
          </a>
        )}
        <button type="button" className={primaryBtnClass} onClick={onDismiss}>
          Next person
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
function QrPosterCard({ services, businessName }: { services: Service[]; businessName: string }) {
  const [printing, setPrinting] = useState(false);
  const [serviceId, setServiceId] = useState(services[0]?.id ?? "");
  const service = services.find((row) => row.id === serviceId) ?? services[0];

  const handlePrint = async () => {
    if (!service) return;
    setPrinting(true);
    try {
      const url = new URL(
        "/products/free-queue-system/view",
        window.location.origin
      );
      url.searchParams.set("b", businessName);
      url.searchParams.set("s", service.name);
      await printQrPoster({ businessName, serviceName: service.name, url: url.toString() });
    } finally {
      setPrinting(false);
    }
  };

  return (
    <SectionCard title="Waiting area poster">
      <p className="text-sm text-muted">
        Print an A4 poster with a QR code. A customer scans it, and their phone shows them what to
        do next — they still collect the number from you.
      </p>
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
          {printing ? "Preparing…" : "Print poster"}
        </button>
      </div>
      <p className="mt-3 text-xs text-muted">
        A customer&apos;s own phone issuing its own token, with a live position in the queue, needs
        the two devices to share a queue — that is the paid Setu Queue.
      </p>
    </SectionCard>
  );
}
