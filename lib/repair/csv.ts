// CSV exports for the job card.
//
// The Reports screen answers the questions we anticipated; this is for the ones
// we did not. One row per job, one per part used and one per bill, from which
// every summary on that screen can be rebuilt in a spreadsheet.
//
// Photos and signatures are never exported. A CSV of data URLs is a file no
// spreadsheet can open, and the evidence belongs in the app and on the printed
// slip rather than in a column somebody will paste into an email.

export { toCsv, downloadCsv } from "@/lib/pos/csv";

import { toCsv } from "@/lib/pos/csv";
import {
  DEVICE_KIND_LABELS,
  JOB_STATUS_LABELS,
  dateKeyOf,
  deviceLabel,
  type Bill,
  type Customer,
  type Job,
  type Part,
  type RepairSettings,
  type Technician,
} from "./types";
import {
  billTotals,
  daysInShop,
  jobMargin,
  partsCostTotal,
  partsSellingTotal,
  turnaroundDays,
  warrantyEndOf,
} from "./calc";
import { billsByJob } from "./reports";

export function jobsCsv(
  jobs: Job[],
  customers: Customer[],
  technicians: Technician[],
  bills: Bill[],
  settings: RepairSettings
): string {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const techById = new Map(technicians.map((tech) => [tech.id, tech.name]));
  const billFor = billsByJob(bills);

  const header = [
    "Job no",
    "Status",
    "Received on",
    "Days in shop",
    "Customer",
    "Phone",
    "Device kind",
    "Brand",
    "Model",
    "Serial / IMEI",
    "Colour",
    "Reported problems",
    "Damage noted at intake",
    "Accessories",
    "Technician",
    "Priority",
    "Promised date",
    "Estimate",
    "Estimate approved on",
    "Diagnosis",
    "Work done",
    "Parts selling total",
    "Parts cost total",
    "Labour",
    "Bill total",
    "Margin",
    "Delivered on",
    "Turnaround days",
    "Warranty days",
    "Warranty until",
    "Warranty claim of",
    "Invoice no",
  ];

  const jobNoById = new Map(jobs.map((job) => [job.id, job.jobNo]));

  const body = jobs.map((job) => {
    const bill = billFor.get(job.id) ?? null;
    const totals = billTotals(job, settings);
    const customer = customerById.get(job.customerId);
    return [
      job.jobNo,
      JOB_STATUS_LABELS[job.status],
      dateKeyOf(job.createdAt),
      daysInShop(job),
      customer?.name ?? "",
      customer?.phone ?? "",
      DEVICE_KIND_LABELS[job.deviceKind],
      job.brand,
      job.model,
      job.serialNo,
      job.colour,
      job.reportedProblems.join("; "),
      job.conditionIn
        .filter((item) => item.present)
        .map((item) => (item.note ? `${item.label} (${item.note})` : item.label))
        .join("; "),
      job.accessories.join("; "),
      job.technicianId ? (techById.get(job.technicianId) ?? "") : "",
      job.priority,
      job.promisedDate ?? "",
      job.estimateAmount ?? "",
      job.estimateApprovedOn ?? "",
      job.diagnosis,
      job.workDone,
      partsSellingTotal(job.partsUsed),
      partsCostTotal(job.partsUsed),
      job.labourCharge,
      bill ? bill.total : totals.total,
      jobMargin(job, bill, settings),
      job.deliveredOn ?? "",
      turnaroundDays(job) ?? "",
      job.warrantyDays,
      warrantyEndOf(job),
      job.warrantyClaimOfJobId ? (jobNoById.get(job.warrantyClaimOfJobId) ?? "") : "",
      bill?.invoiceNo ?? "",
    ];
  });

  return toCsv(header, body);
}

/** One row per part fitted — what actually gets consumed, and at what margin. */
export function partsUsedCsv(jobs: Job[]): string {
  const header = [
    "Job no",
    "Received on",
    "Part",
    "Quantity",
    "Cost price",
    "Selling price",
    "Cost total",
    "Selling total",
    "Margin",
    "Supplier warranty days",
    "From stock",
  ];
  const body = jobs.flatMap((job) =>
    job.partsUsed.map((part) => [
      job.jobNo,
      dateKeyOf(job.createdAt),
      part.name,
      part.quantity,
      part.costPrice,
      part.sellingPrice,
      part.costPrice * part.quantity,
      part.sellingPrice * part.quantity,
      (part.sellingPrice - part.costPrice) * part.quantity,
      part.supplierWarrantyDays,
      part.partId ? "Yes" : "No",
    ])
  );
  return toCsv(header, body);
}

export function partsStockCsv(parts: Part[]): string {
  const header = [
    "Part",
    "SKU",
    "Compatible with",
    "Cost price",
    "Selling price",
    "Stock",
    "Low stock at",
    "Stock value at cost",
    "Supplier",
    "Active",
  ];
  const body = parts.map((part) => [
    part.name,
    part.sku,
    part.compatibleWith,
    part.costPrice,
    part.sellingPrice,
    part.stock,
    part.lowStockAt,
    part.costPrice * part.stock,
    part.supplierName,
    part.active ? "Yes" : "No",
  ]);
  return toCsv(header, body);
}

export function billsCsv(bills: Bill[], jobs: Job[], customers: Customer[]): string {
  const jobNoById = new Map(jobs.map((job) => [job.id, job.jobNo]));
  const nameById = new Map(customers.map((customer) => [customer.id, customer.name]));
  const header = [
    "Invoice no",
    "Date",
    "Job no",
    "Customer",
    "Parts",
    "Labour",
    "Discount",
    "Tax rate",
    "Tax",
    "Total",
    "Paid",
    "Balance",
    "Payment mode",
  ];
  const body = bills.map((bill) => [
    bill.invoiceNo,
    bill.date,
    jobNoById.get(bill.jobId) ?? "",
    nameById.get(bill.customerId) ?? "",
    bill.partLines.reduce((sum, line) => sum + line.amount, 0),
    bill.labourCharge,
    bill.discount,
    bill.taxRate,
    bill.taxAmount,
    bill.total,
    bill.paid,
    Math.max(0, bill.total - bill.paid),
    bill.paymentMode,
  ]);
  return toCsv(header, body);
}

export function customersCsv(customers: Customer[], jobs: Job[]): string {
  const header = [
    "Name",
    "Phone",
    "Alt phone",
    "Company",
    "GSTIN",
    "Address",
    "Jobs",
    "Last job",
  ];
  const body = customers.map((customer) => {
    const theirs = jobs.filter((job) => job.customerId === customer.id);
    const last = theirs
      .map((job) => dateKeyOf(job.createdAt))
      .sort()
      .pop();
    return [
      customer.name,
      customer.phone,
      customer.altPhone,
      customer.companyName,
      customer.gstin,
      customer.address,
      theirs.length,
      last ?? "",
    ];
  });
  return toCsv(header, body);
}

/** The uncollected list, as a chase sheet somebody can work down. */
export function uncollectedCsv(
  rows: { job: Job; readySince: string; days: number; value: number }[],
  customers: Customer[]
): string {
  const customerById = new Map(customers.map((customer) => [customer.id, customer]));
  const header = ["Job no", "Device", "Customer", "Phone", "Ready since", "Days", "Value"];
  const body = rows.map((row) => {
    const customer = customerById.get(row.job.customerId);
    return [
      row.job.jobNo,
      deviceLabel(row.job),
      customer?.name ?? "",
      customer?.phone ?? "",
      row.readySince,
      row.days,
      row.value,
    ];
  });
  return toCsv(header, body);
}
