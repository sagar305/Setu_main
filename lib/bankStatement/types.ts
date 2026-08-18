// Bank Statement Analyzer — shared domain types.
// ---------------------------------------------------------------------------
// Everything downstream of the parsers speaks these shapes. Nothing here is
// serialised to a server: the whole pipeline runs in the browser and persists
// only to this origin's localStorage / IndexedDB.

export type SourceFormat = "PDF" | "XLSX" | "XLS" | "CSV";

export type TransactionType = "DEBIT" | "CREDIT";

/**
 * How a transaction has been classified for the CA's purposes. Kept separate
 * from `category` because "transfer" is neither business nor personal, and a
 * category alone cannot express that.
 */
export type ClassificationType = "BUSINESS" | "PERSONAL" | "TRANSFER" | "UNKNOWN";

/**
 * Where the current classification came from — shown next to the confidence.
 *
 * The order below is the order of authority: a rule the CA wrote beats what the
 * CA taught this browser by correcting a row, which beats a keyword pattern,
 * which beats the on-device semantic model. MANUAL outranks everything because
 * it is the CA saying so directly.
 */
export type ClassificationSource =
  | "RULE"
  | "MANUAL"
  | "MEMORY"
  | "MERCHANT"
  | "HEURISTIC"
  | "AI"
  | "UNCLASSIFIED";

/** GST posture. Identification only — this tool draws no compliance conclusions. */
export type GstFlag = "RELEVANT" | "POTENTIAL" | "NOT_MARKED";

export type Transaction = {
  id: string;
  statementId: string;

  date: string; // ISO yyyy-mm-dd
  valueDate?: string;

  narration: string;

  referenceNumber?: string;
  chequeNumber?: string;

  debit: number;
  credit: number;

  balance?: number;

  currency: string;

  transactionType: TransactionType;

  category?: string;
  subCategory?: string;

  partyName?: string;
  accountName?: string;

  gstRelevant?: GstFlag;
  gstin?: string;

  classificationType: ClassificationType;
  classificationSource: ClassificationSource;

  /** Classification confidence 0–100. Never describes parser correctness. */
  confidence?: number;
  matchedRuleId?: string;

  /**
   * Set when a category was applied but the CA should still look at it — the
   * semantic model's middle band. Distinct from a low confidence number: this
   * says "acted, but check me", not "did not know".
   */
  needsReview?: boolean;

  /**
   * Raw cosine similarity (0–1) behind an AI classification, kept alongside the
   * calibrated score so the thresholds can be retuned against real statements
   * without re-running the model.
   */
  aiSimilarity?: number;

  isDuplicate?: boolean;
  /** Set when the CA overrides the duplicate flag either way. */
  duplicateOverride?: "KEEP" | "EXCLUDE";
  duplicateOfId?: string;

  isTransfer?: boolean;
  isCashTransaction?: boolean;
  isHighValue?: boolean;

  notes?: string;

  sourcePage?: number;
  sourceRow?: number;

  /** Row-level parse health. Rolls up into the statement's parseStatus. */
  rowStatus?: RowStatus;
  rowIssue?: string;

  createdAt: string;
};

/** Per-row parse health, distinct from classification confidence. */
export type RowStatus = "VALID" | "WARNING" | "UNRESOLVED";

/** Statement-level parse health, rolled up from rows plus the balance chain. */
export type ParseStatus = "VALID" | "WARNING" | "UNRESOLVED";

export type BankStatement = {
  id: string;
  fileName: string;

  bankName?: string;
  /** Which adapter produced this — "generic" when no bank layout matched. */
  parserId: string;
  /** False when the adapter has not been validated against real fixtures. */
  parserValidated: boolean;

  accountHolder?: string;
  accountNumberMasked?: string;
  accountType?: string;
  branch?: string;
  ifsc?: string;

  startDate?: string;
  endDate?: string;

  openingBalance?: number;
  closingBalance?: number;

  transactionCount: number;

  currency: string;
  sourceFormat: SourceFormat;
  importedAt: string;

  parseStatus: ParseStatus;
  validation: ValidationReport;
};

/**
 * Everything we know about how well the extraction went. The UI must never
 * present a statement as cleanly parsed while this says otherwise (§30).
 */
