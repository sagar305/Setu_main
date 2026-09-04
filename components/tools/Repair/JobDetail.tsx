"use client";

// One job, everything about it — §3.3.
//
// The intake record sits at the top and is read-only, permanently. Not disabled
// inputs: rendered as a record, because the moment it looks like a form somebody
// will try to correct it, and the whole value of the thing is that it cannot be
// corrected. §4 is explicit — corrections are appended in notes, not edited in
// place. The screen says so where the record is.
//
// Everything below it is the working half: diagnosis, parts, labour, notes and
// the timeline.

import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  BadgeCheck,
  Copy,
  ExternalLink,
  FileText,
  Link2,
  MessageCircle,
  PackageCheck,
  Phone,
  Plus,
  Printer,
  Save,
  ShieldQuestion,
  Tag,
  Trash2,
  X,
} from "lucide-react";
import { useRepair } from "@/lib/repair/store";
import {
  agingLevel,
  billDue,
  billTotals,
  daysInShop,
  isWarrantyClaim,
  jobMargin,
  partsCostTotal,
  partsSellingTotal,
  warrantyEndOf,
  warrantyStateOf,
} from "@/lib/repair/calc";
import {
  BOARD_STATUSES,
  JOB_STATUS_LABELS,
  STATUS_TEMPLATE,
  dateKeyOf,
  deviceLabel,
  formatDate,
  formatDateTime,
  generateId,
  whatsAppNumber,
  type Job,
  type JobStatus,
  type PartUsage,
} from "@/lib/repair/types";
import { outboundFor, type OutboundMessage } from "@/lib/repair/messages";
import { TrackingError, daysUntilExpiry } from "@/lib/repair/tracking";
import {
  printDeviceTag,
  printEstimate,
  printInvoice,
  printJobSlip,
  type PrintContext,
} from "@/lib/repair/print";
import { formatMoney } from "@/lib/pos/types";
import { SendQueue } from "./SendQueue";
import { PhotoLightbox } from "./PhotoLightbox";
import { DeliveryModal } from "./DeliveryModal";
import {
  AgingBadge,
  ConfirmDialog,
  Field,
  Pill,
  PriorityFlag,
  SectionCard,
  StatusChip,
  inputClass,
  primaryBtnClass,
  secondaryBtnClass,
} from "./ui";

