// Generates the synthetic PDF fixture used to exercise the PDF.js text-layer
// path and the geometric row reconstruction in lib/bankStatement/parser/pdf.ts.
//
// Run: node tests/fixtures/generic/make-statement-pdf.mjs
//
// The output is committed so the Playwright test has something to import. It is
// entirely synthetic — see tests/fixtures/README.md.

import { writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { jsPDF } from "jspdf";

const here = dirname(fileURLToPath(import.meta.url));

// Column x positions, in points. The parser has to recover these from the text
// runs alone — it gets no table structure from the PDF.
const COLUMNS = [40, 110, 190, 380, 450, 520];

const HEADER = ["Txn Date", "Value Date", "Narration", "Withdrawal Amt.", "Deposit Amt.", "Closing Balance"];

const ROWS = [
  ["01/04/2025", "01/04/2025", "NEFT CR/MERIDIAN RETAIL PVT LTD/INV-4101", "", "50000.00", "175000.00"],
  ["02/04/2025", "02/04/2025", "ACH DR/OFFICE RENT/SKYLINE PROPERTIES", "18000.00", "", "157000.00"],
  ["03/04/2025", "03/04/2025", "NEFT DR/SALARY/RAHUL MEHTA", "22000.00", "", "135000.00"],
  ["05/04/2025", "05/04/2025", "BILLPAY/ELECTRICITY/TORRENT POWER LTD", "3200.00", "", "131800.00"],
  ["07/04/2025", "07/04/2025", "UPI/DR/GOOGLE ADS/MARKETING SPEND", "6500.00", "", "125300.00"],
  ["09/04/2025", "09/04/2025", "CASH DEPOSIT/CDM BRANCH COUNTER", "", "15000.00", "140300.00"],
  ["11/04/2025", "11/04/2025", "RTGS DR/PURCHASE/VERTEX SUPPLIES", "9500.00", "", "130800.00"],
  ["14/04/2025", "14/04/2025", "ATM WDL/SELF WITHDRAWAL/MG ROAD", "5000.00", "", "125800.00"],
  ["18/04/2025", "18/04/2025", "NEFT CR/SUNRISE FOODS LLP/INV-4108", "", "40700.00", "166500.00"],
  ["21/04/2025", "21/04/2025", "BANK CHARGE:MONTHLY SERVICE CHARGE", "236.00", "", "166264.00"],
  ["24/04/2025", "24/04/2025", "GST PAYMENT/GSTN CHALLAN/202504", "7500.00", "", "158764.00"],
  ["28/04/2025", "28/04/2025", "INT.PD:SB INTEREST CREDIT", "", "1236.00", "160000.00"],
];

const doc = new jsPDF({ unit: "pt", format: "a4" });

doc.setFont("helvetica", "bold");
doc.setFontSize(13);
doc.text("DEMO BANK LIMITED", 40, 50);

doc.setFont("helvetica", "normal");
doc.setFontSize(9);
doc.text("Account Name: Aarav Digital Services", 40, 70);
doc.text("Account No: XXXXXXXX4417", 40, 84);
doc.text("IFSC: DEMO0001234", 40, 98);
doc.text("Statement Period: 01/04/2025 to 30/04/2025", 40, 112);
doc.text("Opening Balance: 125000.00", 40, 126);

let y = 160;
doc.setFont("helvetica", "bold");
HEADER.forEach((cell, index) => doc.text(cell, COLUMNS[index], y));

doc.setFont("helvetica", "normal");
y += 18;
for (const row of ROWS) {
  row.forEach((cell, index) => {
    if (cell === "") return;
    // Clip each cell to its own column. Without this the long narrations
    // physically overrun the withdrawal column, which no real statement does —
    // and a fixture that overlaps is testing a layout that does not exist.
    const limit = (COLUMNS[index + 1] ?? 560) - COLUMNS[index] - 8;
    doc.text(doc.splitTextToSize(cell, limit)[0] ?? "", COLUMNS[index], y);
  });
  y += 16;
}

y += 14;
doc.setFont("helvetica", "bold");
doc.text("Closing Balance: 160000.00", 40, y);

const bytes = doc.output("arraybuffer");
writeFileSync(join(here, "statement-04.pdf"), Buffer.from(bytes));
console.log(`Wrote statement-04.pdf — ${ROWS.length} transactions`);
