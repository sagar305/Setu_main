"use client";

import { useI18n } from "@/lib/i18n";
import { fill } from "@/lib/i18n/translate";
import { useEffect, useMemo, useState } from "react";
import {
  CalendarClock,
  CalendarPlus,
  Check,
  Download,
  MessageCircle,
  Pencil,
  TriangleAlert,
  Wallet,
  X,
} from "lucide-react";
import { useDine, type ReservationInput } from "@/lib/dine/store";
import { formatPaise, formatPlain, parseAmount } from "@/lib/dine/money";
import { downloadCsv, reservationsCsv } from "@/lib/dine/csv";
import {
  cancellationMessage,
  conflictsFor,
  confirmationMessage,
  depositDue,
  formatSlot,
  isLate,
  reminderMessage,
  whatsappUrl,
  windowOf,
} from "@/lib/dine/reservation";
import {
  reservationStatusLabel,
  kindOf,
  type DineReservation,
  type ReservationStatus,
} from "@/lib/dine/types";
import {
  ConfirmDialog,
  EmptyState,
  Field,
  Modal,
  SectionHeading,
  StatCard,
  dangerBtnClass,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  tapTargetClass,
} from "./ui";

/** datetime-local wants wall-clock text, not a UTC instant. */
function toLocalInput(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "";
  const pad = (n: number) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours()
  )}:${pad(date.getMinutes())}`;
}

function fromLocalInput(value: string): string {
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? "" : date.toISOString();
}

/** The next round half-hour, which is what a booking is almost always for. */
function defaultSlot(): string {
  const date = new Date();
  date.setSeconds(0, 0);
  date.setMinutes(date.getMinutes() > 30 ? 60 : 30);
  return toLocalInput(date.toISOString());
}

type Filter = "today" | "upcoming" | "past";

/**
 * Table bookings.
 *
 * A booking is a promise about a table at a time, so the screen is organised
 * around the two moments that promise gets tested: taking it (is that table
 * already promised to someone else?) and the night itself (are they here,
 * are they late, do we still hold it?).
 *
 * WhatsApp is a deep link, never an API. A restaurant sends the message from
 * its own number, sees it before it goes, and no diner's phone number is ever
 * sent to a server.
 */
export function ReservationsScreen({ onOpenTicket }: { onOpenTicket: (id: string) => void }) {
  const { t } = useI18n();
  const {
    reservations,
    business,
    settings,
    updateSettings,
    seatReservation,
    markReservationNoShow,
  } = useDine();

  const currency = business?.currency ?? "INR";
  const [filter, setFilter] = useState<Filter>("today");
  const [editing, setEditing] = useState<DineReservation | null>(null);
  const [creating, setCreating] = useState(false);
  const [depositFor, setDepositFor] = useState<DineReservation | null>(null);
  const [cancelling, setCancelling] = useState<DineReservation | null>(null);
  const [noShowFor, setNoShowFor] = useState<DineReservation | null>(null);

  // The late badges are only honest if the clock keeps moving.
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const dayStart = useMemo(() => {
    const date = new Date(now);
    date.setHours(0, 0, 0, 0);
    return date.getTime();
  }, [now]);
  const dayEnd = dayStart + 86_400_000;

  const visible = useMemo(() => {
    const rows = reservations.slice().sort((a, b) => windowOf(a).start - windowOf(b).start);
    if (filter === "today") {
      return rows.filter((row) => {
        const { start } = windowOf(row);
        return start >= dayStart && start < dayEnd;
      });
    }
    if (filter === "upcoming") return rows.filter((row) => windowOf(row).start >= dayEnd);
    return rows.filter((row) => windowOf(row).start < dayStart).reverse();
  }, [dayEnd, dayStart, filter, reservations]);

  const todayRows = useMemo(
    () =>
      reservations.filter((row) => {
        const { start } = windowOf(row);
        return start >= dayStart && start < dayEnd;
      }),
    [dayEnd, dayStart, reservations]
  );
  const covers = todayRows
    .filter((row) => row.status === "booked" || row.status === "seated")
    .reduce((sum, row) => sum + row.partySize, 0);
  const heldDeposits = reservations
    .filter((row) => row.status === "booked")
    .reduce((sum, row) => sum + row.depositPaid, 0);

  if (!settings.reservationsEnabled) {
    return (
      <EmptyState
        icon={<CalendarClock className="h-6 w-6" />}
        title={t("dnRsBookingsOff")}
        message={t("dnRsBookingsOffBody")}
        action={
          <button
            type="button"
            onClick={() => void updateSettings({ reservationsEnabled: true })}
            className={primaryBtnClass}
          >
            <CalendarClock className="h-4 w-4" />
            Turn on bookings
          </button>
        }
      />
    );
  }

  return (
    <div className="space-y-5">
      <SectionHeading
        title={t("dnNavBookings")}
        subtitle={
          todayRows.length === 0
            ? t("dnRsNothingToday")
            : fill(t("dnRsTodaySubtitle"), {
                n: todayRows.length,
                covers: fill(t(covers === 1 ? "dnRsCover1" : "dnRsCoverN"), { n: covers }),
              })
        }
        action={
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              disabled={reservations.length === 0}
              onClick={() =>
                downloadCsv("bookings.csv", reservationsCsv(reservations, currency))
              }
              className={secondaryBtnClass}
            >
              <Download className="h-4 w-4" />
              Export
            </button>
            <button type="button" onClick={() => setCreating(true)} className={primaryBtnClass}>
              <CalendarPlus className="h-4 w-4" />
              {t("dnRsNewBooking")}
            </button>
          </div>
        }
      />

      <div className="grid gap-3 sm:grid-cols-3">
        <StatCard label={t("dnRsBookedToday")} value={String(todayRows.length)} sub={fill(t(covers === 1 ? "dnRsCover1" : "dnRsCoverN"), { n: covers })} />
        <StatCard
          label={t("dnRpAdvancesHeld")}
          value={formatPaise(heldDeposits, currency)}
          sub={t("dnRsComesOffBills")}
        />
        <StatCard
          label={t("dnRsWaitingToArrive")}
          value={String(todayRows.filter((row) => row.status === "booked").length)}
          sub={fill(t("dnRsLateCount"), { n: todayRows.filter((row) => isLate(row, now, settings.reservationHoldMinutes)).length })}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {(
          [
            ["today", t("today")],
            ["upcoming", t("dnRsUpcoming")],
            ["past", t("dnRsPast")],
          ] as [Filter, string][]
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            aria-pressed={filter === value}
            className={`${tapTargetClass} rounded-xl border px-4 py-2 text-sm font-semibold transition ${
              filter === value
                ? "border-indigo bg-indigo text-white"
                : "border-muted-line/40 bg-white text-ink hover:border-indigo/50"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState
          icon={<CalendarClock className="h-6 w-6" />}
          title={filter === "past" ? t("dnRsNothingPast") : t("dnRsNothingBooked")}
          message={
            filter === "today"
              ? t("dnRsTakeOverPhone")
              : t("dnRsOtherDaysHere")
          }
        />
      ) : (
        <div className="space-y-3">
          {visible.map((reservation) => (
            <ReservationCard
              key={reservation.id}
              reservation={reservation}
              now={now}
              onEdit={() => setEditing(reservation)}
              onDeposit={() => setDepositFor(reservation)}
              onCancel={() => setCancelling(reservation)}
              onNoShow={() => setNoShowFor(reservation)}
              onSeat={async () => {
                const ticket = await seatReservation(reservation.id);
                if (ticket) onOpenTicket(ticket.id);
              }}
            />
          ))}
        </div>
      )}

      {(creating || editing) && (
        <ReservationModal
          reservation={editing}
          onClose={() => {
            setCreating(false);
            setEditing(null);
          }}
        />
      )}

      {depositFor && (
        <DepositModal reservation={depositFor} onClose={() => setDepositFor(null)} />
      )}

      {cancelling && (
        <CancelModal reservation={cancelling} onClose={() => setCancelling(null)} />
      )}

      {noShowFor && (
        <ConfirmDialog
          open
          title={t("dnRsNoShowTitle")}
          message={
            noShowFor.depositPaid > 0
              ? fill(t("dnRsNoShowKept"), {
                  name: noShowFor.guestName,
                  amount: formatPaise(noShowFor.depositPaid, currency),
                })
              : fill(t("dnRsNoShowReleased"), { name: noShowFor.guestName })
          }
          confirmLabel={t("dnRsMarkNoShow")}
          onConfirm={async () => {
            await markReservationNoShow(noShowFor.id, "forfeited");
            setNoShowFor(null);
          }}
          onCancel={() => setNoShowFor(null)}
        />
      )}
    </div>
  );
}