export type ValidationReport = {
  /** Rows the extractor emitted. */
  extracted: number;
  /** Rows we could fully resolve into a valid transaction. */
  resolved: number;
  /** Rows carrying a warning but still usable. */
  warnings: number;
  /** Rows we could not resolve. */
  unresolved: number;
  /**
   * Rows that carried a date but moved no money — an opening or closing
   * balance marker, a nil entry. Nothing is lost by skipping them; they are
   * reported separately so the count is never mistaken for a failure.
   */
  skippedRows: number;

  /** Balance-chain result, when the statement carried a balance column. */
  balanceChain: BalanceChainResult;

  /** Human-readable issues to surface on the review screen. */
  issues: ValidationIssue[];
};

export type BalanceChainResult = {
  checked: boolean;
  /** Rows where previous balance + credit − debit ≠ current balance. */
  breaks: number;
  firstBreakRow?: number;
  /** Opening/closing consistency when the statement declared them. */
  openingMatches?: boolean;
  closingMatches?: boolean;
};

export type ValidationIssue = {
  severity: "warning" | "error";
  message: string;
  row?: number;
  page?: number;
};

// ---------------------------------------------------------------------------
// Categories
// ---------------------------------------------------------------------------

export type CategoryGroup = "INCOME" | "EXPENSE" | "TRANSFER" | "CASH";

export type Category = {
  id: string;
  name: string;
  group: CategoryGroup;
  parentId?: string;
  /**
   * What belongs in this category, in plain English. Read by a human as a
   * tooltip, and embedded by the on-device model as the thing a transaction is
   * compared against — a category with no description can only be matched on
   * its name, so this is functional text, not commentary.
   */
  description?: string;
  /** A few merchants or narrations that belong here, used the same way. */
  examples?: string[];
  /** Built-in categories ship with the tool; users may add their own. */
  builtIn: boolean;
  archived: boolean;
  order: number;
};

// ---------------------------------------------------------------------------
// Rules
// ---------------------------------------------------------------------------

export type RuleField =
  | "narration"
  | "reference"
  | "amount"
  | "direction"
  | "date";

export type RuleOperator =
  | "contains"
  | "startsWith"
  | "endsWith"
  | "equals"
  | "greaterThan"
  | "lessThan"
  | "between";

export type RuleCondition = {
  field: RuleField;
  operator: RuleOperator;
  /**
   * Text for narration/reference/direction; number for amount; ISO for date.
   * Kept for rules saved before `values` existed, and as the first entry of it.
   */
  value: string;
  /**
   * Several alternatives for this one condition, matched with OR: "narration
   * contains ANY of Swiggy, Zomato, Dominos". Conditions are still ANDed with
   * each other — this is the OR that lives *inside* a condition, so one rule
   * can cover a whole category instead of one rule per keyword.
   */
  values?: string[];
  /** Second bound for `between`. */
  value2?: string;
};

export type ClassificationRule = {
  id: string;
  name: string;
  conditions: RuleCondition[];
  result: {
    category?: string;
    subCategory?: string;
    partyName?: string;
    classificationType?: ClassificationType;
    gstRelevant?: GstFlag;
  };
  priority: number;
  enabled: boolean;
  createdAt: string;
  /**
   * Where the rule came from. "AI_APPROVED" marks one written by confirming a
   * suggestion in the AI review queue — deterministic from then on, and the
   * reason the same merchant never needs the model again. Absent on rules saved
   * before this existed, which are the CA's own.
   */
  origin?: "USER" | "AI_APPROVED";
};

// ---------------------------------------------------------------------------
// Session, settings, audit
// ---------------------------------------------------------------------------

