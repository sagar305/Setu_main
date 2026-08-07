"use client";

import { useEffect, useMemo, useState } from "react";
import {
  ArrowLeft,
  ChefHat,
  Merge,
  Minus,
  Plus,
  Receipt,
  Search,
  Trash2,
  TriangleAlert,
  UserPlus,
  X,
} from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { formatPaise, parseAmount } from "@/lib/dine/money";
import {
  ORDER_TYPE_LABELS,
  lineUnitPrice,
  type DineKot,
  type DineMenuItem,
  type DineTicketItem,
} from "@/lib/dine/types";
import { ItemChooserModal } from "./ItemChooserModal";
import { KotModal } from "./KotModal";
import { BillFlow } from "./BillFlow";
import {
  ConfirmDialog,
  Field,
  FoodDot,
  Modal,
  OrderTypeChip,
  elapsedLabel,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
  dangerBtnClass,
  tapTargetClass,
} from "./ui";

export function TicketScreen({
  ticketId,
  onBack,
}: {
  ticketId: string;
  onBack: () => void;
}) {
  const {
    tickets,
    tables,
    areas,
    menuItems,
    categories,
    variations,
    modifierGroups,
    business,
    settings,
    itemsOfTicket,
    ticketTotals,
    addTicketItems,
    updateTicketItemQuantity,
    removeTicketItem,
    cancelTicketItem,
    fireRound,
    setTicketDiscount,
    setTicketServiceCharge,
    setTicketCustomer,
    openTickets,
    mergeTickets,
    cancelTicket,
  } = useDine();

  const currency = business?.currency ?? "INR";
  const ticket = tickets.find((row) => row.id === ticketId) ?? null;
  const items = itemsOfTicket(ticketId);
  const totals = ticketTotals(ticketId);

  const [query, setQuery] = useState("");
  const [categoryId, setCategoryId] = useState("all");
  const [chooserItem, setChooserItem] = useState<DineMenuItem | null>(null);
  const [sheetOpen, setSheetOpen] = useState(false);
  const [kot, setKot] = useState<DineKot | null>(null);
  const [billing, setBilling] = useState(false);
  const [discountOpen, setDiscountOpen] = useState(false);
  const [customerOpen, setCustomerOpen] = useState(false);
  const [mergeOpen, setMergeOpen] = useState(false);
  const [cancelItemTarget, setCancelItemTarget] = useState<DineTicketItem | null>(null);
  const [cancelReason, setCancelReason] = useState("");
  const [confirmVoid, setConfirmVoid] = useState(false);

  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), 60000);
    return () => window.clearInterval(timer);
  }, []);

  const table = ticket?.tableId ? tables.find((row) => row.id === ticket.tableId) : null;
  const area = table ? areas.find((row) => row.id === table.areaId) : null;

  const orderedCategories = useMemo(
    () => categories.slice().sort((a, b) => a.sortOrder - b.sortOrder),
    [categories]
  );

  const visibleItems = useMemo(() => {
    const search = query.trim().toLowerCase();
    return menuItems
      .filter((item) => item.available)
      .filter((item) => categoryId === "all" || item.categoryId === categoryId)
      .filter((item) => !search || item.name.toLowerCase().includes(search))
      .sort((a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name));
  }, [categoryId, menuItems, query]);

  const unfired = items.filter((item) => item.firedAt === null && item.cancelledAt === null);
  const rounds = useMemo(() => {
    const map = new Map<number, DineTicketItem[]>();
    for (const item of items) {
      map.set(item.roundNumber, [...(map.get(item.roundNumber) ?? []), item]);
    }
    return Array.from(map.entries()).sort((a, b) => a[0] - b[0]);
  }, [items]);

  if (!ticket) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted">This ticket is no longer open.</p>
        <button type="button" onClick={onBack} className={`${secondaryBtnClass} mt-4`}>
          Back to floor
        </button>
      </div>
    );
  }

  const needsChooser = (item: DineMenuItem) =>
    variations.some((variation) => variation.menuItemId === item.id) ||
    modifierGroups.some((group) => group.menuItemId === item.id);

  const tapItem = (item: DineMenuItem) => {
    if (needsChooser(item)) {
      setChooserItem(item);
      return;
    }
    void addTicketItems(ticketId, [
      { menuItemId: item.id, variationId: null, quantity: 1, modifiers: [], note: "" },
    ]);
  };

  const onFire = async () => {
    const printed = await fireRound(ticketId);
    if (printed) setKot(printed);
  };

  const confirmCancelItem = async () => {
    if (!cancelItemTarget) return;
    const printed = await cancelTicketItem(cancelItemTarget.id, cancelReason.trim());
    setCancelItemTarget(null);
    setCancelReason("");
    if (printed) setKot(printed);
  };

  const mergeCandidates = openTickets.filter(
    (row) => row.id !== ticketId && row.status === "open"
  );

  const title = table ? `${table.name}${area ? ` · ${area.name}` : ""}` : `#${ticket.ticketNumber}`;

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={onBack}
            aria-label="Back to floor"
            className={`${tapTargetClass} flex items-center justify-center rounded-full border border-muted-line/40 bg-white text-muted transition hover:border-indigo/40 hover:text-indigo`}
          >
            <ArrowLeft className="h-4 w-4" />
          </button>
          <div>
            <h2 className="text-lg font-bold text-ink">{title}</h2>
            <p className="flex items-center gap-2 text-xs text-muted">
              <OrderTypeChip type={ticket.orderType} />
              <span>Open {elapsedLabel(ticket.openedAt, now)}</span>
              {ticket.roundsFired > 0 && (
                <span>
                  · {ticket.roundsFired} round{ticket.roundsFired === 1 ? "" : "s"} sent
                </span>
              )}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => setCustomerOpen(true)}
            className={`${secondaryBtnClass} ${tapTargetClass}`}
          >
            <UserPlus className="h-4 w-4" />
            {ticket.customerName || "Customer"}
          </button>
          {mergeCandidates.length > 0 && (
            <button
              type="button"
              onClick={() => setMergeOpen(true)}
              className={`${secondaryBtnClass} ${tapTargetClass}`}
            >
              <Merge className="h-4 w-4" />
              Merge
            </button>
          )}
        </div>
      </div>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_360px]">
        {/* Menu */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted/60" />
            <input
              type="search"
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Search the menu…"
              aria-label="Search the menu"
              className={`${inputClass} pl-9`}
            />
          </div>

          <div className="-mx-1 flex gap-1 overflow-x-auto pb-1" aria-label="Menu categories">
            <button
              type="button"
              onClick={() => setCategoryId("all")}
              aria-pressed={categoryId === "all"}
              className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                categoryId === "all"
                  ? "bg-indigo text-white"
                  : "text-muted hover:bg-white hover:text-indigo"
              }`}
            >
              All
            </button>
            {orderedCategories.map((category) => (
              <button
                key={category.id}
                type="button"
                onClick={() => setCategoryId(category.id)}
                aria-pressed={categoryId === category.id}
                className={`shrink-0 rounded-full px-3 py-1.5 text-sm font-semibold transition ${
                  categoryId === category.id
                    ? "bg-indigo text-white"
                    : "text-muted hover:bg-white hover:text-indigo"
                }`}
              >
                {category.name}
              </button>
            ))}
          </div>

          {visibleItems.length === 0 ? (
            <p className="rounded-2xl border border-dashed border-muted-line/40 bg-white/60 px-4 py-10 text-center text-sm text-muted">
              Nothing on the menu matches.
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-2 pb-28 sm:grid-cols-3 lg:pb-0">
              {visibleItems.map((item) => (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => tapItem(item)}
                  className={`${tapTargetClass} flex flex-col items-start gap-1 rounded-xl border border-muted-line/30 bg-white p-3 text-left shadow-sm transition hover:border-indigo/50`}
                >
                  <FoodDot type={item.foodType} />
                  <span className="line-clamp-2 text-sm font-semibold leading-snug text-ink">
                    {item.name}
                  </span>
                  <span className="text-sm font-bold text-indigo">
                    {formatPaise(item.price, currency)}
                  </span>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ticket — a sticky panel on desktop, a bottom sheet on a phone. */}
        <div className="hidden lg:block">
          <TicketPanel
            ticketId={ticketId}
            rounds={rounds}
            currency={currency}
            totals={totals}
            unfiredCount={unfired.length}
            serviceChargeOn={ticket.serviceChargeOn}
            serviceChargeRate={settings.serviceChargeRate}
            discountLabel={
              ticket.discountValue > 0
                ? ticket.discountType === "percent"
                  ? `${ticket.discountValue}%`
                  : formatPaise(ticket.discountValue, currency)
                : ""
            }
            onFire={onFire}
            onBill={() => setBilling(true)}
            onDiscount={() => setDiscountOpen(true)}
            onToggleServiceCharge={() => void setTicketServiceCharge(ticketId, !ticket.serviceChargeOn)}
            onQuantity={(itemId, quantity) => void updateTicketItemQuantity(itemId, quantity)}
            onRemove={(itemId) => void removeTicketItem(itemId)}
            onCancelFired={(item) => setCancelItemTarget(item)}
            onVoid={() => setConfirmVoid(true)}
          />
        </div>
      </div>

      {/* Phone: a fixed summary bar that opens the full ticket. The bar never
          shifts the menu grid, so a mis-tap during a rush cannot happen because
          the layout moved under a thumb (NFR-5). */}
      <div className="fixed inset-x-0 bottom-0 z-40 border-t border-muted-line/30 bg-white p-3 shadow-[0_-4px_16px_rgba(14,17,36,0.08)] lg:hidden">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setSheetOpen(true)}
            className="flex flex-1 items-center justify-between rounded-xl bg-cream-paper px-3 py-2 text-left"
          >
            <span className="text-xs font-semibold uppercase tracking-wide text-muted">
              {totals.itemCount} item{totals.itemCount === 1 ? "" : "s"}
              {unfired.length > 0 && (
                <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] text-red-700">
                  {unfired.length} not sent
                </span>
              )}
            </span>
            <span className="text-base font-bold text-ink">
              {formatPaise(totals.total, currency)}
            </span>
          </button>
          {unfired.length > 0 ? (
            <button
              type="button"
              onClick={() => void onFire()}
              className={`${primaryBtnClass} ${tapTargetClass}`}
            >
              <ChefHat className="h-4 w-4" />
              Send
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setBilling(true)}
              disabled={totals.itemCount === 0}
              className={`${primaryBtnClass} ${tapTargetClass}`}
            >
              <Receipt className="h-4 w-4" />
              Bill
            </button>
          )}
        </div>
      </div>

      <Modal open={sheetOpen} onClose={() => setSheetOpen(false)} title={`Ticket · ${title}`}>
        <TicketPanel
          ticketId={ticketId}
          rounds={rounds}
          currency={currency}
          totals={totals}
          unfiredCount={unfired.length}
          serviceChargeOn={ticket.serviceChargeOn}
          serviceChargeRate={settings.serviceChargeRate}
          discountLabel={
            ticket.discountValue > 0
              ? ticket.discountType === "percent"
                ? `${ticket.discountValue}%`
                : formatPaise(ticket.discountValue, currency)
              : ""
          }
          bare
          onFire={async () => {
            setSheetOpen(false);
            await onFire();
          }}
          onBill={() => {
            setSheetOpen(false);
            setBilling(true);
          }}
          onDiscount={() => setDiscountOpen(true)}
          onToggleServiceCharge={() => void setTicketServiceCharge(ticketId, !ticket.serviceChargeOn)}
          onQuantity={(itemId, quantity) => void updateTicketItemQuantity(itemId, quantity)}
          onRemove={(itemId) => void removeTicketItem(itemId)}
          onCancelFired={(item) => {
            setSheetOpen(false);
            setCancelItemTarget(item);
          }}
          onVoid={() => {
            setSheetOpen(false);
            setConfirmVoid(true);
          }}
        />
      </Modal>

      <ItemChooserModal
        item={chooserItem}
        open={chooserItem !== null}
        onClose={() => setChooserItem(null)}
        onAdd={(input) => void addTicketItems(ticketId, [input])}
      />

      <KotModal kot={kot} open={kot !== null} onClose={() => setKot(null)} />

      {billing && (
        <BillFlow ticketId={ticketId} onClose={() => setBilling(false)} onSettled={onBack} />
      )}

      <DiscountModal
        open={discountOpen}
        onClose={() => setDiscountOpen(false)}
        currency={currency}
        initialType={ticket.discountType}
        initialValue={ticket.discountValue}
        initialReason={ticket.discountReason}
        onSave={(type, value, reason) => void setTicketDiscount(ticketId, type, value, reason)}
      />

      <CustomerModal
        open={customerOpen}
        onClose={() => setCustomerOpen(false)}
        initialName={ticket.customerName}
        initialAddress={ticket.deliveryAddress}
        showAddress={ticket.orderType === "delivery"}
        onSave={(name, address) => void setTicketCustomer(ticketId, ticket.customerId, name, address)}
      />

      <Modal open={mergeOpen} onClose={() => setMergeOpen(false)} title="Merge another table in">
        <p className="text-sm text-muted">
          The other ticket&apos;s items move here and its table is freed. Both tables&apos; sent
          rounds are kept.
        </p>
        <div className="mt-4 space-y-2">
          {mergeCandidates.map((candidate) => {
            const candidateTable = candidate.tableId
              ? tables.find((row) => row.id === candidate.tableId)
              : null;
            return (
              <button
                key={candidate.id}
                type="button"
                onClick={async () => {
                  await mergeTickets(candidate.id, ticketId);
                  setMergeOpen(false);
                }}
                className="flex w-full items-center justify-between rounded-xl border border-muted-line/40 bg-white px-4 py-3 text-left text-sm font-semibold text-ink transition hover:border-indigo/50"
              >
                <span>{candidateTable?.name ?? `#${candidate.ticketNumber}`}</span>
                <span className="text-xs font-normal text-muted">
                  {ORDER_TYPE_LABELS[candidate.orderType]}
                </span>
              </button>
            );
          })}
        </div>
      </Modal>

      <Modal
        open={cancelItemTarget !== null}
        onClose={() => setCancelItemTarget(null)}
        title="Cancel this item"
      >
        <p className="flex gap-2 rounded-xl border border-saffron/40 bg-saffron/10 p-3 text-xs leading-relaxed text-ink">
          <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>
            This has already gone to the kitchen. Cancelling prints a cancellation slip and stays on
            the ticket — that record is how you spot waste and mistakes later.
          </span>
        </p>
        <div className="mt-4">
          <Field label="Reason" hint="Optional, but useful at the end of the month.">
            <input
              value={cancelReason}
              onChange={(event) => setCancelReason(event.target.value)}
              placeholder="ordered by mistake, guest changed their mind…"
              className={inputClass}
            />
          </Field>
        </div>
        <div className="mt-5 flex justify-end gap-3">
          <button
            type="button"
            onClick={() => setCancelItemTarget(null)}
            className={secondaryBtnClass}
          >
            Keep it
          </button>
          <button type="button" onClick={() => void confirmCancelItem()} className={dangerBtnClass}>
            Cancel item
          </button>
        </div>
      </Modal>

      <ConfirmDialog
        open={confirmVoid}
        title="Void this ticket?"
        message="The whole table is voided and freed. The ticket stays in your records as cancelled — nothing is deleted."
        confirmLabel="Void ticket"
        onCancel={() => setConfirmVoid(false)}
        onConfirm={async () => {
          await cancelTicket(ticketId, "Voided from the floor");
          setConfirmVoid(false);
          onBack();
        }}
      />
    </div>
  );
}

