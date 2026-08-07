"use client";

import { useRef } from "react";
import { Printer, RotateCcw } from "lucide-react";
import { useDine } from "@/lib/dine/store";
import { ORDER_TYPE_LABELS, type DineKot } from "@/lib/dine/types";
import { Modal, primaryBtnClass, secondaryBtnClass, tapTargetClass } from "./ui";
import { PREVIEW_CLASS, printNode, printedAt } from "./printing";

/**
 * The Kitchen Order Ticket.
 *
 * Two rules make this document useful rather than decorative: it carries only
 * the round that was just fired, never the whole table (FR-5.3), and it carries
 * no prices (FR-5.1). A cook needs to know what to make and what is unusual
 * about it; anything else on the slip is noise at the pass.
 */
export function KotModal({
  kot,
  open,
  onClose,
}: {
  kot: DineKot | null;
  open: boolean;
  onClose: () => void;
}) {
  const { business, settings, tickets, tables, areas, ticketItems, reprintKot } = useDine();
  const printRef = useRef<HTMLDivElement>(null);

  if (!kot) return null;

  const ticket = tickets.find((row) => row.id === kot.ticketId) ?? null;
  const table = ticket?.tableId ? tables.find((row) => row.id === ticket.tableId) : null;
  const area = table ? areas.find((row) => row.id === table.areaId) : null;

  const roundItems = ticketItems
    .filter((item) => item.ticketId === kot.ticketId && item.roundNumber === kot.roundNumber)
    .filter((item) => (kot.isCancellation ? item.cancelledAt !== null : true))
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));

  const doPrint = (reprint: boolean) => {
    printNode(printRef.current, settings.kotPaperSize, kot.kotLabel);
    if (reprint) void reprintKot(kot.id);
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={kot.isCancellation ? "Cancellation slip" : `Kitchen ticket · ${kot.kotLabel}`}
    >
      <div className="rounded-xl border border-muted-line/40 bg-white p-4">
        <div ref={printRef} className={PREVIEW_CLASS}>
          <div className="c">
            {kot.isCancellation && (
              <p className="xl b" style={{ margin: "0 0 4px" }}>
                ** CANCELLED **
              </p>
            )}
            <p className="lg b" style={{ margin: 0 }}>
              {business?.name ?? "Restaurant"}
            </p>
            <p className="b xl" style={{ margin: "4px 0 0" }}>
              {kot.kotLabel}
            </p>
          </div>

          <div className="rule" />

          <div className="row">
            <span className="b">{table ? table.name : ORDER_TYPE_LABELS[ticket?.orderType ?? "takeaway"]}</span>
            <span>Round {kot.roundNumber}</span>
          </div>
          <div className="row sm muted">
            <span>
              {area ? `${area.name} · ` : ""}
              {ORDER_TYPE_LABELS[ticket?.orderType ?? "takeaway"]}
            </span>
            <span>{printedAt(kot.printedAt)}</span>
          </div>
          {ticket?.customerName && <p className="sm muted" style={{ margin: 0 }}>{ticket.customerName}</p>}
          {kot.reprintCount > 0 && (
            <p className="sm b" style={{ margin: "2px 0 0" }}>
              REPRINT #{kot.reprintCount}
            </p>
          )}

          <div className="solid" />

          <table>
            <tbody>
              {roundItems.map((item) => (
                <tr key={item.id}>
                  <td className="b lg" style={{ width: "10mm" }}>
                    {item.quantity}
                  </td>
                  <td className="wrap">
                    <span className="b lg">
                      {item.name}
                      {item.variationName ? ` (${item.variationName})` : ""}
                    </span>
                    {item.modifiers.length > 0 && (
                      <div className="sm">+ {item.modifiers.map((m) => m.name).join(", ")}</div>
                    )}
                    {item.note && <div className="sm b">** {item.note} **</div>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>

          <div className="solid" />
          <p className="c sm muted" style={{ margin: 0 }}>
            {roundItems.reduce((sum, item) => sum + item.quantity, 0)} item(s)
            {ticket?.note ? ` · ${ticket.note}` : ""}
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-wrap justify-end gap-3">
        <button type="button" onClick={onClose} className={`${secondaryBtnClass} ${tapTargetClass}`}>
          Done
        </button>
        {kot.reprintCount > 0 || kot.printedAt ? (
          <button
            type="button"
            onClick={() => doPrint(true)}
            className={`${secondaryBtnClass} ${tapTargetClass}`}
          >
            <RotateCcw className="h-4 w-4" />
            Reprint
          </button>
        ) : null}
        <button
          type="button"
          onClick={() => doPrint(false)}
          className={`${primaryBtnClass} ${tapTargetClass}`}
        >
          <Printer className="h-4 w-4" />
          Print
        </button>
      </div>

      <p className="mt-3 text-center text-xs text-muted">
        No printer? The kitchen can read this off the screen — that is what most small kitchens do.
      </p>
    </Modal>
  );
}