export function JobDetail({ jobId, onBack }: { jobId: string; onBack: () => void }) {
  const {
    jobs,
    parts,
    technicians,
    settings,
    business,
    today,
    jobById,
    customerById,
    billForJob,
    updateJobWork,
    setJobStatus,
    markNotified,
    raiseWarrantyClaim,
    deleteJob,
    publishJobTracking,
    openEstimateForApproval,
    checkEstimateDecision,
  } = useRepair();

  const job = jobById(jobId);
  const [photoIndex, setPhotoIndex] = useState(-1);
  const [queue, setQueue] = useState<{ title: string; messages: OutboundMessage[] } | null>(null);
  const [pendingChangeId, setPendingChangeId] = useState<string | null>(null);
  const [delivering, setDelivering] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [error, setError] = useState("");
  const [saved, setSaved] = useState(false);
  const [trackingBusy, setTrackingBusy] = useState(false);
  const [trackingNote, setTrackingNote] = useState("");
  const [copiedLink, setCopiedLink] = useState(false);

  // The working fields, edited locally and saved in one go — a technician types
  // a diagnosis in bursts and should not be writing to the database per keypress.
  const [diagnosis, setDiagnosis] = useState(job?.diagnosis ?? "");
  const [workDone, setWorkDone] = useState(job?.workDone ?? "");
  const [labour, setLabour] = useState(String(job?.labourCharge ?? 0));
  const [customerNotes, setCustomerNotes] = useState(job?.customerNotes ?? "");
  const [internalNotes, setInternalNotes] = useState(job?.internalNotes ?? "");
  const [estimate, setEstimate] = useState(
    job?.estimateAmount === null || job?.estimateAmount === undefined ? "" : String(job.estimateAmount)
  );
  const [technicianId, setTechnicianId] = useState(job?.technicianId ?? "");
  const [promisedDate, setPromisedDate] = useState(job?.promisedDate ?? "");
  const [partsUsed, setPartsUsed] = useState<PartUsage[]>(job?.partsUsed ?? []);

  const customer = job ? (customerById(job.customerId) ?? null) : null;
  const technician = job?.technicianId ? (technicians.find((t) => t.id === job.technicianId) ?? null) : null;
  const bill = job ? (billForJob(job.id) ?? null) : null;
  const currency = business?.currency ?? "INR";
  const claimOf = job?.warrantyClaimOfJobId
    ? jobs.find((row) => row.id === job.warrantyClaimOfJobId)
    : null;
  const claims = useMemo(
    () => (job ? jobs.filter((row) => row.warrantyClaimOfJobId === job.id) : []),
    [jobs, job]
  );

  /**
   * Watch for the customer answering the estimate.
   *
   * There is no push and there cannot be one without a server of our own, so
   * this polls while the job is open and an answer is genuinely outstanding —
   * and stops the moment one arrives or the job moves on. Every thirty seconds
   * is frequent enough that an approval lands while the counter is still
   * looking at the job, and rare enough to be a negligible amount of traffic.
   */
  useEffect(() => {
    const outstanding =
      job?.status === "estimate-sent" &&
      Boolean(job.tracking?.reply) &&
      !job.tracking?.reply?.decision;
    if (!job || !outstanding) return;

    let cancelled = false;
    const poll = () => {
      // Failures are swallowed inside checkEstimateDecision — waiting longer is
      // always the right answer, and an error here must not disturb the screen.
      if (!cancelled) void checkEstimateDecision(job.id);
    };
    poll();
    const timer = window.setInterval(poll, 30_000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [job, checkEstimateDecision]);

  if (!job) {
    return (
      <div className="py-16 text-center">
        <p className="text-sm text-muted">That job is no longer here.</p>
        <button type="button" onClick={onBack} className={`${primaryBtnClass} mt-4`}>
          Back to the board
        </button>
      </div>
    );
  }

  const money = (value: number) => formatMoney(value, currency);
  const totals = billTotals({ ...job, partsUsed, labourCharge: Number(labour) || 0 }, settings);
  const tracking = job.tracking;
  const awaitingReply =
    job.status === "estimate-sent" && Boolean(tracking?.reply) && !tracking?.reply?.decision;
  const expiryDays = tracking ? daysUntilExpiry(tracking) : null;
  const context: PrintContext = { business, job, customer, technician, settings, bill };

  const dirty =
    diagnosis !== job.diagnosis ||
    workDone !== job.workDone ||
    (Number(labour) || 0) !== job.labourCharge ||
    customerNotes !== job.customerNotes ||
    internalNotes !== job.internalNotes ||
    technicianId !== (job.technicianId ?? "") ||
    promisedDate !== (job.promisedDate ?? "") ||
    estimate !== (job.estimateAmount === null ? "" : String(job.estimateAmount)) ||
    JSON.stringify(partsUsed) !== JSON.stringify(job.partsUsed);

  const save = async () => {
    setError("");
    try {
      await updateJobWork(job.id, {
        diagnosis,
        workDone,
        labourCharge: Number(labour) || 0,
        customerNotes,
        internalNotes,
        technicianId: technicianId || null,
        promisedDate: promisedDate || null,
        estimateAmount: estimate.trim() === "" ? null : Number(estimate) || 0,
        partsUsed,
      });
      setSaved(true);
      window.setTimeout(() => setSaved(false), 1800);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not save.");
    }
  };

  /**
   * Move to a status and offer the matching message.
   *
   * §3.1: each move appends a StatusChange and offers the template. The offer is
   * an offer — a shop that has just spoken to the customer on the phone should
   * not have to send them a text saying the same thing, so closing the queue
   * leaves `notifiedAt` unset and the timeline honest about it.
   */
  const moveTo = async (next: JobStatus) => {
    setError("");
    try {
      const updated = await setJobStatus(job.id, next);
      const templateKey = STATUS_TEMPLATE[next];
      if (!templateKey || !customer) return;
      const change = updated.statusHistory[updated.statusHistory.length - 1];
      setPendingChangeId(change?.id ?? null);
      setQueue({
        title: `Tell ${customer.name}`,
        messages: [
          outboundFor(templateKey, updated, customer, business, settings, bill?.invoiceNo ?? ""),
        ],
      });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Could not change the status.");
    }
  };

  const addPartFromStock = (partId: string) => {
    const part = parts.find((row) => row.id === partId);
    if (!part) return;
    setPartsUsed((previous) => [
      ...previous,
      {
        id: generateId(),
        partId: part.id,
        name: part.name,
        quantity: 1,
        costPrice: part.costPrice,
        sellingPrice: part.sellingPrice,
        supplierWarrantyDays: 0,
      },
    ]);
  };

  const addAdHocPart = () => {
    setPartsUsed((previous) => [
      ...previous,
      {
        id: generateId(),
        partId: null,
        name: "",
        quantity: 1,
        costPrice: 0,
        sellingPrice: 0,
        supplierWarrantyDays: 0,
      },
    ]);
  };

  const patchPart = (id: string, updates: Partial<PartUsage>) =>
    setPartsUsed((previous) =>
      previous.map((part) => (part.id === id ? { ...part, ...updates } : part))
    );

  const warrantyState = warrantyStateOf(job, today);
  const warrantyEnd = warrantyEndOf(job);
  const level = agingLevel(job, settings, today);

  return (
    <div className="grid gap-4">
      <button
        type="button"
        onClick={onBack}
        className="inline-flex w-fit items-center gap-1 text-sm font-semibold text-muted hover:text-indigo"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Back to the board
      </button>

      {/* Header ---------------------------------------------------------- */}
      <div className="rounded-2xl border border-muted-line/30 bg-white p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-xl font-bold text-ink">{job.jobNo}</h2>
              <StatusChip status={job.status} />
              <PriorityFlag priority={job.priority} />
              {isWarrantyClaim(job) && <Pill tone="indigo">Warranty claim</Pill>}
            </div>
            <p className="mt-1 text-sm font-semibold text-ink">{deviceLabel(job)}</p>
            <p className="text-xs text-muted">
              {job.serialNo ? `IMEI / Sl. ${job.serialNo}` : "No serial recorded"}
              {job.colour ? ` · ${job.colour}` : ""}
            </p>
          </div>
          <div className="flex flex-col items-end gap-2">
            <AgingBadge days={daysInShop(job, today)} level={level} />
            <p className="text-xs text-muted">
              In {formatDate(dateKeyOf(job.createdAt))}
              {job.promisedDate ? ` · promised ${formatDate(job.promisedDate)}` : ""}
            </p>
          </div>
        </div>

        {customer && (
          <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-muted-line/20 pt-3">
            <span className="text-sm font-semibold text-ink">{customer.name}</span>
            <span className="text-sm text-muted">{customer.phone}</span>
            {customer.phone && (
              <>
                <a
                  href={`tel:${customer.phone}`}
                  className="inline-flex items-center gap-1 rounded-lg border border-muted-line/40 px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-indigo/40 hover:text-indigo"
                >
                  <Phone className="h-3.5 w-3.5" aria-hidden="true" />
                  Call
                </a>
                <a
                  href={`https://wa.me/${whatsAppNumber(customer.phone)}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1 rounded-lg border border-muted-line/40 px-2.5 py-1 text-xs font-semibold text-muted transition hover:border-indigo/40 hover:text-indigo"
                >
                  <MessageCircle className="h-3.5 w-3.5" aria-hidden="true" />
                  WhatsApp
                </a>
              </>
            )}
          </div>
        )}

        {claimOf && (
          <p className="mt-3 rounded-lg border border-indigo/40 bg-indigo/5 p-3 text-sm text-ink">
            Warranty claim against <strong>{claimOf.jobNo}</strong>, delivered{" "}
            {claimOf.deliveredOn ? formatDate(claimOf.deliveredOn) : "—"}.
          </p>
        )}
        {claims.length > 0 && (
          <p className="mt-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            Came back under warranty as {claims.map((claim) => claim.jobNo).join(", ")}.
          </p>
        )}
      </div>

      {/* Actions --------------------------------------------------------- */}
      <div className="flex flex-wrap gap-2">
        <label className="inline-flex items-center gap-2 rounded-lg border border-muted-line/40 bg-white px-3 py-2 text-sm">
          <span className="font-semibold text-muted">Status</span>
          <select
            className="bg-transparent text-sm font-semibold text-ink focus:outline-none"
            value={job.status}
            onChange={(event) => void moveTo(event.target.value as JobStatus)}
          >
            {BOARD_STATUSES.filter((status) => status !== "delivered").map((status) => (
              <option key={status} value={status}>
                {JOB_STATUS_LABELS[status]}
              </option>
            ))}
            {job.status === "delivered" && <option value="delivered">Delivered</option>}
            <option value="returned-unrepaired">Returned unrepaired</option>
            <option value="cancelled">Cancelled</option>
          </select>
        </label>

        <button type="button" onClick={() => printJobSlip(context)} className={secondaryBtnClass}>
          <Printer className="h-4 w-4" aria-hidden="true" />
          Job slip
        </button>
        <button type="button" onClick={() => printDeviceTag(context)} className={secondaryBtnClass}>
          <Tag className="h-4 w-4" aria-hidden="true" />
          Device tag
        </button>
        <button type="button" onClick={() => printEstimate(context)} className={secondaryBtnClass}>
          <FileText className="h-4 w-4" aria-hidden="true" />
          Estimate
        </button>
        {bill && (
          <button
            type="button"
            onClick={() => printInvoice(context)}
            className={secondaryBtnClass}
          >
            <Printer className="h-4 w-4" aria-hidden="true" />
            Invoice
          </button>
        )}
        {job.status === "ready" && (
          <button type="button" onClick={() => setDelivering(true)} className={primaryBtnClass}>
            <PackageCheck className="h-4 w-4" aria-hidden="true" />
            Deliver
          </button>
        )}
        {job.status === "delivered" && warrantyState === "covered" && (
          <button
            type="button"
            onClick={async () => {
              try {
                await raiseWarrantyClaim(job.id);
                onBack();
              } catch (caught) {
                setError(caught instanceof Error ? caught.message : "Could not raise the claim.");
              }
            }}
            className={secondaryBtnClass}
          >
            <ShieldQuestion className="h-4 w-4" aria-hidden="true" />
            Raise warranty claim
          </button>
        )}
        {!job.billId && (
          <button
            type="button"
            onClick={() => setConfirmDelete(true)}
            className={`${secondaryBtnClass} text-red-600`}
          >
            <Trash2 className="h-4 w-4" aria-hidden="true" />
            Delete
          </button>
        )}
      </div>

      {job.status === "delivered" && (
        <div className="rounded-2xl border border-muted-line/30 bg-white p-4">
          <div className="flex flex-wrap items-center gap-2">
            <BadgeCheck className="h-4 w-4 text-green-700" aria-hidden="true" />
            <span className="text-sm font-semibold text-ink">
              Delivered {job.deliveredOn ? formatDate(job.deliveredOn) : ""}
            </span>
            {warrantyState === "covered" && (
              <Pill tone="good">Under warranty until {formatDate(warrantyEnd)}</Pill>
            )}
            {warrantyState === "expired" && (
              <Pill tone="muted">Warranty ended {formatDate(warrantyEnd)}</Pill>
            )}
            {warrantyState === "none" && <Pill tone="muted">No warranty given</Pill>}
          </div>
          {bill && (
            <p className="mt-2 text-sm text-muted">
              Invoice {bill.invoiceNo} · {money(bill.total)} · paid {money(bill.paid)}
              {billDue(bill) > 0 && (
                <strong className="text-red-600"> · {money(billDue(bill))} outstanding</strong>
              )}
            </p>
          )}
        </div>
      )}

      {/* Tracking link ---------------------------------------------------- */}
      {settings.trackingEnabled && (
        <SectionCard title="Customer tracking link">
          {tracking ? (
            <div className="grid gap-3">
              <div className="flex flex-wrap items-center gap-2">
                <Link2 className="h-4 w-4 shrink-0 text-indigo" aria-hidden="true" />
                <code className="min-w-0 flex-1 truncate rounded-lg bg-cream-paper px-2 py-1.5 text-xs text-ink">
                  {tracking.url}
                </code>
                <button
                  type="button"
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(tracking.url);
                      setCopiedLink(true);
                      window.setTimeout(() => setCopiedLink(false), 1600);
                    } catch {
                      // Clipboard blocked — the URL is on screen to copy by hand.
                    }
                  }}
                  className={secondaryBtnClass}
                >
                  <Copy className="h-4 w-4" aria-hidden="true" />
                  {copiedLink ? "Copied" : "Copy"}
                </button>
                <a
                  href={tracking.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className={secondaryBtnClass}
                >
                  <ExternalLink className="h-4 w-4" aria-hidden="true" />
                  Open
                </a>
              </div>

              <p className="text-xs text-muted">
                The same address for the life of this job — every status change rewrites what it
                says, so the customer can bookmark it.
                {expiryDays !== null && expiryDays <= 14 && (
                  <strong className="text-amber-700">
                    {" "}
                    It stops working in {expiryDays} {expiryDays === 1 ? "day" : "days"}.
                  </strong>
                )}
              </p>

              {tracking.pendingSince && (
                <p className="flex items-center gap-2 rounded-lg border border-amber-300 bg-amber-50 p-3 text-xs text-amber-900">
                  <AlertTriangle className="h-4 w-4 shrink-0" aria-hidden="true" />
                  The last update did not reach the link — the customer is seeing older
                  information. It will retry when you are back online.
                </p>
              )}

              {/* The estimate reply channel. */}
              {job.status === "estimate-sent" && (
                <div className="rounded-lg border border-muted-line/30 bg-cream-paper p-3">
                  {tracking.reply?.decision ? (
                    <p
                      className={`text-sm font-semibold ${
                        tracking.reply.decision === "yes" ? "text-green-700" : "text-red-700"
                      }`}
                    >
                      The customer {tracking.reply.decision === "yes" ? "approved" : "declined"}{" "}
                      this estimate
                      {tracking.reply.decidedAt
                        ? ` on ${formatDateTime(tracking.reply.decidedAt)}`
                        : ""}
                      .
                    </p>
                  ) : awaitingReply ? (
                    <p className="text-sm text-muted">
                      Waiting for the customer to approve or decline on their tracking page. This
                      checks every half minute while the job is open.
                    </p>
                  ) : (
                    <>
                      <p className="text-sm text-muted">
                        Turn on Approve and Decline on the customer&apos;s page, so they can answer
                        the estimate without ringing.
                      </p>
                      <button
                        type="button"
                        disabled={trackingBusy}
                        onClick={async () => {
                          setTrackingBusy(true);
                          setTrackingNote("");
                          setError("");
                          try {
                            await openEstimateForApproval(job.id);
                            setTrackingNote("The customer can now answer on their page.");
                          } catch (caught) {
                            setError(
                              caught instanceof TrackingError || caught instanceof Error
                                ? caught.message
                                : "Could not open the estimate for approval."
                            );
                          } finally {
                            setTrackingBusy(false);
                          }
                        }}
                        className={`${primaryBtnClass} mt-2`}
                      >
                        {trackingBusy ? "Working…" : "Let them answer on the link"}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>
          ) : (
            <div className="grid gap-2">
              <p className="text-sm text-muted">
                {job.trackingQueuedAt
                  ? "This job is waiting for a link — it could not be created, most likely because you were offline. It will be picked up automatically, or you can try now."
                  : "This job has no tracking link yet."}
              </p>
              <button
                type="button"
                disabled={trackingBusy}
                onClick={async () => {
                  setTrackingBusy(true);
                  setTrackingNote("");
                  setError("");
                  try {
                    await publishJobTracking(job.id);
                    setTrackingNote("Link created.");
                  } catch (caught) {
                    setError(
                      caught instanceof TrackingError || caught instanceof Error
                        ? caught.message
                        : "Could not create the tracking link."
                    );
                  } finally {
                    setTrackingBusy(false);
                  }
                }}
                className={`${primaryBtnClass} w-fit`}
              >
                <Link2 className="h-4 w-4" aria-hidden="true" />
                {trackingBusy ? "Creating…" : "Create the tracking link"}
              </button>
            </div>
          )}

          {trackingNote && (
            <p className="mt-2 text-xs font-semibold text-green-700">{trackingNote}</p>
          )}
        </SectionCard>
      )}

      {/* Intake record --------------------------------------------------- */}
      <SectionCard
        title="Intake record"
        action={
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-muted">
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden="true" />
            Locked
          </span>
        }
      >
        <p className="mb-3 text-xs text-muted">
          Recorded when the device came in and never edited since — that is what makes it worth
          something in an argument. Anything found later goes in the notes below.
        </p>

        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Reported problem
            </p>
            <p className="mt-1 text-sm text-ink">
              {job.reportedProblems.length > 0 ? job.reportedProblems.join(", ") : "—"}
            </p>
            {job.problemNote && <p className="mt-1 text-sm text-muted">{job.problemNote}</p>}

            <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
              Accessories received
            </p>
            <p className="mt-1 text-sm text-ink">
              {job.accessories.length > 0 ? job.accessories.join(", ") : "None"}
            </p>

            {job.unlockCode && (
              <>
                <p className="mt-4 text-xs font-semibold uppercase tracking-wide text-muted">
                  Unlock code
                </p>
                <p className="mt-1 font-mono text-sm text-ink">{job.unlockCode}</p>
              </>
            )}
          </div>

          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Condition when received
            </p>
            {job.conditionIn.length === 0 ? (
              <p className="mt-1 text-sm text-muted">No checklist was recorded.</p>
            ) : (
              <ul className="mt-1 grid gap-1">
                {job.conditionIn.map((item) => (
                  <li key={item.id} className="text-sm">
                    <span className={item.present ? "font-semibold text-amber-800" : "text-muted"}>
                      {item.present ? "✗" : "○"} {item.label}
                    </span>
                    {item.note && <span className="text-muted"> — {item.note}</span>}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </div>

        {job.intakePhotos.length > 0 && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Photos at intake
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {job.intakePhotos.map((photo, index) => (
                <button
                  key={photo.slice(-24)}
                  type="button"
                  onClick={() => setPhotoIndex(index)}
                  className="rounded-lg border border-muted-line/30 transition hover:border-indigo/50"
                >
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={photo}
                    alt={`Intake photo ${index + 1}`}
                    className="h-24 w-24 rounded-lg object-cover"
                  />
                </button>
              ))}
            </div>
          </div>
        )}

        {job.intakeSignatureDataUrl && (
          <div className="mt-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted">
              Customer&apos;s signature
            </p>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={job.intakeSignatureDataUrl}
              alt="Signature taken at intake"
              className="mt-1 max-h-16 rounded border border-muted-line/30 bg-white p-1"
            />
          </div>
        )}
      </SectionCard>

      {/* Work ------------------------------------------------------------ */}
      <SectionCard
        title="Diagnosis and work done"
        action={
          <div className="flex items-center gap-2">
            {saved && <span className="text-xs font-semibold text-green-700">Saved</span>}
            <button
              type="button"
              onClick={() => void save()}
              className={primaryBtnClass}
              disabled={!dirty}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Save
            </button>
          </div>
        }
      >
        <div className="grid gap-3">
          <Field label="Diagnosis" hint="What is actually wrong with it.">
            <textarea
              className={inputClass}
              rows={2}
              value={diagnosis}
              onChange={(event) => setDiagnosis(event.target.value)}
            />
          </Field>
          <Field label="Work done" hint="Prints on the invoice.">
            <textarea
              className={inputClass}
              rows={2}
              value={workDone}
              onChange={(event) => setWorkDone(event.target.value)}
            />
          </Field>
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label="Technician">
              <select
                className={inputClass}
                value={technicianId}
                onChange={(event) => setTechnicianId(event.target.value)}
              >
                <option value="">Not assigned</option>
                {technicians.map((tech) => (
                  <option key={tech.id} value={tech.id}>
                    {tech.name}
                  </option>
                ))}
              </select>
            </Field>
            <Field label="Estimate">
              <input
                className={inputClass}
                value={estimate}
                onChange={(event) => setEstimate(event.target.value)}
                inputMode="decimal"
              />
            </Field>
            <Field label="Promised by">
              <input
                type="date"
                className={inputClass}
                value={promisedDate}
                onChange={(event) => setPromisedDate(event.target.value)}
              />
            </Field>
          </div>
          {job.estimateApprovedOn && (
            <p className="text-xs font-semibold text-green-700">
              Estimate approved {formatDate(job.estimateApprovedOn)}.
            </p>
          )}
        </div>
      </SectionCard>

      {/* Parts ----------------------------------------------------------- */}
      <SectionCard
        title="Parts and labour"
        action={
          <div className="flex flex-wrap items-center gap-2">
            <select
              className="rounded-lg border border-muted-line/40 bg-white px-2 py-1.5 text-sm font-semibold text-ink"
              value=""
              onChange={(event) => {
                if (event.target.value) addPartFromStock(event.target.value);
                event.target.value = "";
              }}
            >
              <option value="">Add from stock…</option>
              {parts
                .filter((part) => part.active)
                .map((part) => (
                  <option key={part.id} value={part.id}>
                    {part.name} ({part.stock} left)
                  </option>
                ))}
            </select>
            <button type="button" onClick={addAdHocPart} className={secondaryBtnClass}>
              <Plus className="h-4 w-4" aria-hidden="true" />
              Other part
            </button>
          </div>
        }
      >
        {partsUsed.length === 0 ? (
          <p className="text-sm text-muted">No parts used yet.</p>
        ) : (
          <div className="grid gap-2">
            {partsUsed.map((part) => (
              <div
                key={part.id}
                className="grid gap-2 rounded-xl border border-muted-line/30 p-3 sm:grid-cols-[1fr_auto_auto_auto_auto]"
              >
                <input
                  className={inputClass}
                  value={part.name}
                  onChange={(event) => patchPart(part.id, { name: event.target.value })}
                  placeholder="Part name"
                />
                <label className="text-xs text-muted">
                  Qty
                  <input
                    className={`${inputClass} w-20`}
                    value={part.quantity}
                    onChange={(event) =>
                      patchPart(part.id, { quantity: Number(event.target.value) || 0 })
                    }
                    inputMode="numeric"
                  />
                </label>
                <label className="text-xs text-muted">
                  Cost
                  <input
                    className={`${inputClass} w-24`}
                    value={part.costPrice}
                    onChange={(event) =>
                      patchPart(part.id, { costPrice: Number(event.target.value) || 0 })
                    }
                    inputMode="decimal"
                  />
                </label>
                <label className="text-xs text-muted">
                  Selling
                  <input
                    className={`${inputClass} w-24`}
                    value={part.sellingPrice}
                    onChange={(event) =>
                      patchPart(part.id, { sellingPrice: Number(event.target.value) || 0 })
                    }
                    inputMode="decimal"
                  />
                </label>
                <button
                  type="button"
                  onClick={() =>
                    setPartsUsed((previous) => previous.filter((row) => row.id !== part.id))
                  }
                  className="self-center rounded-lg p-2 text-muted transition hover:text-red-600"
                  aria-label={`Remove ${part.name || "part"}`}
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            ))}
          </div>
        )}

        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <Field label="Labour charge" hint="Pure margin — no part cost against it.">
            <input
              className={inputClass}
              value={labour}
              onChange={(event) => setLabour(event.target.value)}
              inputMode="decimal"
            />
          </Field>
        </div>

        {/* The margin, while the technician can still do something about it. */}
        <div className="mt-3 flex flex-wrap gap-4 rounded-xl bg-cream-paper p-3 text-sm">
          <span className="text-muted">
            Parts sell <strong className="text-ink">{money(partsSellingTotal(partsUsed))}</strong>
          </span>
          <span className="text-muted">
            Parts cost <strong className="text-ink">{money(partsCostTotal(partsUsed))}</strong>
          </span>
          <span className="text-muted">
            Total <strong className="text-ink">{money(totals.total)}</strong>
          </span>
          <span className="text-muted">
            Margin{" "}
            <strong className="text-ink">
              {money(
                jobMargin({ ...job, partsUsed, labourCharge: Number(labour) || 0 }, bill, settings)
              )}
            </strong>
          </span>
        </div>
      </SectionCard>

      {/* Notes ----------------------------------------------------------- */}
      <SectionCard title="Notes">
        <div className="grid gap-3 sm:grid-cols-2">
          <Field label="Customer-visible" hint="Prints on the slip and the invoice.">
            <textarea
              className={inputClass}
              rows={3}
              value={customerNotes}
              onChange={(event) => setCustomerNotes(event.target.value)}
            />
          </Field>
          <Field label="Internal" hint="Never printed, never sent.">
            <textarea
              className={inputClass}
              rows={3}
              value={internalNotes}
              onChange={(event) => setInternalNotes(event.target.value)}
            />
          </Field>
        </div>
      </SectionCard>

      {/* Timeline -------------------------------------------------------- */}
      <SectionCard title="Timeline">
        <ol className="grid gap-3">
          {job.statusHistory
            .slice()
            .reverse()
            .map((change) => (
              <li key={change.id} className="flex items-start gap-3">
                <span
                  className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-indigo"
                  aria-hidden="true"
                />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-ink">
                    {change.from === change.to
                      ? change.note || "Reminder sent"
                      : `${change.from ? `${JOB_STATUS_LABELS[change.from]} → ` : ""}${
                          JOB_STATUS_LABELS[change.to]
                        }`}
                  </p>
                  <p className="text-xs text-muted">
                    {formatDateTime(change.at)}
                    {change.notifiedAt ? " · customer told" : " · not notified"}
                  </p>
                  {change.note && change.from !== change.to && (
                    <p className="text-xs text-muted">{change.note}</p>
                  )}
                </div>
              </li>
            ))}
        </ol>
      </SectionCard>

      {error && (
        <p className="text-sm font-semibold text-red-600" role="alert">
          {error}
        </p>
      )}

      <PhotoLightbox
        photos={job.intakePhotos}
        index={photoIndex}
        onClose={() => setPhotoIndex(-1)}
        onIndexChange={setPhotoIndex}
      />

      <SendQueue
        open={queue !== null}
        title={queue?.title ?? ""}
        messages={queue?.messages ?? []}
        onClose={() => {
          setQueue(null);
          setPendingChangeId(null);
        }}
        onSent={(ids) => {
          if (ids.length > 0 && pendingChangeId) void markNotified(job.id, pendingChangeId);
        }}
      />

      <DeliveryModal
        job={job}
        open={delivering}
        onClose={() => setDelivering(false)}
        onDelivered={(delivered) => {
          setDelivering(false);
          const deliveredBill = billForJob(delivered.id) ?? null;
          printInvoice({ business, job: delivered, customer, technician, settings, bill: deliveredBill });
          if (customer) {
            setPendingChangeId(
              delivered.statusHistory[delivered.statusHistory.length - 1]?.id ?? null
            );
            setQueue({
              title: `Tell ${customer.name}`,
              messages: [
                outboundFor(
                  "delivered",
                  delivered,
                  customer,
                  business,
                  settings,
                  deliveredBill?.invoiceNo ?? ""
                ),
              ],
            });
          }
        }}
      />

      <ConfirmDialog
        open={confirmDelete}
        title={`Delete ${job.jobNo}?`}
        message="The intake record, its photos and its signature go with it. There is no undo. Cancel the job instead if you want to keep the record."
        confirmLabel="Delete the job"
        onCancel={() => setConfirmDelete(false)}
        onConfirm={async () => {
          setConfirmDelete(false);
          try {
            await deleteJob(job.id);
            onBack();
          } catch (caught) {
            setError(caught instanceof Error ? caught.message : "Could not delete this job.");
          }
        }}
      />
    </div>
  );
}