function TicketPanel({
  rounds,
  currency,
  totals,
  unfiredCount,
  serviceChargeOn,
  serviceChargeRate,
  discountLabel,
  bare,
  onFire,
  onBill,
  onDiscount,
  onToggleServiceCharge,
  onQuantity,
  onRemove,
  onCancelFired,
  onVoid,
}: {
  ticketId: string;
  rounds: [number, DineTicketItem[]][];
  currency: string;
  totals: ReturnType<ReturnType<typeof useDine>["ticketTotals"]>;
  unfiredCount: number;
  serviceChargeOn: boolean;
  serviceChargeRate: number;
  discountLabel: string;
  bare?: boolean;
  onFire: () => void | Promise<void>;
  onBill: () => void;
  onDiscount: () => void;
  onToggleServiceCharge: () => void;
  onQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onCancelFired: (item: DineTicketItem) => void;
  onVoid: () => void;
}) {
  const wrapper = bare
    ? ""
    : "sticky top-4 rounded-2xl border border-muted-line/30 bg-white p-4 shadow-sm";

  return (
    <div className={wrapper}>
      {rounds.length === 0 ? (
        <p className="py-8 text-center text-sm text-muted">
          Tap a dish to start this table&apos;s order.
        </p>
      ) : (
        <div className="max-h-[46vh] space-y-4 overflow-y-auto pr-1">
          {rounds.map(([roundNumber, roundItems]) => {
            const fired = roundItems.some((item) => item.firedAt !== null);
            return (
              <div key={roundNumber}>
                <p className="mb-1.5 flex items-center gap-2 text-[11px] font-bold uppercase tracking-wide text-muted">
                  Round {roundNumber}
                  <span
                    className={`rounded-full px-2 py-0.5 ${
                      fired ? "bg-green-100 text-green-800" : "bg-red-100 text-red-700"
                    }`}
                  >
                    {fired ? "sent" : "not sent"}
                  </span>
                </p>
                <ul className="space-y-2">
                  {roundItems.map((item) => (
                    <TicketLine
                      key={item.id}
                      item={item}
                      currency={currency}
                      onQuantity={onQuantity}
                      onRemove={onRemove}
                      onCancelFired={onCancelFired}
                    />
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      )}

      <div className="mt-4 space-y-1.5 border-t border-muted-line/20 pt-4 text-sm">
        <Row label="Subtotal" value={formatPaise(totals.subtotal, currency)} />
        {totals.discountAmount > 0 && (
          <Row
            label={`Discount${discountLabel ? ` (${discountLabel})` : ""}`}
            value={`− ${formatPaise(totals.discountAmount, currency)}`}
          />
        )}
        {totals.serviceCharge > 0 && (
          <Row
            label={`Service charge (${serviceChargeRate}%)`}
            value={formatPaise(totals.serviceCharge, currency)}
          />
        )}
        {totals.addedTax > 0 && (
          <Row label="Tax" value={formatPaise(totals.addedTax, currency)} />
        )}
        <div className="flex items-baseline justify-between border-t border-muted-line/20 pt-2">
          <span className="text-sm font-bold text-ink">Total</span>
          <span className="text-xl font-bold text-ink">
            {formatPaise(totals.total, currency)}
          </span>
        </div>
        {totals.includedTax > 0 && (
          <p className="text-[11px] text-muted">
            Includes {formatPaise(totals.includedTax, currency)} tax
          </p>
        )}
      </div>

      <div className="mt-4 flex flex-wrap gap-2">
        <button type="button" onClick={onDiscount} className="text-xs font-semibold text-indigo">
          {discountLabel ? `Discount ${discountLabel}` : "Add discount"}
        </button>
        <span className="text-muted/40">·</span>
        <button
          type="button"
          onClick={onToggleServiceCharge}
          className="text-xs font-semibold text-indigo"
        >
          {serviceChargeOn ? "Remove service charge" : `Add ${serviceChargeRate}% service charge`}
        </button>
        <span className="text-muted/40">·</span>
        <button type="button" onClick={onVoid} className="text-xs font-semibold text-red-600">
          Void ticket
        </button>
      </div>

      <div className="mt-4 hidden gap-2 lg:flex">
        <button
          type="button"
          onClick={() => void onFire()}
          disabled={unfiredCount === 0}
          className={`${primaryBtnClass} ${tapTargetClass} flex-1`}
        >
          <ChefHat className="h-4 w-4" />
          Send {unfiredCount > 0 ? `${unfiredCount} to kitchen` : "to kitchen"}
        </button>
        <button
          type="button"
          onClick={onBill}
          disabled={totals.itemCount === 0}
          className={`${secondaryBtnClass} ${tapTargetClass}`}
        >
          <Receipt className="h-4 w-4" />
          Bill
        </button>
      </div>
    </div>
  );
}

function TicketLine({
  item,
  currency,
  onQuantity,
  onRemove,
  onCancelFired,
}: {
  item: DineTicketItem;
  currency: string;
  onQuantity: (itemId: string, quantity: number) => void;
  onRemove: (itemId: string) => void;
  onCancelFired: (item: DineTicketItem) => void;
}) {
  const cancelled = item.cancelledAt !== null;
  const fired = item.firedAt !== null;

  return (
    <li
      className={`rounded-xl border p-2 ${
        cancelled ? "border-muted-line/30 bg-cream/50 opacity-60" : "border-muted-line/30 bg-white"
      }`}
    >
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <p
            className={`text-sm font-semibold text-ink ${cancelled ? "line-through" : ""}`}
          >
            {item.name}
            {item.variationName && (
              <span className="font-normal text-muted"> ({item.variationName})</span>
            )}
          </p>
          {item.modifiers.length > 0 && (
            <p className="text-[11px] text-muted">
              {item.modifiers.map((modifier) => modifier.name).join(", ")}
            </p>
          )}
          {item.note && <p className="text-[11px] italic text-saffron">“{item.note}”</p>}
          {cancelled && (
            <p className="text-[11px] font-semibold text-red-600">
              Cancelled{item.cancelReason ? ` — ${item.cancelReason}` : ""}
            </p>
          )}
        </div>
        <span className="shrink-0 text-sm font-bold text-ink">
          {formatPaise(lineUnitPrice(item) * item.quantity, currency)}
        </span>
      </div>

      {!cancelled && (
        <div className="mt-1.5 flex items-center justify-between gap-2">
          {fired ? (
            <span className="text-[11px] font-semibold text-muted">Qty {item.quantity}</span>
          ) : (
            <div className="flex items-center gap-1">
              <button
                type="button"
                onClick={() => onQuantity(item.id, item.quantity - 1)}
                disabled={item.quantity <= 1}
                aria-label={`Reduce ${item.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-ink disabled:opacity-40"
              >
                <Minus className="h-3.5 w-3.5" />
              </button>
              <span className="w-7 text-center text-sm font-bold text-ink">{item.quantity}</span>
              <button
                type="button"
                onClick={() => onQuantity(item.id, item.quantity + 1)}
                aria-label={`Add another ${item.name}`}
                className="flex h-8 w-8 items-center justify-center rounded-lg border border-muted-line/40 bg-white text-ink"
              >
                <Plus className="h-3.5 w-3.5" />
              </button>
            </div>
          )}

          <button
            type="button"
            onClick={() => (fired ? onCancelFired(item) : onRemove(item.id))}
            aria-label={fired ? `Cancel ${item.name}` : `Remove ${item.name}`}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-muted transition hover:bg-red-50 hover:text-red-600"
          >
            {fired ? <X className="h-4 w-4" /> : <Trash2 className="h-4 w-4" />}
          </button>
        </div>
      )}
    </li>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between">
      <span className="text-muted">{label}</span>
      <span className="font-semibold text-ink">{value}</span>
    </div>
  );
}

function DiscountModal({
  open,
  onClose,
  currency,
  initialType,
  initialValue,
  initialReason,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  currency: string;
  initialType: "flat" | "percent";
  initialValue: number;
  initialReason: string;
  onSave: (type: "flat" | "percent", value: number, reason: string) => void;
}) {
  const [type, setType] = useState(initialType);
  const [value, setValue] = useState("");
  const [reason, setReason] = useState(initialReason);

  useEffect(() => {
    if (!open) return;
    setType(initialType);
    setReason(initialReason);
    setValue(
      initialValue > 0
        ? initialType === "percent"
          ? String(initialValue)
          : (initialValue / 100).toFixed(2)
        : ""
    );
  }, [initialReason, initialType, initialValue, open]);

  return (
    <Modal open={open} onClose={onClose} title="Discount">
      <div className="space-y-4">
        <div className="flex gap-2">
          {(["percent", "flat"] as const).map((option) => (
            <button
              key={option}
              type="button"
              onClick={() => setType(option)}
              aria-pressed={type === option}
              className={`${tapTargetClass} flex-1 rounded-xl border px-4 py-2 text-sm font-semibold transition ${
                type === option
                  ? "border-indigo bg-indigo text-white"
                  : "border-muted-line/40 bg-white text-ink"
              }`}
            >
              {option === "percent" ? "Percentage" : `Amount (${currency})`}
            </button>
          ))}
        </div>

        <Field label={type === "percent" ? "Discount %" : "Discount amount"}>
          <input
            inputMode="decimal"
            value={value}
            onChange={(event) => setValue(event.target.value)}
            placeholder={type === "percent" ? "10" : "50.00"}
            className={inputClass}
          />
        </Field>

        <Field label="Reason" hint="Shows on the bill and in your reports.">
          <input
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder="regular guest, service delay…"
            className={inputClass}
          />
        </Field>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => {
              onSave("percent", 0, "");
              onClose();
            }}
            className={secondaryBtnClass}
          >
            Clear
          </button>
          <button
            type="button"
            onClick={() => {
              const parsed = type === "percent" ? Number(value) || 0 : parseAmount(value);
              onSave(type, parsed, reason.trim());
              onClose();
            }}
            className={primaryBtnClass}
          >
            Apply
          </button>
        </div>
      </div>
    </Modal>
  );
}

function CustomerModal({
  open,
  onClose,
  initialName,
  initialAddress,
  showAddress,
  onSave,
}: {
  open: boolean;
  onClose: () => void;
  initialName: string;
  initialAddress: string;
  showAddress: boolean;
  onSave: (name: string, address: string) => void;
}) {
  const [name, setName] = useState(initialName);
  const [address, setAddress] = useState(initialAddress);

  useEffect(() => {
    if (!open) return;
    setName(initialName);
    setAddress(initialAddress);
  }, [initialAddress, initialName, open]);

  return (
    <Modal open={open} onClose={onClose} title="Customer">
      <div className="space-y-4">
        <Field label="Name">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
            className={inputClass}
            autoFocus
          />
        </Field>
        {showAddress && (
          <Field label="Delivery address">
            <textarea
              value={address}
              onChange={(event) => setAddress(event.target.value)}
              rows={3}
              className={inputClass}
            />
          </Field>
        )}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => {
              onSave(name.trim(), address.trim());
              onClose();
            }}
            className={primaryBtnClass}
          >
            Save
          </button>
        </div>
      </div>
    </Modal>
  );
}