/** One analysis session groups the statements a CA wants to look at together. */
export type AnalysisSession = {
  id: string;
  name: string;
  statementIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type AnalyzerSettings = {
  highValueThreshold: number;
  includeDuplicatesInTotals: boolean;
  /** Below this classification confidence a transaction needs CA review. */
  reviewConfidenceThreshold: number;
  /**
   * Thresholds for the on-device semantic model, on the same 0–100 scale.
   * At or above `aiAutoThreshold` the category is applied outright; down to
   * `aiReviewThreshold` it is applied but flagged; below that the transaction
   * is left uncategorised rather than guessed at. Both are adjustable because
   * the right values can only be found against real statements.
   */
  aiAutoThreshold: number;
  aiReviewThreshold: number;
};

export type AuditEntry = {
  id: string;
  at: string;
  action: string;
  detail?: string;
};

// ---------------------------------------------------------------------------
// Analysis outputs
// ---------------------------------------------------------------------------

export type MonthlyRow = {
  month: string; // yyyy-mm
  label: string;
  openingBalance?: number;
  credits: number;
  debits: number;
  closingBalance?: number;
  net: number;
  count: number;
};

export type CategoryRow = {
  category: string;
  group: CategoryGroup | "UNCATEGORISED";
  debit: number;
  credit: number;
  count: number;
  share: number;
};

export type PartyRow = {
  party: string;
  debit: number;
  credit: number;
  count: number;
};

export type AnalysisResult = {
  totals: {
    credits: number;
    debits: number;
    net: number;
    count: number;
    excludedDuplicates: number;
  };
  monthly: MonthlyRow[];
  expenseCategories: CategoryRow[];
  incomeCategories: CategoryRow[];
  parties: PartyRow[];
  cash: { deposits: number; withdrawals: number; transactions: Transaction[] };
  highValue: Transaction[];
  uncategorised: Transaction[];
  bankCharges: { total: number; transactions: Transaction[] };
  interest: { total: number; transactions: Transaction[] };
  transfers: { total: number; transactions: Transaction[] };
  gst: { relevant: Transaction[]; potential: Transaction[] };
  anomalies: Anomaly[];
};

export type Anomaly = {
  id: string;
  kind:
    | "HIGH_VALUE"
    | "ROUND_TRIPPING"
    | "WEEKEND_CASH"
    | "SPIKE"
    | "DUPLICATE"
    | "BALANCE_BREAK";
  severity: "info" | "warning";
  message: string;
  transactionIds: string[];
};

// ---------------------------------------------------------------------------
// Reconciliation
// ---------------------------------------------------------------------------

export type LedgerEntry = {
  id: string;
  date: string;
  narration: string;
  reference?: string;
  debit: number;
  credit: number;
  sourceRow?: number;
};

export type MatchStatus =
  | "MATCHED"
  | "LIKELY_MATCH"
  | "UNMATCHED_BANK"
  | "UNMATCHED_BOOK"
  | "AMOUNT_MISMATCH"
  | "DUPLICATE";

export type ReconciliationMatch = {
  id: string;
  status: MatchStatus;
  bankTransactionId?: string;
  ledgerEntryId?: string;
  /** Which matching level produced this: 1 exact, 2 date window, 3 fuzzy. */
  level?: 1 | 2 | 3;
  score?: number;
  difference?: number;
  confirmed?: boolean;
  rejected?: boolean;
};

export type ReconciliationSession = {
  id: string;
  statementIds: string[];
  ledgerFileName?: string;
  entries: LedgerEntry[];
  matches: ReconciliationMatch[];
  createdAt: string;
};

// ---------------------------------------------------------------------------
// Parser plumbing
// ---------------------------------------------------------------------------

/** A row as the extractor found it, before normalisation. */
export type RawRow = {
  cells: string[];
  page?: number;
  row?: number;
};

/** Which raw column feeds which transaction field. */
export type ColumnMapping = {
  date?: number;
  valueDate?: number;
  narration?: number;
  reference?: number;
  cheque?: number;
  debit?: number;
  credit?: number;
  /** Single signed amount column, used when debit/credit are not split. */
  amount?: number;
  balance?: number;
  /** Column carrying "Dr"/"Cr" when amount is a single unsigned column. */
  direction?: number;
};

export type DateFormat = "DMY" | "MDY" | "YMD";

export type ParseProgress = {
  stage: "reading" | "extracting" | "normalising" | "classifying" | "analysing";
  message: string;
  current?: number;
  total?: number;
};

export type ParseOutcome = {
  statement: BankStatement;
  transactions: Transaction[];
  /** Set when the date format could not be determined unambiguously. */
  ambiguousDateFormat?: boolean;
  /** Present for delimited/tabular sources so the CA can remap columns. */
  mapping?: ColumnMapping;
  headers?: string[];
  rawRows?: RawRow[];
  /**
   * Every row the extractor found, before the header split and before any row
   * plan was applied — including the letterhead and the footer.
   *
   * This is what the repair grid shows. `rawRows` above is the parser's own
   * view (data rows only, truncated) and is deliberately left alone so nothing
   * that already reads it changes behaviour.
   */
  grid?: RawRow[];
};
