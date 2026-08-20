"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowRightLeft,
  Ban,
  Check,
  MessageCircle,
  PhoneCall,
  Play,
  SkipForward,
  Undo2,
  Volume2,
} from "lucide-react";
import { countersForService, useQueue } from "@/lib/queue/store";
import { readLocal, writeLocal } from "@/lib/toolkit/storage";
import {
  activeCountersForService,
  counterServes,
  estimateWaitMinutes,
  nextInQueue,
  shouldOfferSkip,
  waitingQueue,
} from "@/lib/queue/calc";
import { averageWaitMinutes } from "@/lib/queue/calc";
import { formatClock, formatMinutes } from "@/lib/queue/reports";
import { queueWhatsAppLink } from "@/lib/queue/messages";
import { ALMOST_YOUR_TURN_POSITION, tokenLabel, type Token } from "@/lib/queue/types";
import {
  ConfirmDialog,
  EmptyState,
  Modal,
  PriorityFlag,
  SectionCard,
  ServiceDot,
  StatusChip,
  bigBtnClass,
  chipBtnClass,
  secondaryBtnClass,
} from "./ui";

const TOOL_KEY = "queue";
/** How many of the waiting list the counter sees before it becomes a scroll. */
const WAITING_LIST_LENGTH = 10;

/** Minutes:seconds since a moment, ticking. The card's sense of urgency. */
function useElapsed(since: string | null): string {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!since) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [since]);
  if (!since) return "";
  const seconds = Math.max(0, Math.floor((now - Date.parse(since)) / 1000));
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function CounterScreen() {
  const {
    settings,
    services,
    counters,
    todayTokens,
    business,
    serviceById,
    callNext,
    callToken,
    recallToken,
    startServing,
    completeToken,
    skipToken,
    restoreToken,
    cancelToken,
    transferToken,
  } = useQueue();

  /**
   * Which counter this device is. Remembered locally rather than in the
   * database, because it is a fact about this tablet, not about the business —
   * three terminals sharing one queue each stay on their own desk.
   */
  const [counterId, setCounterId] = useState<string>("");
  useEffect(() => {
    const remembered = readLocal<string>(TOOL_KEY, "counterId", "");
    const stillExists = counters.some((row) => row.id === remembered && row.active);
    const fallback = counters.find((row) => row.active)?.id ?? "";
    setCounterId(stillExists ? remembered : fallback);
  }, [counters]);

  const chooseCounter = (id: string) => {
    setCounterId(id);
    writeLocal(TOOL_KEY, "counterId", id);
  };

  const counter = counters.find((row) => row.id === counterId) ?? null;

  const current = useMemo(
    () =>
      todayTokens.find(
        (token) =>
          token.counterId === counterId &&
          (token.status === "called" || token.status === "serving")
      ) ?? null,
    [todayTokens, counterId]
  );

  const queue = useMemo(() => waitingQueue(todayTokens, counter), [todayTokens, counter]);
  const upNext = nextInQueue(todayTokens, counter);
  const elapsed = useElapsed(current?.calledAt ?? null);

  const servedByMe = todayTokens.filter(
    (token) => token.counterId === counterId && token.status === "served"
  ).length;
  const averageWait = averageWaitMinutes(todayTokens);

  const [jumpTarget, setJumpTarget] = useState<Token | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Token | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const notifyLink = (token: Token) =>
    queueWhatsAppLink("almostYourTurn", settings, {
      token,
      service: serviceById(token.serviceId),
      counter,
      businessName: business?.name ?? "",
      tokens: todayTokens,
      counters,
    });

  return (
    <div className="grid gap-4">
      {counters.filter((row) => row.active).length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            This device is
          </span>
          {counters
            .filter((row) => row.active)
            .map((row) => (
              <button
                key={row.id}
                type="button"
                onClick={() => chooseCounter(row.id)}
                className={`${chipBtnClass} ${
                  row.id === counterId ? "border-indigo bg-indigo/10 text-indigo" : ""
                }`}
              >
                {row.name}
              </button>
            ))}
        </div>
      )}

      {/* The card. Whoever is standing at this desk, at the size the person
          behind the counter can read without leaning in. */}
      <section className="rounded-2xl border border-muted-line/30 bg-white p-5">
        {current ? (
          <div>
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <div className="flex items-center gap-2">
                  <StatusChip status={current.status} />
                  {current.priority && <PriorityFlag />}
                  {current.recallCount > 0 && (
                    <span className="text-xs font-semibold text-amber-700">
                      Called {current.recallCount + 1}×
                    </span>
                  )}
                </div>
                <div className="mt-2 text-6xl font-extrabold leading-none tracking-tight text-ink sm:text-7xl">
                  {tokenLabel(current, serviceById(current.serviceId))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <ServiceDot colour={serviceById(current.serviceId)?.colour ?? "#5F6478"} />
                  {serviceById(current.serviceId)?.name ?? "Removed service"}
                  {current.customerName && <span>· {current.customerName}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {current.status === "serving" ? "Serving for" : "Called"}
                </div>
                <div className="text-2xl font-bold tabular-nums text-ink">
                  {current.status === "serving" ? elapsed : formatClock(current.calledAt)}
                </div>
              </div>
            </div>

            <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-3">
              <button
                type="button"
                className={chipBtnClass}
                disabled={busy}
                onClick={() => void run(() => recallToken(current.id))}
              >
                <Volume2 className="h-4 w-4" aria-hidden="true" />
                Recall
              </button>

              {current.status === "called" ? (
                <button
                  type="button"
                  className={`${chipBtnClass} border-indigo bg-indigo/10 text-indigo`}
                  disabled={busy}
                  onClick={() => void run(() => startServing(current.id))}
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  Start serving
                </button>
              ) : (
                <button
                  type="button"
                  className={`${chipBtnClass} border-green-300 bg-green-50 text-green-800`}
                  disabled={busy}
                  onClick={() => void run(() => completeToken(current.id))}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  Done
                </button>
              )}

              <button
                type="button"
                className={chipBtnClass}
                disabled={busy}
                onClick={() => setTransferOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                Transfer
              </button>

              <button
                type="button"
                className={`${chipBtnClass} ${
                  shouldOfferSkip(current) ? "border-amber-300 bg-amber-50 text-amber-800" : ""
                }`}
                disabled={busy}
                onClick={() => void run(() => skipToken(current.id))}
              >
                <SkipForward className="h-4 w-4" aria-hidden="true" />
                {shouldOfferSkip(current) ? "No-show — skip" : "Skip"}
              </button>

              <button
                type="button"
                className={chipBtnClass}
                disabled={busy}
                onClick={() => setCancelTarget(current)}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                Cancel
              </button>
            </div>

            {/* Done is not offered on a token that never started, and that is
                deliberate: every served token carries a start time, so the
                average service time on the reports means something. */}
            {current.status === "called" && (
              <p className="mt-3 text-xs text-muted">
                Tap <strong>Start serving</strong> when they reach you — Done appears after that.
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<PhoneCall className="h-6 w-6" aria-hidden="true" />}
            title="Nobody at this counter"
            message={
              upNext
                ? "Tap Call next to bring the next person over."
                : "The queue is empty. New tokens appear here as they are issued."
            }
          />
        )}

        <button
          type="button"
          className={`${bigBtnClass} mt-5`}
          disabled={busy || !upNext || !counter}
          onClick={() => void run(() => callNext(counterId))}
        >
          <PhoneCall className="h-5 w-5" aria-hidden="true" />
          {upNext
            ? `Call next — ${tokenLabel(upNext, serviceById(upNext.serviceId))}`
            : "No one waiting"}
        </button>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="Waiting" value={String(queue.length)} />
        <Stat label="Avg wait today" value={formatMinutes(averageWait)} />
        <Stat label="Served by me" value={String(servedByMe)} />
      </div>

      <SectionCard title={`Waiting (${queue.length})`}>
        {queue.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">Nobody is waiting right now.</p>
        ) : (
          <ul className="divide-y divide-muted-line/20">
            {queue.slice(0, WAITING_LIST_LENGTH).map((token, index) => {
              const service = serviceById(token.serviceId);
              const wait = estimateWaitMinutes(
                index,
                service?.avgServiceMinutes ?? 5,
                activeCountersForService(counters, token.serviceId)
              );
              return (
                <li key={token.id} className="flex items-center gap-3 py-2.5">
                  <span className="w-6 shrink-0 text-xs font-semibold text-muted">
                    {index + 1}
                  </span>
                  <button
                    type="button"
                    onClick={() => setJumpTarget(token)}
                    className="flex min-w-0 flex-1 items-center gap-3 rounded-lg px-1 py-1 text-left hover:bg-cream-paper"
                  >
                    <span className="text-xl font-extrabold text-ink">
                      {tokenLabel(token, service)}
                    </span>
                    <span className="flex min-w-0 flex-col">
                      <span className="flex items-center gap-1.5 truncate text-sm text-ink">
                        <ServiceDot colour={service?.colour ?? "#5F6478"} />
                        {service?.name ?? "Removed service"}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {token.customerName || formatClock(token.issuedAt)} · {wait === 0 ? "next" : `${wait} min`}
                      </span>
                    </span>
                    {token.priority && <PriorityFlag className="ml-auto shrink-0" />}
                  </button>
                  {token.phone && index + 1 <= ALMOST_YOUR_TURN_POSITION && (
                    <a
                      href={notifyLink(token)}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${chipBtnClass} shrink-0 px-2`}
                      title="Send an 'almost your turn' message on WhatsApp"
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Notify on WhatsApp</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {queue.length > WAITING_LIST_LENGTH && (
          <p className="pt-3 text-center text-xs text-muted">
            and {queue.length - WAITING_LIST_LENGTH} more
          </p>
        )}
      </SectionCard>

      <SkippedList />

      <ConfirmDialog
        open={Boolean(jumpTarget)}
        title="Call this token out of turn?"
        message={
          jumpTarget
            ? `${tokenLabel(jumpTarget, serviceById(jumpTarget.serviceId))} is not next in line. Everyone ahead of them keeps their place.`
            : ""
        }
        confirmLabel="Call them"
        danger={false}
        onCancel={() => setJumpTarget(null)}
        onConfirm={() => {
          const target = jumpTarget;
          setJumpTarget(null);
          if (target) void run(() => callToken(target.id, counterId));
        }}
      />

      <ConfirmDialog
        open={Boolean(cancelTarget)}
        title="Cancel this token?"
        message="The number is not reused, and the token stays in today's history as cancelled."
        confirmLabel="Cancel token"
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          const target = cancelTarget;
          setCancelTarget(null);
          if (target) void run(() => cancelToken(target.id));
        }}
      />

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title="Transfer this token">
        {current && (
          <div className="grid gap-4">
            <p className="text-sm text-muted">
              {tokenLabel(current, serviceById(current.serviceId))} keeps its number wherever it
              goes — the person holding the slip has been told to watch for that number.
            </p>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                To another service
              </h4>
              <div className="flex flex-wrap gap-2">
                {services
                  .filter((service) => service.active && service.id !== current.serviceId)
                  .map((service) => (
                    <button
                      key={service.id}
                      type="button"
                      className={chipBtnClass}
                      onClick={() => {
                        setTransferOpen(false);
                        void run(() => transferToken(current.id, { serviceId: service.id }));
                      }}
                    >
                      <ServiceDot colour={service.colour} />
                      {service.name}
                    </button>
                  ))}
                {services.filter((s) => s.active && s.id !== current.serviceId).length === 0 && (
                  <p className="text-sm text-muted">There is only one service.</p>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                They go back to waiting, at the end of the new line.
              </p>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                To another counter
              </h4>
              <div className="flex flex-wrap gap-2">
                {countersForService(counters, current.serviceId)
                  .filter((row) => row.id !== counterId)
                  .map((row) => (
                    <button
                      key={row.id}
                      type="button"
                      className={chipBtnClass}
                      onClick={() => {
                        setTransferOpen(false);
                        void run(() => transferToken(current.id, { counterId: row.id }));
                      }}
                    >
                      {row.name}
                    </button>
                  ))}
                {countersForService(counters, current.serviceId).filter((r) => r.id !== counterId)
                  .length === 0 && (
                  <p className="text-sm text-muted">No other counter takes this service.</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );

  function SkippedList() {
    const skipped = todayTokens.filter((token) => token.status === "skipped");
    if (skipped.length === 0) return null;
    return (
      <SectionCard title={`Skipped (${skipped.length})`}>
        <ul className="divide-y divide-muted-line/20">
          {skipped.map((token) => (
            <li key={token.id} className="flex items-center justify-between gap-3 py-2.5">
              <span className="flex items-center gap-3">
                <span className="text-lg font-extrabold text-ink">
                  {tokenLabel(token, serviceById(token.serviceId))}
                </span>
                <span className="text-xs text-muted">
                  {token.customerName || serviceById(token.serviceId)?.name}
                </span>
              </span>
              <button
                type="button"
                className={chipBtnClass}
                disabled={busy}
                onClick={() => void run(() => restoreToken(token.id))}
              >
                <Undo2 className="h-4 w-4" aria-hidden="true" />
                Put back
              </button>
            </li>
          ))}
        </ul>
        <p className="pt-3 text-xs text-muted">
          They rejoin at the end of the line. The time they first arrived is kept, so today&apos;s
          average wait still tells the truth.
        </p>
      </SectionCard>
    );
  }
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-muted-line/30 bg-white px-3 py-2.5 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">{label}</div>
      <div className="mt-0.5 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}
