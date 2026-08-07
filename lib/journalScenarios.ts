// Journal entry scenario library — real-world transactions with the correct
// debit/credit lines pre-filled against the default Chart of Accounts
// (lib/bookkeeping DEFAULT_ACCOUNTS ids), a plain-English explanation and the
// most common mistake to avoid. Amounts are illustrative; users edit them.

export type ScenarioLine = {
  accountId: string; // id from DEFAULT_ACCOUNTS
  side: "debit" | "credit";
  amount: number;
};

export type JournalScenario = {
  id: string;
  name: string;
  category: string;
  narration: string;
  lines: ScenarioLine[];
  explanation: string;
  mistake: string;
};

export const SCENARIO_CATEGORIES = [
  "Sales & Revenue",
  "Purchases & Expenses",
  "Payroll",
  "Cash & Bank",
  "Fixed Assets",
  "Taxes",
  "Equity & Owner",
  "Receivables & Payables",
  "Adjusting Entries",
] as const;

const A = {
  cash: "a-1000",
  bank: "a-1010",
  receivable: "a-1100",
  inventory: "a-1200",
  equipment: "a-1500",
  payable: "a-2000",
  gst: "a-2100",
  loan: "a-2200",
  capital: "a-3000",
  drawings: "a-3100",
  sales: "a-4000",
  otherIncome: "a-4100",
  purchases: "a-5000",
  rent: "a-5100",
  salaries: "a-5200",
  utilities: "a-5300",
  marketing: "a-5400",
  misc: "a-5900",
};

