// Generates the ruled-table PDF fixture.
//
// Run: node tests/fixtures/generic/make-ruled-statement-pdf.mjs
//
// This reproduces, with entirely invented names and amounts, the layout of a
// real Indian bank statement that broke the parser. Every awkward property is
// deliberate, because each one was a separate bug:
//
//   • a drawn table grid (double rules, as banks print them)
//   • an 8-column layout including Branch Code, which is numeric but not money
//   • a header stacked over three baselines: "Value"/"Date", "Branch"/"Code",
//     "Credit"/"(₹)"
//   • currency decoration in the header — "Debit (₹)" must still map to debit
//   • "Ref No./Cheque No." — the reverse of the usual "Chq/Ref No"
//   • each transaction spanning three baselines, because the date column wraps
//     "01 Dec" above "2025"
//   • the header repeated on every page
//   • OPENING BALANCE and CLOSING BALANCE rows that carry a balance but no
//     debit or credit
//   • landscape orientation
//
// PDF.js additionally fuses adjacent cells into one text run at these column
// distances, which is what makes the fused-run splitting testable.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { jsPDF } from "jspdf";

const here = dirname(fileURLToPath(import.meta.url));

// Landscape A4: 842 x 595 points. jsPDF measures y DOWNWARD from the top,
// while PDF user space (what PDF.js reports) runs upward — the generator works
// in jsPDF's frame and the parser sees the flipped result.
const EDGES = [73, 127, 182, 397, 540, 602, 654, 708, 769];
const ROW_HEIGHT = 31.7;
const PAGE_HEIGHT = 595;
const BOTTOM_MARGIN = 40;
const FIRST_PAGE_TABLE_TOP = 130;
const LATER_PAGE_TABLE_TOP = 60;

const HEADER = [
  ["Txn Date"],
  ["Value", "Date"],
  ["Description"],
  ["Ref No./Cheque No."],
  ["Branch", "Code"],
  ["Debit (₹)"],
  ["Credit", "(₹)"],
  ["Balance", "(₹)"],
];

const OPENING = 125480;

/** Invented transactions — no relation to any real account. */
const TXNS = [
  ["01 Dec 2025", "UPI/5123/Quickmart/Order#8831", "UPI5123122512018831", "2216", 1248, 0],
  ["01 Dec 2025", "POS/ONLINE RETAIL IN/Order 171-88", "POS1718831201ONL", "4430", 2499, 0],
  ["01 Dec 2025", "UPI/9087/Wallet Recharge/Prepaid", "UPI908712251201PP01", "2216", 399, 0],
  ["02 Dec 2025", "NEFT CR/EXAMPLE CORP SAL NOV25", "NEFTEXMP120225SAL01", "99922", 0, 85000],
  ["02 Dec 2025", "ACH DR/LIFE INSURANCE PREM", "ACHLIFEINS12022501", "99922", 2450, 0],
  ["02 Dec 2025", "UPI/1290/Grocery Store/Purchase", "UPI129012251202GRC", "2216", 1876, 0],
  ["02 Dec 2025", "IMPS/P2A/BANK0001234/Rent Dec", "IMPSRENT120225RENT", "4430", 28000, 0],
  ["03 Dec 2025", "UPI/5566/Rail Ticket/PNR 6672", "UPI556612251203IRC", "2216", 1540, 0],
  ["03 Dec 2025", "ATM WDL/DEMO ATM/NORTH", "ATMDEMO120325NRTH", "4430", 5000, 0],
  ["03 Dec 2025", "UPI/2311/Quick Delivery/ORD8891", "UPI231112251203QD", "2216", 786, 0],
  ["04 Dec 2025", "POS/COFFEE HOUSE/CENTRAL", "POS120425COF00041", "4430", 540, 0],
  ["04 Dec 2025", "UPI/8899/Gas Bill/Nov", "UPI889912251204GAS", "2216", 1210, 0],
  ["04 Dec 2025", "UPI/7781/Electricity Bill", "UPI778112251204ELE", "2216", 2430, 0],
  ["05 Dec 2025", "NEFT DR/CREDIT CARD PAYMENT", "NEFTCARD120525CC01", "99922", 10000, 0],
  ["05 Dec 2025", "UPI/9033/Fresh Basket/Order", "UPI903312251205FB", "2216", 1065, 0],
  ["05 Dec 2025", "IMPS/P2P/Colleague/Trip share", "IMPSCOLL120525TRIP", "4430", 2500, 0],
  ["06 Dec 2025", "UPI/5512/Streaming Co/Monthly", "UPI551212251206STR", "2216", 649, 0],
  ["06 Dec 2025", "UPI/3322/Music App/AutoPay", "UPI332212251206MUS", "2216", 119, 0],
  ["06 Dec 2025", "UPI/8122/Home Services/Booking", "UPI812212251206HS", "2216", 899, 0],
  ["07 Dec 2025", "NEFT CR/CLIENT PAYMENT INV-4471", "NEFTCLNT120725INV", "99922", 0, 42000],
  ["07 Dec 2025", "UPI/4410/Pharmacy/Order 5521", "UPI441012251207PHR", "2216", 1320, 0],
  ["08 Dec 2025", "UPI/9102/Cloud Storage/Annual", "UPI910212251208CLD", "2216", 130, 0],
  ["08 Dec 2025", "CHG/ACCOUNT MAINTENANCE FEE", "CHGAMC120825", "0000", 199, 0],
  ["09 Dec 2025", "IMPS/P2A/HOUSING LOAN EMI", "IMPSEMI120925HL", "99922", 22500, 0],
  ["09 Dec 2025", "UPI/7782/Payments App/Transfer", "UPI778212251209PAY", "2216", 5000, 0],
  ["10 Dec 2025", "NEFT CR/EXAMPLE CORP BONUS", "NEFTEXMP121025BON", "99922", 0, 10000],
];

