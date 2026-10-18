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
import { countersForService, useToken } from "@/lib/token/store";
import { readLocal, writeLocal } from "@/lib/toolkit/storage";
import {
  activeCountersForService,
  estimateWaitMinutes,
  formatCountdown,
  nextInQueue,
  secondsUntilSkip,
  shouldOfferSkip,
  waitingQueue,
} from "@/lib/token/calc";
import { averageWaitMinutes } from "@/lib/token/calc";
import { useI18n } from "@/lib/i18n";
import { fill, type TKey } from "@/lib/i18n/translate";
import { formatClock, formatMinutes } from "@/lib/token/reports";
import { whatsAppLinkFor } from "@/lib/token/messages";
import {
  ALMOST_YOUR_TURN_POSITION,
  tokenLabel,
  type MessageTemplateKey,
  type Token,
} from "@/lib/token/types";
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

/** Now, once a second, for anything on this screen that counts. */
function useTick(active: boolean): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!active) return;
    const timer = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(timer);
  }, [active]);
  return now;
}

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
  const { t, lang } = useI18n();
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
    markCameBack,
    cancelToken,
    transferToken,
  } = useToken();

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

  const counting = Boolean(settings.autoSkipEnabled && current?.status === "called");
  const now = useTick(counting);
  const secondsLeft =
    counting && current ? secondsUntilSkip(current, settings.autoSkipMinutes, now) : null;

  const servedByMe = todayTokens.filter(
    (token) => token.counterId === counterId && token.status === "served"
  ).length;
  const averageWait = averageWaitMinutes(todayTokens);

  const [jumpTarget, setJumpTarget] = useState<Token | null>(null);
  const [cancelTarget, setCancelTarget] = useState<Token | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [reissued, setReissued] = useState<Token | null>(null);
  const [busy, setBusy] = useState(false);

  const run = async (action: () => Promise<unknown>) => {
    setBusy(true);
    try {
      await action();
    } finally {
      setBusy(false);
    }
  };

  const messageLink = (token: Token, key: MessageTemplateKey) =>
    whatsAppLinkFor(key, settings, {
      token,
      service: serviceById(token.serviceId),
      counter: token.counterId ? counters.find((row) => row.id === token.counterId) : counter,
      businessName: business?.name ?? "",
      tokens: todayTokens,
      counters,
      minutes: settings.autoSkipMinutes,
      lang,
    });

  return (
    <div className="grid gap-4">
      {counters.filter((row) => row.active).length > 1 && (
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold uppercase tracking-wide text-muted">
            {t("tkCoThisDeviceIs")}
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
                      {fill(t("tkCoCalledTimes"), { count: current.recallCount + 1 })}
                    </span>
                  )}
                </div>
                <div className="mt-2 text-6xl font-extrabold leading-none tracking-tight text-ink sm:text-7xl">
                  {tokenLabel(current, serviceById(current.serviceId))}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-2 text-sm text-muted">
                  <ServiceDot colour={serviceById(current.serviceId)?.colour ?? "#5F6478"} />
                  {serviceById(current.serviceId)?.name ?? t("tkCoRemovedService")}
                  {current.customerName && <span>· {current.customerName}</span>}
                </div>
              </div>
              <div className="text-right">
                <div className="text-xs font-semibold uppercase tracking-wide text-muted">
                  {current.status === "serving"
                    ? t("tkCoServingFor")
                    : secondsLeft !== null
                      ? t("tkCoSkipsIn")
                      : t("tkStCalled")}
                </div>
                <div
                  className={`text-2xl font-bold tabular-nums ${
                    secondsLeft !== null && secondsLeft <= 30 ? "text-red-600" : "text-ink"
                  }`}
                >
                  {current.status === "serving"
                    ? elapsed
                    : secondsLeft !== null
                      ? formatCountdown(secondsLeft)
                      : formatClock(current.calledAt, lang)}
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
                {t("tkCoRecall")}
              </button>

              {current.status === "called" ? (
                <button
                  type="button"
                  className={`${chipBtnClass} border-indigo bg-indigo/10 text-indigo`}
                  disabled={busy}
                  onClick={() => void run(() => startServing(current.id))}
                >
                  <Play className="h-4 w-4" aria-hidden="true" />
                  {t("tkCoStartServing")}
                </button>
              ) : (
                <button
                  type="button"
                  className={`${chipBtnClass} border-green-300 bg-green-50 text-green-800`}
                  disabled={busy}
                  onClick={() => void run(() => completeToken(current.id))}
                >
                  <Check className="h-4 w-4" aria-hidden="true" />
                  {t("tkCoDone")}
                </button>
              )}

              {current.status === "called" && current.phone && (
                <a
                  href={messageLink(current, "waitingForYou")}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={chipBtnClass}
                >
                  <MessageCircle className="h-4 w-4" aria-hidden="true" />
                  {t("tkCoWereWaiting")}
                </a>
              )}

              <button
                type="button"
                className={chipBtnClass}
                disabled={busy}
                onClick={() => setTransferOpen(true)}
              >
                <ArrowRightLeft className="h-4 w-4" aria-hidden="true" />
                {t("tkCoTransfer")}
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
                {shouldOfferSkip(current) ? t("tkCoNoShowSkip") : t("tkCoSkip")}
              </button>

              <button
                type="button"
                className={chipBtnClass}
                disabled={busy}
                onClick={() => setCancelTarget(current)}
              >
                <Ban className="h-4 w-4" aria-hidden="true" />
                {t("cancel")}
              </button>
            </div>

            {/* Done is not offered on a token that never started, and that is
                deliberate: every served token carries a start time, so the
                average service time on the reports means something. */}
            {current.status === "called" && (
              <p className="mt-3 text-xs text-muted">
                {fill(t("tkCoStartServingHint"), { startServing: t("tkCoStartServing") })}
                {secondsLeft !== null && (
                  <>
                    {" "}
                    {fill(t("tkCoSkipCountdown"), {
                      time: formatCountdown(secondsLeft),
                      wereWaiting: t("tkCoWereWaiting"),
                    })}
                  </>
                )}
              </p>
            )}
          </div>
        ) : (
          <EmptyState
            icon={<PhoneCall className="h-6 w-6" aria-hidden="true" />}
            title={t("tkCoNobodyHere")}
            message={upNext ? t("tkCoTapCallNext") : t("tkCoQueueEmpty")}
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
            ? fill(t("tkCoCallNext"), {
                token: tokenLabel(upNext, serviceById(upNext.serviceId)),
              })
            : t("tkIsNoOneWaiting")}
        </button>
      </section>

      <div className="grid grid-cols-3 gap-2">
        <Stat label="tkStWaiting" value={String(queue.length)} />
        <Stat label="tkCoAvgWaitToday" value={formatMinutes(averageWait, lang)} />
        <Stat label="tkCoServedByMe" value={String(servedByMe)} />
      </div>

      <SectionCard title={fill(t("tkCoWaitingN"), { count: queue.length })}>
        {queue.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted">{t("tkCoNobodyWaiting")}</p>
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
                        {service?.name ?? t("tkCoRemovedService")}
                      </span>
                      <span className="truncate text-xs text-muted">
                        {token.customerName || formatClock(token.issuedAt, lang)} ·{" "}
                        {wait === 0 ? t("tkCoNext") : fill(t("tkCoMinN"), { n: wait })}
                      </span>
                    </span>
                    {token.priority && <PriorityFlag className="ml-auto shrink-0" />}
                  </button>
                  {token.phone && index + 1 <= ALMOST_YOUR_TURN_POSITION && (
                    <a
                      href={messageLink(token, "almostYourTurn")}
                      target="_blank"
                      rel="noopener noreferrer"
                      className={`${chipBtnClass} shrink-0 px-2`}
                      title={t("tkCoNotifyTitle")}
                    >
                      <MessageCircle className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">{t("tkCoNotifyWhatsApp")}</span>
                    </a>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {queue.length > WAITING_LIST_LENGTH && (
          <p className="pt-3 text-center text-xs text-muted">
            {fill(t("tkCoAndMore"), { count: queue.length - WAITING_LIST_LENGTH })}
          </p>
        )}
      </SectionCard>

      {reissued && (
        <section className="rounded-2xl border-2 border-indigo bg-indigo/5 p-5 text-center">
          <p className="text-xs font-semibold uppercase tracking-wide text-muted">
            {fill(t("tkCoNewTokenFor"), {
              name: reissued.customerName || t("tkCoThem"),
            })}
          </p>
          <p className="mt-1 text-5xl font-extrabold leading-none tracking-tight text-ink">
            {tokenLabel(reissued, serviceById(reissued.serviceId))}
          </p>
          <p className="mt-2 text-sm text-muted">
            {t("tkCoBehindEveryone")}
          </p>
          <div className="mt-4 flex flex-wrap items-center justify-center gap-2">
            {reissued.phone && (
              <a
                href={messageLink(reissued, "tokenIssued")}
                target="_blank"
                rel="noopener noreferrer"
                className={chipBtnClass}
              >
                <MessageCircle className="h-4 w-4" aria-hidden="true" />
                {t("tkCoSendNewNumber")}
              </a>
            )}
            <button
              type="button"
              className={secondaryBtnClass}
              onClick={() => setReissued(null)}
            >
              {t("tkCoDone")}
            </button>
          </div>
        </section>
      )}

      <SkippedList />

      <ConfirmDialog
        open={Boolean(jumpTarget)}
        title={t("tkCoJumpTitle")}
        message={
          jumpTarget
            ? fill(t("tkCoJumpMessage"), {
                token: tokenLabel(jumpTarget, serviceById(jumpTarget.serviceId)),
              })
            : ""
        }
        confirmLabel={t("tkCoCallThem")}
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
        title={t("tkCoCancelTitle")}
        message={t("tkCoCancelMessage")}
        confirmLabel={t("tkCoCancelToken")}
        onCancel={() => setCancelTarget(null)}
        onConfirm={() => {
          const target = cancelTarget;
          setCancelTarget(null);
          if (target) void run(() => cancelToken(target.id));
        }}
      />

      <Modal open={transferOpen} onClose={() => setTransferOpen(false)} title={t("tkCoTransferTitle")}>
        {current && (
          <div className="grid gap-4">
            <p className="text-sm text-muted">
              {fill(t("tkCoTransferBlurb"), {
                token: tokenLabel(current, serviceById(current.serviceId)),
              })}
            </p>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {t("tkCoToAnotherService")}
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
                  <p className="text-sm text-muted">{t("tkCoOnlyOneService")}</p>
                )}
              </div>
              <p className="mt-2 text-xs text-muted">
                {t("tkCoBackToWaiting")}
              </p>
            </div>

            <div>
              <h4 className="mb-2 text-xs font-semibold uppercase tracking-wide text-muted">
                {t("tkCoToAnotherCounter")}
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
                  <p className="text-sm text-muted">{t("tkCoNoOtherCounter")}</p>
                )}
              </div>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );

  function SkippedList() {
    const skipped = todayTokens.filter(
      (token) => token.status === "skipped" && !token.reissuedAsId
    );
    if (skipped.length === 0) return null;
    return (
      <SectionCard title={fill(t("tkCoSkippedN"), { count: skipped.length })}>
        <ul className="divide-y divide-muted-line/20">
          {skipped.map((token) => (
            <li key={token.id} className="flex flex-wrap items-center justify-between gap-2 py-2.5">
              <span className="flex items-center gap-3">
                <span className="text-lg font-extrabold text-ink">
                  {tokenLabel(token, serviceById(token.serviceId))}
                </span>
                <span className="text-xs text-muted">
                  {token.customerName || serviceById(token.serviceId)?.name}
                </span>
              </span>
              <span className="flex items-center gap-2">
                {token.phone && (
                  <a
                    href={messageLink(token, "skipped")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={chipBtnClass}
                  >
                    <MessageCircle className="h-4 w-4" aria-hidden="true" />
                    {t("tkCoTellThem")}
                  </a>
                )}
                <button
                  type="button"
                  className={chipBtnClass}
                  disabled={busy}
                  onClick={() => void run(async () => {
                    const replacement = await markCameBack(token.id);
                    if (replacement) setReissued(replacement);
                  })}
                >
                  <Undo2 className="h-4 w-4" aria-hidden="true" />
                  {t("tkCoCameBack")}
                </button>
              </span>
            </li>
          ))}
        </ul>
        <p className="pt-3 text-xs text-muted">
          {t("tkCoCameBackNote")}
        </p>
      </SectionCard>
    );
  }
}

function Stat({ label, value }: { label: TKey; value: string }) {
  const { t } = useI18n();
  return (
    <div className="rounded-xl border border-muted-line/30 bg-white px-3 py-2.5 text-center">
      <div className="text-[11px] font-semibold uppercase tracking-wide text-muted">
        {t(label)}
      </div>
      <div className="mt-0.5 text-lg font-bold text-ink">{value}</div>
    </div>
  );
}