export const JOURNAL_SCENARIOS: JournalScenario[] = [
  // ---- Sales & Revenue ----------------------------------------------------
  {
    id: "cash-sale",
    name: "Cash Sale",
    category: "Sales & Revenue",
    narration: "Cash sale of goods",
    lines: [
      { accountId: A.cash, side: "debit", amount: 10000 },
      { accountId: A.sales, side: "credit", amount: 10000 },
    ],
    explanation:
      "Cash (an asset) increases, so it is debited. Sales revenue increases, so it is credited.",
    mistake: "Crediting cash — receiving money always DEBITS the cash account.",
  },
  {
    id: "credit-sale",
    name: "Credit Sale",
    category: "Sales & Revenue",
    narration: "Sale of goods on credit to customer",
    lines: [
      { accountId: A.receivable, side: "debit", amount: 15000 },
      { accountId: A.sales, side: "credit", amount: 15000 },
    ],
    explanation:
      "The customer now owes you money — accounts receivable (asset) is debited; sales revenue is credited.",
    mistake: "Debiting cash on a credit sale — no cash has moved yet.",
  },
  {
    id: "sales-return",
    name: "Sales Return / Credit Note Issued",
    category: "Sales & Revenue",
    narration: "Goods returned by customer, credit note issued",
    lines: [
      { accountId: A.sales, side: "debit", amount: 2000 },
      { accountId: A.receivable, side: "credit", amount: 2000 },
    ],
    explanation:
      "A return reverses part of the original sale: revenue is reduced (debited) and the customer's balance is reduced (credited).",
    mistake: "Forgetting to also reverse the GST portion when tax was charged on the sale.",
  },
  {
    id: "advance-from-customer",
    name: "Advance Received from Customer",
    category: "Sales & Revenue",
    narration: "Advance received from customer against future order",
    lines: [
      { accountId: A.bank, side: "debit", amount: 5000 },
      { accountId: A.payable, side: "credit", amount: 5000 },
    ],
    explanation:
      "You have the money but haven't earned it yet — it's a liability (advance/creditors), not revenue, until you deliver.",
    mistake: "Crediting sales immediately — revenue is recognised on delivery, not on receipt of the advance.",
  },
  {
    id: "rent-received",
    name: "Rent / Other Income Received",
    category: "Sales & Revenue",
    narration: "Rent received for sublet portion of shop",
    lines: [
      { accountId: A.bank, side: "debit", amount: 8000 },
      { accountId: A.otherIncome, side: "credit", amount: 8000 },
    ],
    explanation: "Bank increases (debit); non-trading income is credited to Other Income.",
    mistake: "Mixing other income into Sales Revenue — keep non-trading income separate.",
  },
  {
    id: "bad-debt-recovery",
    name: "Bad Debt Recovered",
    category: "Sales & Revenue",
    narration: "Recovered amount previously written off as bad debt",
    lines: [
      { accountId: A.cash, side: "debit", amount: 3000 },
      { accountId: A.otherIncome, side: "credit", amount: 3000 },
    ],
    explanation:
      "A debt written off earlier that is later recovered is treated as income when received.",
    mistake: "Crediting the customer's account — it was already closed when written off.",
  },

  // ---- Purchases & Expenses ----------------------------------------------
  {
    id: "cash-purchase",
    name: "Cash Purchase of Goods",
    category: "Purchases & Expenses",
    narration: "Purchased goods for resale, paid cash",
    lines: [
      { accountId: A.purchases, side: "debit", amount: 7000 },
      { accountId: A.cash, side: "credit", amount: 7000 },
    ],
    explanation: "Purchases (expense/COGS) is debited; cash paid out is credited.",
    mistake: "Debiting inventory AND purchases for the same goods — pick one method and stay consistent.",
  },
  {
    id: "credit-purchase",
    name: "Credit Purchase of Goods",
    category: "Purchases & Expenses",
    narration: "Purchased goods on credit from supplier",
    lines: [
      { accountId: A.purchases, side: "debit", amount: 12000 },
      { accountId: A.payable, side: "credit", amount: 12000 },
    ],
    explanation:
      "Purchases is debited; you now owe the supplier, so accounts payable (liability) is credited.",
    mistake: "Crediting cash before any payment is made.",
  },
  {
    id: "purchase-return",
    name: "Purchase Return / Debit Note",
    category: "Purchases & Expenses",
    narration: "Returned goods to supplier, debit note raised",
    lines: [
      { accountId: A.payable, side: "debit", amount: 2500 },
      { accountId: A.purchases, side: "credit", amount: 2500 },
    ],
    explanation:
      "Returning goods reduces what you owe (debit payable) and reduces purchases (credit).",
    mistake: "Recording the return as a sale — it's a reduction of purchases, not revenue.",
  },
  {
    id: "rent-paid",
    name: "Rent Paid",
    category: "Purchases & Expenses",
    narration: "Paid monthly shop rent by bank transfer",
    lines: [
      { accountId: A.rent, side: "debit", amount: 25000 },
      { accountId: A.bank, side: "credit", amount: 25000 },
    ],
    explanation: "Rent expense is debited; bank is credited for the payment.",
    mistake: "Debiting the landlord as a receivable — rent paid is an expense, not an asset.",
  },
  {
    id: "electricity-paid",
    name: "Electricity / Utility Bill Paid",
    category: "Purchases & Expenses",
    narration: "Paid electricity bill in cash",
    lines: [
      { accountId: A.utilities, side: "debit", amount: 4500 },
      { accountId: A.cash, side: "credit", amount: 4500 },
    ],
    explanation: "Utilities expense is debited; cash is credited.",
    mistake: "Booking the bill only when paid if it belongs to last month — accrue it in the right period.",
  },
  {
    id: "marketing-spend",
    name: "Marketing / Advertising Spend",
    category: "Purchases & Expenses",
    narration: "Paid for social media advertising",
    lines: [
      { accountId: A.marketing, side: "debit", amount: 6000 },
      { accountId: A.bank, side: "credit", amount: 6000 },
    ],
    explanation: "Marketing expense is debited; bank is credited.",
    mistake: "Capitalising routine ad spend as an asset — regular marketing is an expense.",
  },

  // ---- Payroll ------------------------------------------------------------
  {
    id: "salary-paid",
    name: "Salaries Paid",
    category: "Payroll",
    narration: "Paid staff salaries for the month",
    lines: [
      { accountId: A.salaries, side: "debit", amount: 60000 },
      { accountId: A.bank, side: "credit", amount: 60000 },
    ],
    explanation: "Salaries expense is debited; bank is credited for the net payment.",
    mistake: "Ignoring statutory deductions (PF/ESI/TDS) — those become liabilities until deposited.",
  },
  {
    id: "salary-accrued",
    name: "Salaries Payable (Accrual)",
    category: "Payroll",
    narration: "Month-end salaries earned but not yet paid",
    lines: [
      { accountId: A.salaries, side: "debit", amount: 60000 },
      { accountId: A.payable, side: "credit", amount: 60000 },
    ],
    explanation:
      "The expense belongs to this month even if paid next month — accrue it as a liability.",
    mistake: "Skipping the accrual so this month's profit looks better than it is.",
  },

  // ---- Cash & Bank --------------------------------------------------------
  {
    id: "cash-to-bank",
    name: "Cash Deposited into Bank",
    category: "Cash & Bank",
    narration: "Deposited day's cash takings into bank",
    lines: [
      { accountId: A.bank, side: "debit", amount: 20000 },
      { accountId: A.cash, side: "credit", amount: 20000 },
    ],
    explanation:
      "A contra entry — money moves between your own accounts. Bank up (debit), cash down (credit).",
    mistake: "Recording a deposit as income — it's the same money changing pockets.",
  },
  {
    id: "bank-to-cash",
    name: "Cash Withdrawn from Bank",
    category: "Cash & Bank",
    narration: "Withdrew cash from bank for shop float",
    lines: [
      { accountId: A.cash, side: "debit", amount: 10000 },
      { accountId: A.bank, side: "credit", amount: 10000 },
    ],
    explanation: "Contra entry: cash up (debit), bank down (credit).",
    mistake: "Confusing a withdrawal for business use with owner's drawings — different entries.",
  },
  {
    id: "loan-received",
    name: "Loan Received",
    category: "Cash & Bank",
    narration: "Business loan received from bank",
    lines: [
      { accountId: A.bank, side: "debit", amount: 200000 },
      { accountId: A.loan, side: "credit", amount: 200000 },
    ],
    explanation: "Bank (asset) increases; the loan is a liability you must repay, so it is credited.",
    mistake: "Crediting income — a loan is never revenue.",
  },
  {
    id: "loan-repaid",
    name: "Loan Instalment Paid (Principal + Interest)",
    category: "Cash & Bank",
    narration: "Paid monthly loan EMI — principal and interest",
    lines: [
      { accountId: A.loan, side: "debit", amount: 8000 },
      { accountId: A.misc, side: "debit", amount: 2000 },
      { accountId: A.bank, side: "credit", amount: 10000 },
    ],
    explanation:
      "Split the EMI: principal reduces the loan liability (debit); interest is an expense (debit); bank is credited for the full payment.",
    mistake: "Debiting the whole EMI to the loan — the interest portion is an expense.",
  },
  {
    id: "bank-charges",
    name: "Bank Charges Debited",
    category: "Cash & Bank",
    narration: "Bank service charges for the month",
    lines: [
      { accountId: A.misc, side: "debit", amount: 500 },
      { accountId: A.bank, side: "credit", amount: 500 },
    ],
    explanation: "Bank fees are an expense (debit); bank balance falls (credit).",
    mistake: "Leaving them unrecorded until reconciliation — book them monthly.",
  },

  // ---- Fixed Assets -------------------------------------------------------
  {
    id: "asset-cash",
    name: "Equipment Purchased (Cash/Bank)",
    category: "Fixed Assets",
    narration: "Purchased equipment, paid by bank transfer",
    lines: [
      { accountId: A.equipment, side: "debit", amount: 80000 },
      { accountId: A.bank, side: "credit", amount: 80000 },
    ],
    explanation:
      "An asset that lasts years is capitalised (debit Equipment), not expensed. Bank is credited.",
    mistake: "Expensing a long-life asset in one month — capitalise and depreciate it instead.",
  },
  {
    id: "asset-credit",
    name: "Equipment Purchased on Credit",
    category: "Fixed Assets",
    narration: "Purchased furniture on 30-day supplier credit",
    lines: [
      { accountId: A.equipment, side: "debit", amount: 50000 },
      { accountId: A.payable, side: "credit", amount: 50000 },
    ],
    explanation: "Asset is debited; the supplier's dues sit in accounts payable until paid.",
    mistake: "Booking it in Purchases — capital items don't belong in COGS.",
  },
  {
    id: "depreciation",
    name: "Depreciation for the Year",
    category: "Fixed Assets",
    narration: "Annual depreciation on equipment",
    lines: [
      { accountId: A.misc, side: "debit", amount: 10000 },
      { accountId: A.equipment, side: "credit", amount: 10000 },
    ],
    explanation:
      "Depreciation expense is debited; the asset's book value is reduced (credited). Use our Depreciation Calculator for the amount.",
    mistake: "Skipping depreciation entirely — it's a real cost of using the asset.",
  },
  {
    id: "asset-sold",
    name: "Asset Sold for Cash",
    category: "Fixed Assets",
    narration: "Sold old equipment at book value",
    lines: [
      { accountId: A.cash, side: "debit", amount: 15000 },
      { accountId: A.equipment, side: "credit", amount: 15000 },
    ],
    explanation:
      "Cash comes in (debit); the asset leaves the books (credit). Any gap between price and book value is a gain (Other Income) or loss (expense).",
    mistake: "Booking the full sale price as income — only the profit over book value is income.",
  },

  // ---- Taxes --------------------------------------------------------------
  {
    id: "gst-on-sale",
    name: "Sale with GST Collected",
    category: "Taxes",
    narration: "Cash sale with GST collected",
    lines: [
      { accountId: A.cash, side: "debit", amount: 11800 },
      { accountId: A.sales, side: "credit", amount: 10000 },
      { accountId: A.gst, side: "credit", amount: 1800 },
    ],
    explanation:
      "GST you collect is not your income — it's owed to the government. Split the receipt: revenue and GST payable.",
    mistake: "Crediting the full amount to sales — the GST portion is a liability.",
  },
  {
    id: "gst-on-purchase",
    name: "Purchase with GST Input Credit",
    category: "Taxes",
    narration: "Purchased goods with GST input credit",
    lines: [
      { accountId: A.purchases, side: "debit", amount: 10000 },
      { accountId: A.gst, side: "debit", amount: 1800 },
      { accountId: A.payable, side: "credit", amount: 11800 },
    ],
    explanation:
      "GST paid on purchases offsets GST collected (input credit) — debit it against the GST account rather than costing it.",
    mistake: "Adding recoverable GST into the purchase cost when you can claim the input credit.",
  },
  {
    id: "gst-paid-govt",
    name: "GST Paid to Government",
    category: "Taxes",
    narration: "Paid net GST liability for the month",
    lines: [
      { accountId: A.gst, side: "debit", amount: 5000 },
      { accountId: A.bank, side: "credit", amount: 5000 },
    ],
    explanation: "Settling the GST liability: debit GST payable, credit bank.",
    mistake: "Booking the payment as an expense — you're clearing a liability, not spending.",
  },

  // ---- Equity & Owner -----------------------------------------------------
  {
    id: "owner-invests",
    name: "Owner Invests Capital",
    category: "Equity & Owner",
    narration: "Owner introduced capital into the business",
    lines: [
      { accountId: A.bank, side: "debit", amount: 100000 },
      { accountId: A.capital, side: "credit", amount: 100000 },
    ],
    explanation:
      "The business receives cash (debit bank); it owes that value to the owner — credit Owner's Capital.",
    mistake: "Crediting income — capital introduced is never revenue.",
  },
  {
    id: "owner-drawings",
    name: "Owner Drawings",
    category: "Equity & Owner",
    narration: "Owner withdrew cash for personal use",
    lines: [
      { accountId: A.drawings, side: "debit", amount: 15000 },
      { accountId: A.cash, side: "credit", amount: 15000 },
    ],
    explanation:
      "Personal withdrawals are not a business expense — debit Drawings (reduces equity), credit cash.",
    mistake: "Booking drawings as salary expense — that misstates business profit.",
  },

  // ---- Receivables & Payables --------------------------------------------
  {
    id: "customer-pays",
    name: "Customer Payment Received",
    category: "Receivables & Payables",
    narration: "Received payment against earlier credit sale",
    lines: [
      { accountId: A.bank, side: "debit", amount: 15000 },
      { accountId: A.receivable, side: "credit", amount: 15000 },
    ],
    explanation:
      "Bank goes up (debit); the customer no longer owes you, so receivables go down (credit). No new revenue — that was booked at sale.",
    mistake: "Crediting sales again on collection — that double-counts revenue.",
  },
  {
    id: "supplier-paid",
    name: "Supplier Payment Made",
    category: "Receivables & Payables",
    narration: "Paid supplier against earlier credit purchase",
    lines: [
      { accountId: A.payable, side: "debit", amount: 12000 },
      { accountId: A.bank, side: "credit", amount: 12000 },
    ],
    explanation: "The debt is cleared (debit payable); bank is credited.",
    mistake: "Debiting purchases again on payment — the expense was booked when goods arrived.",
  },
  {
    id: "bad-debt-writeoff",
    name: "Bad Debt Written Off",
    category: "Receivables & Payables",
    narration: "Wrote off irrecoverable customer balance",
    lines: [
      { accountId: A.misc, side: "debit", amount: 4000 },
      { accountId: A.receivable, side: "credit", amount: 4000 },
    ],
    explanation:
      "When a customer will clearly never pay, the receivable is removed (credit) and the loss expensed (debit).",
    mistake: "Keeping dead receivables on the books for years — they overstate your assets.",
  },

  // ---- Adjusting Entries --------------------------------------------------
  {
    id: "accrued-expense",
    name: "Accrued Expense (Month-End)",
    category: "Adjusting Entries",
    narration: "Expense incurred this month, bill not yet paid",
    lines: [
      { accountId: A.misc, side: "debit", amount: 3000 },
      { accountId: A.payable, side: "credit", amount: 3000 },
    ],
    explanation:
      "Match the expense to the period it belongs to, even if payment happens later.",
    mistake: "Only recording expenses when cash leaves — that's cash accounting, not accrual.",
  },
  {
    id: "closing-stock",
    name: "Closing Stock Adjustment",
    category: "Adjusting Entries",
    narration: "Recorded closing stock at period end",
    lines: [
      { accountId: A.inventory, side: "debit", amount: 30000 },
      { accountId: A.purchases, side: "credit", amount: 30000 },
    ],
    explanation:
      "Unsold goods aren't a cost of this period — move their value out of purchases (credit) into inventory (debit).",
    mistake: "Skipping the closing-stock entry, which overstates COGS and understates profit.",
  },
];