const money = (value) =>
  value.toLocaleString("en-IN", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const doc = new jsPDF({ unit: "pt", format: "a4", orientation: "landscape" });

/** Double column rules spanning the table's vertical extent on this page. */
function drawColumnRules(top, bottom) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  for (const x of EDGES) {
    doc.line(x, top, x, bottom);
    doc.line(x + 2, top, x + 2, bottom);
  }
}

/** A double row rule, as banks draw them. */
function drawRowRule(y) {
  doc.setDrawColor(0);
  doc.setLineWidth(0.6);
  doc.line(EDGES[0], y, EDGES[EDGES.length - 1], y);
  doc.line(EDGES[0], y + 2, EDGES[EDGES.length - 1], y + 2);
}

/** Header cells, stacked over separate baselines within the band. */
function drawHeader(top) {
  doc.setFont("times", "bold");
  doc.setFontSize(9);
  HEADER.forEach((lines, column) => {
    const centre = (EDGES[column] + EDGES[column + 1]) / 2;
    lines.forEach((line, index) => {
      doc.text(line, centre, top + 13 + index * 9, { align: "center" });
    });
  });
}

/** One transaction across three baselines, because the date column wraps. */
function drawRow(top, [date, description, reference, branch, debit, credit], balance) {
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  const [day, month, year] = date.split(" ");

  doc.text(`${day} ${month}`, EDGES[0] + 4, top + 11);
  doc.text(year, EDGES[0] + 4, top + 25);
  doc.text(`${day} ${month}`, EDGES[1] + 4, top + 11);
  doc.text(year, EDGES[1] + 4, top + 25);

  doc.text(description, EDGES[2] + 4, top + 18);
  doc.text(reference, EDGES[3] + 4, top + 18);
  doc.text(branch, EDGES[4] + 4, top + 18);
  if (debit) doc.text(money(debit), EDGES[6] - 6, top + 18, { align: "right" });
  if (credit) doc.text(money(credit), EDGES[7] - 6, top + 18, { align: "right" });
  doc.text(money(balance), EDGES[8] - 6, top + 18, { align: "right" });
}

/** A balance-only row: a date and a balance, no debit or credit. */
function drawMarker(top, label, date, balance) {
  doc.setFont("times", "normal");
  doc.setFontSize(8.5);
  const [day, month, year] = date.split(" ");
  doc.text(`${day} ${month}`, EDGES[0] + 4, top + 11);
  doc.text(year, EDGES[0] + 4, top + 25);
  doc.text(`${day} ${month}`, EDGES[1] + 4, top + 11);
  doc.text(year, EDGES[1] + 4, top + 25);
  doc.text(label, EDGES[2] + 4, top + 18);
  doc.text("—", EDGES[3] + 4, top + 18);
  doc.text("0000", EDGES[4] + 4, top + 18);
  doc.text(money(balance), EDGES[8] - 6, top + 18, { align: "right" });
}

// --- build ------------------------------------------------------------------

const rows = [];
let running = OPENING;
rows.push({ kind: "marker", label: "OPENING BALANCE", date: "01 Dec 2025", balance: running });
for (const txn of TXNS) {
  running = running - txn[4] + txn[5];
  rows.push({ kind: "txn", txn, balance: running });
}
rows.push({ kind: "marker", label: "CLOSING BALANCE", date: "10 Dec 2025", balance: running });

let pageIndex = 0;
let y = 0;
let tableTop = 0;

function startPage() {
  if (pageIndex > 0) doc.addPage();
  if (pageIndex === 0) {
    doc.setFont("times", "bold");
    doc.setFontSize(12);
    doc.text("Demo Bank Statement || Synthetic Fixture", 72, 47);
    doc.setFont("times", "normal");
    doc.setFontSize(9);
    doc.text("Account Name: Fixture Account Holder", 72, 72);
    doc.text("Account No: XXXXXXXX4417", 72, 86);
    doc.text("IFSC: DEMO0001234", 72, 100);
    doc.text("Statement Period: 01 Dec 2025 to 10 Dec 2025", 72, 114);
    tableTop = FIRST_PAGE_TABLE_TOP;
  } else {
    tableTop = LATER_PAGE_TABLE_TOP;
  }
  pageIndex += 1;

  y = tableTop;
  drawRowRule(y);            // top border
  drawHeader(y);             // header band, repeated on every page
  y += ROW_HEIGHT;
  drawRowRule(y);            // under the header
}

function finishPage() {
  drawColumnRules(tableTop, y);
}

startPage();

for (const row of rows) {
  if (y + ROW_HEIGHT > PAGE_HEIGHT - BOTTOM_MARGIN) {
    finishPage();
    startPage();
  }
  if (row.kind === "marker") drawMarker(y, row.label, row.date, row.balance);
  else drawRow(y, row.txn, row.balance);
  y += ROW_HEIGHT;
  drawRowRule(y);
}
finishPage();

writeFileSync(join(here, "statement-05-ruled.pdf"), Buffer.from(doc.output("arraybuffer")));

const debits = TXNS.reduce((sum, t) => sum + t[4], 0);
const credits = TXNS.reduce((sum, t) => sum + t[5], 0);
console.log(
  `Wrote statement-05-ruled.pdf — ${TXNS.length} transactions over ${pageIndex} pages, opening ${OPENING}, closing ${running}, debits ${debits}, credits ${credits}`
);