const STATUS_STYLE: Record<ReservationStatus, string> = {
  booked: "bg-indigo/10 text-indigo",
  seated: "bg-green-100 text-green-800",
  completed: "bg-muted-line/30 text-muted",
  cancelled: "bg-muted-line/30 text-muted",
  "no-show": "bg-red-100 text-red-700",
};

function ReservationCard({
  reservation,
  now,
  onSeat,
  onEdit,
  onDeposit,
  onCancel,
  onNoShow,
}: {
  reservation: DineReservation;
  now: number;
  onSeat: () => void | Promise<void>;
  onEdit: () => void;
  onDeposit: () => void;
  onCancel: () => void;
  onNoShow: () => void;
}) {
  const { lang, t } = useI18n();
  const { business, settings } = useDine();
  const currency = business?.currency ?? "INR";
  const late = isLate(reservation, now, settings.reservationHoldMinutes);
  const due = depositDue(reservation);

  const message = confirmationMessage({
    businessName: business?.name ?? "our restaurant",
    reservation,
    currency,
    lang,
    address: business?.address || undefined,
    phone: business?.phone || undefined,
    upiId: business?.upiId || undefined,
  });
  const nudge = reminderMessage({
    businessName: business?.name ?? "our restaurant",
    reservation,
    currency,
    lang,
  });

  return (
    <div className="rounded-2xl border border-muted-line/40 bg-white p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex flex-wrap items-center gap-2">
            <p className="text-base font-bold text-ink">{reservation.guestName || t("dnFlGuest")}</p>
            <span
              className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                STATUS_STYLE[reservation.status]
              }`}
            >
              {reservationStatusLabel(reservation.status, lang)}
            </span>
            {late && (
              <span className="flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs font-semibold text-amber-800">
                <TriangleAlert className="h-3 w-3" />
                {t("dnRsLate")}
              </span>
            )}
          </div>
          <p className="mt-1 text-sm text-muted">
            {formatSlot(reservation.startsAt, lang)} ·{" "}
            {fill(t(reservation.partySize === 1 ? "dnRsGuest1" : "dnRsGuestN"), {
              n: reservation.partySize,
            })}
            {reservation.tableName
              ? ` · ${reservation.tableName}`
              : ` · ${t("dnRsAnyTable")}`}
          </p>
          {reservation.occasion && (
            <p className="text-sm text-muted">🎉 {reservation.occasion}</p>
          )}
          {reservation.note && <p className="text-sm text-muted">{reservation.note}</p>}
        </div>

        <div className="text-right">
          {reservation.depositRequired > 0 ? (
            <>
              <p className="text-sm font-bold text-ink">
                {formatPaise(reservation.depositPaid, currency)}
                <span className="font-normal text-muted">
                  {" "}
                  / {formatPaise(reservation.depositRequired, currency)}
                </span>
              </p>
              <p className="text-xs text-muted">
                {due > 0 ? fill(t("dnRsStillToCollect"), { amount: formatPaise(due, currency) }) : t("dnRsAdvanceReceived")}
              </p>
            </>
          ) : (
            <p className="text-xs text-muted">{t("dnRsFreeBooking")}</p>
          )}
          {reservation.depositOutcome === "forfeited" && (
            <p className="text-xs font-semibold text-amber-700">{t("dnRsAdvanceKept")}</p>
          )}
          {reservation.depositOutcome === "refunded" && (
            <p className="text-xs font-semibold text-muted">{t("dnRsAdvanceRefunded")}</p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-wrap gap-2">
        {reservation.status === "booked" && (
          <>
            <button
              type="button"
              onClick={() => void onSeat()}
              className={`${primaryBtnClass} px-3 py-1.5 text-xs`}
            >
              <Check className="h-3.5 w-3.5" />
              {t("dnRsSeatThem")}
            </button>
            {due > 0 && (
              <button
                type="button"
                onClick={onDeposit}
                className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
              >
                <Wallet className="h-3.5 w-3.5" />
                {t("dnRsTakeAdvance")}
              </button>
            )}
          </>
        )}

        {reservation.phone && (
          <>
            <a
              href={whatsappUrl(reservation.phone, message, settings.whatsappDialCode)}
              target="_blank"
              rel="noopener noreferrer"
              className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
            >
              <MessageCircle className="h-3.5 w-3.5" />
              {t("dnRsConfirmWhatsApp")}
            </a>
            {reservation.status === "booked" && (
              <a
                href={whatsappUrl(reservation.phone, nudge, settings.whatsappDialCode)}
                target="_blank"
                rel="noopener noreferrer"
                className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
              >
                <MessageCircle className="h-3.5 w-3.5" />
                {t("dnRsRemind")}
              </a>
            )}
          </>
        )}

        {reservation.status === "booked" && (
          <>
            <button
              type="button"
              onClick={onEdit}
              aria-label={fill(t("dnRsEditBookingFor"), { name: reservation.guestName })}
              className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
            >
              <Pencil className="h-3.5 w-3.5" />
            </button>
            {late && (
              <button
                type="button"
                onClick={onNoShow}
                className={`${secondaryBtnClass} px-3 py-1.5 text-xs`}
              >
                No-show
              </button>
            )}
            <button
              type="button"
              onClick={onCancel}
              className={`${dangerBtnClass} px-3 py-1.5 text-xs`}
            >
              <X className="h-3.5 w-3.5" />
              Cancel
            </button>
          </>
        )}
      </div>
    </div>
  );
}

/**
 * Taking or changing a booking.
 *
 * The conflict warning is the point of this form. It shows as soon as the
 * table and time are chosen, before saving, because finding out about a double
 * booking afterwards means phoning someone back.
 */
function ReservationModal({
  reservation,
  onClose,
}: {
  reservation: DineReservation | null;
  onClose: () => void;
}) {
  const { lang, t } = useI18n();
  const {
    tables,
    areas,
    reservations,
    settings,
    business,
    createReservation,
    updateReservation,
  } = useDine();
  const currency = business?.currency ?? "INR";

  const [guestName, setGuestName] = useState(reservation?.guestName ?? "");
  const [phone, setPhone] = useState(reservation?.phone ?? "");
  const [partySize, setPartySize] = useState(String(reservation?.partySize ?? 2));
  const [tableId, setTableId] = useState(reservation?.tableId ?? "");
  const [startsAt, setStartsAt] = useState(() =>
    reservation ? toLocalInput(reservation.startsAt) : defaultSlot()
  );
  const [duration, setDuration] = useState(
    String(reservation?.durationMinutes ?? settings.reservationDefaultMinutes)
  );
  const [deposit, setDeposit] = useState(() => {
    const value = reservation?.depositRequired ?? settings.reservationDefaultDeposit;
    return value > 0 ? formatPlain(value) : "";
  });
  const [occasion, setOccasion] = useState(reservation?.occasion ?? "");
  const [note, setNote] = useState(reservation?.note ?? "");
  const [busy, setBusy] = useState(false);

  const areaById = useMemo(() => new Map(areas.map((area) => [area.id, area])), [areas]);

  const conflicts = useMemo(() => {
    const iso = fromLocalInput(startsAt);
    if (!iso || !tableId) return [];
    return conflictsFor(
      {
        id: reservation?.id ?? "new",
        tableId,
        startsAt: iso,
        durationMinutes: Number(duration) || settings.reservationDefaultMinutes,
      },
      reservations
    );
  }, [duration, reservation?.id, reservations, settings.reservationDefaultMinutes, startsAt, tableId]);

  const input = (): ReservationInput => ({
    customerId: reservation?.customerId ?? null,
    guestName,
    phone,
    partySize: Number(partySize) || 1,
    tableId: tableId || null,
    startsAt: fromLocalInput(startsAt),
    durationMinutes: Number(duration) || settings.reservationDefaultMinutes,
    depositRequired: parseAmount(deposit),
    occasion,
    note,
  });

  return (
    <Modal
      open
      onClose={onClose}
      title={reservation ? t("dnRsEditBooking") : t("dnRsNewBooking")}
    >
      <div className="space-y-4">
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dnRsGuestName")} required>
            <input
              value={guestName}
              onChange={(event) => setGuestName(event.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field label={t("phone")} hint={t("dnRsPhoneHint")}>
            <input
              inputMode="tel"
              value={phone}
              onChange={(event) => setPhone(event.target.value)}
              placeholder="98765 43210"
              className={inputClass}
            />
          </Field>
        </div>

        <div className="grid gap-4 sm:grid-cols-3">
          <Field label={t("dnRsDateAndTime")} required>
            <input
              type="datetime-local"
              value={startsAt}
              onChange={(event) => setStartsAt(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("dnRsGuests")}>
            <input
              inputMode="numeric"
              value={partySize}
              onChange={(event) => setPartySize(event.target.value)}
              className={inputClass}
            />
          </Field>
          <Field label={t("dnRsForHowLong")}>
            <input
              inputMode="numeric"
              value={duration}
              onChange={(event) => setDuration(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t("dnBlColTable")} hint={t("dnRsTableHint")}>
          <select
            value={tableId}
            onChange={(event) => setTableId(event.target.value)}
            className={inputClass}
          >
            <option value="">{t("dnRsAnyTable")}</option>
            {tables.map((table) => (
              <option key={table.id} value={table.id}>
                {table.name}
                {areaById.get(table.areaId) ? ` · ${areaById.get(table.areaId)!.name}` : ""} (
                {fill(t("dnRsSeatsCount"), { n: table.seats })})
              </option>
            ))}
          </select>
        </Field>

        {conflicts.length > 0 && (
          <div className="flex items-start gap-2 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />
            <div>
              <p className="font-semibold">{t("dnRsTablePromised")}</p>
              {conflicts.map((row) => (
                <p key={row.id} className="text-xs">
                  {fill(t("dnRsConflictRow"), {
                    name: row.guestName || t("dnFlGuest"),
                    slot: formatSlot(row.startsAt, lang),
                    n: row.partySize,
                  })}
                </p>
              ))}
              <p className="mt-1 text-xs">
                {t("dnRsStillSave")}
              </p>
            </div>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-2">
          <Field
            label={t("dnRsAdvanceToCollect")}
            hint={t("dnRsAdvanceHint")}
          >
            <input
              inputMode="decimal"
              value={deposit}
              onChange={(event) => setDeposit(event.target.value)}
              placeholder={t("dnRsNoAdvance")}
              className={inputClass}
            />
          </Field>
          <Field label={t("dnRsOccasion")} hint={t("dnRsOccasionHint")}>
            <input
              value={occasion}
              onChange={(event) => setOccasion(event.target.value)}
              className={inputClass}
            />
          </Field>
        </div>

        <Field label={t("note")}>
          <textarea
            value={note}
            onChange={(event) => setNote(event.target.value)}
            rows={2}
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || !guestName.trim() || !fromLocalInput(startsAt)}
            onClick={async () => {
              setBusy(true);
              try {
                if (reservation) await updateReservation(reservation.id, input());
                else await createReservation(input());
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            className={`${primaryBtnClass} ${tapTargetClass}`}
          >
            {busy ? t("clPfSaving") : reservation ? t("dnRsSaveBooking") : t("dnRsTakeBooking")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/** Recording an advance that has actually arrived. */
function DepositModal({
  reservation,
  onClose,
}: {
  reservation: DineReservation;
  onClose: () => void;
}) {
  const { t } = useI18n();
  const { paymentMethods, business, takeReservationDeposit } = useDine();
  const currency = business?.currency ?? "INR";
  const due = depositDue(reservation);

  // Booking a table on a regular's khata is allowed, so credit stays in the
  // list — but only when the booking is against a diner we can charge.
  const usable = paymentMethods.filter(
    (method) => kindOf(method) === "normal" || (kindOf(method) === "credit" && reservation.customerId)
  );

  const [amount, setAmount] = useState(() => formatPlain(due));
  const [methodId, setMethodId] = useState(usable[0]?.id ?? "");
  const [busy, setBusy] = useState(false);

  return (
    <Modal
      open
      onClose={onClose}
      title={fill(t("dnRsAdvanceFrom"), {
        name: reservation.guestName || t("dnRsGuestFallback"),
      })}
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-cream-paper p-3 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">{t("dnRsAskedFor")}</span>
            <span className="font-bold text-ink">
              {formatPaise(reservation.depositRequired, currency)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">{t("dnRsAlreadyReceived")}</span>
            <span className="font-bold text-ink">
              {formatPaise(reservation.depositPaid, currency)}
            </span>
          </div>
        </div>

        <div className="grid gap-4 sm:grid-cols-2">
          <Field label={t("dnRsAmountReceived")}>
            <input
              inputMode="decimal"
              value={amount}
              onChange={(event) => setAmount(event.target.value)}
              autoFocus
              className={inputClass}
            />
          </Field>
          <Field label={t("dnRsTakenAs")}>
            <select
              value={methodId}
              onChange={(event) => setMethodId(event.target.value)}
              className={inputClass}
            >
              {usable.map((method) => (
                <option key={method.id} value={method.id}>
                  {method.name}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <p className="text-xs text-muted">
          This is money held, not a sale. It comes off their bill when they sit down, so it only
          reaches your takings on the night they eat.
        </p>

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            Cancel
          </button>
          <button
            type="button"
            disabled={busy || parseAmount(amount) <= 0 || !methodId}
            onClick={async () => {
              setBusy(true);
              try {
                await takeReservationDeposit(reservation.id, parseAmount(amount), methodId);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
            className={`${primaryBtnClass} ${tapTargetClass}`}
          >
            <Wallet className="h-4 w-4" />
            {busy ? t("clPfSaving") : t("dnRsRecordAdvance")}
          </button>
        </div>
      </div>
    </Modal>
  );
}

/**
 * Cancelling, and deciding what happens to any advance.
 *
 * The guest is told which it was in the WhatsApp message, so the choice is
 * made explicitly here rather than defaulted silently.
 */
function CancelModal({
  reservation,
  onClose,
}: {
  reservation: DineReservation;
  onClose: () => void;
}) {
  const { lang, t } = useI18n();
  const { business, settings, cancelReservation } = useDine();
  const currency = business?.currency ?? "INR";
  const [reason, setReason] = useState("");
  const [outcome, setOutcome] = useState<"refunded" | "forfeited">("refunded");
  const [busy, setBusy] = useState(false);
  const [done, setDone] = useState<DineReservation | null>(null);

  if (done) {
    const message = cancellationMessage({
      businessName: business?.name ?? "our restaurant",
      reservation: done,
      currency,
      lang,
    });
    return (
      <Modal open onClose={onClose} title={t("dnRsBookingCancelled")}>
        <div className="space-y-4">
          <p className="text-sm text-muted">
            {t("dnRsTableReleased")}
          </p>
          <div className="flex justify-end gap-3">
            <button type="button" onClick={onClose} className={secondaryBtnClass}>
              {t("close")}
            </button>
            {done.phone && (
              <a
                href={whatsappUrl(done.phone, message, settings.whatsappDialCode)}
                target="_blank"
                rel="noopener noreferrer"
                onClick={onClose}
                className={`${primaryBtnClass} ${tapTargetClass}`}
              >
                <MessageCircle className="h-4 w-4" />
                {t("dnRsTellWhatsApp")}
              </a>
            )}
          </div>
        </div>
      </Modal>
    );
  }

  return (
    <Modal
      open
      onClose={onClose}
      title={fill(t("dnRsCancelFor"), {
        name: reservation.guestName || t("dnRsBookingFallback"),
      })}
    >
      <div className="space-y-4">
        <Field label={t("dgReason")} hint={t("dnRsCancelReasonHint")}>
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            autoFocus
            className={inputClass}
          />
        </Field>

        {reservation.depositPaid > 0 && (
          <Field
            label={fill(t("dnRsTheirAdvanceOf"), {
              amount: formatPaise(reservation.depositPaid, currency),
            })}
          >
            <div className="flex flex-wrap gap-2">
              {(
                [
                  ["refunded", t("dnRsRefundIt")],
                  ["forfeited", t("dnRsKeepIt")],
                ] as ["refunded" | "forfeited", string][]
              ).map(([value, label]) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => setOutcome(value)}
                  aria-pressed={outcome === value}
                  className={`${tapTargetClass} rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                    outcome === value
                      ? "border-indigo bg-indigo text-white"
                      : "border-muted-line/40 bg-white text-ink hover:border-indigo/50"
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          </Field>
        )}

        <div className="flex justify-end gap-3">
          <button type="button" onClick={onClose} className={secondaryBtnClass}>
            {t("dnRsKeepBooking")}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={async () => {
              setBusy(true);
              try {
                const next = await cancelReservation(reservation.id, reason.trim(), outcome);
                setDone(next);
              } finally {
                setBusy(false);
              }
            }}
            className={`${dangerBtnClass} ${tapTargetClass}`}
          >
            {busy ? t("dnRsCancelling") : t("dnRsCancelBooking")}
          </button>
        </div>
      </div>
    </Modal>
  );
}
