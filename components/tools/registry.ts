import dynamic from "next/dynamic";
import { createElement, type ComponentType } from "react";

/** One tool page, as the localized route needs to render it. */
export type ToolPageEntry = {
  /** The interactive part of the page. */
  Tool: ComponentType;
  /** Whether this page publishes the SoftwareApplication block. */
  schema: boolean;
  /** Whether this page shows the suggested-tools strip. */
  suggested: boolean;
  /**
   * Whether the tool needs its own Suspense boundary. A couple read search
   * params, which a statically rendered route cannot do unboundaried.
   */
  suspense: boolean;
};

/**
 * Every tool page, by slug.
 *
 * The English pages under app/tools/<slug> each import their own tool and say
 * which extra blocks they show, so a localized route — one file serving every
 * slug in every language — needs a way to reach the same components and make
 * the same choices. Generated from those pages by
 * scripts/sync-tool-registry.mjs rather than kept by hand, so a new tool cannot
 * be added to the English site and quietly go missing here, and the two routes
 * cannot drift apart over which blocks a page carries.
 *
 * The imports are lazy so that a page still ships only the tool it renders. A
 * plain map of static imports would pull all thirty-five into the bundle of
 * every tool page, on a site whose readers are largely on phones.
 */
export const TOOL_PAGES: Record<string, ToolPageEntry> = {
  "abc-analysis": {
    Tool: dynamic(() => import("@/components/tools/analysis/AbcAnalysisTool").then((m) => m.AbcAnalysisTool)),
    schema: false, suggested: false, suspense: false,
  },
  "accounts-payable-aging": {
    Tool: dynamic(async () => {
      const { AgingReportTool } = await import("@/components/tools/aging/AgingReportTool");
      return function AccountsPayableAging() {
        return createElement(AgingReportTool, { kind: "payable" });
      };
    }),
    schema: false, suggested: false, suspense: false,
  },
  "appointment-book": {
    Tool: dynamic(() => import("@/components/tools/AppointmentBook/AppointmentBookTool").then((m) => m.AppointmentBookTool)),
    schema: true, suggested: true, suspense: false,
  },
  "balance-sheet": {
    Tool: dynamic(() => import("@/components/tools/statements/BalanceSheetTool").then((m) => m.BalanceSheetTool)),
    schema: false, suggested: false, suspense: false,
  },
  "bank-reconciliation": {
    Tool: dynamic(() => import("@/components/tools/bookkeeping/BankReconciliationTool").then((m) => m.BankReconciliationTool)),
    schema: false, suggested: false, suspense: false,
  },
  "barcode-generator": {
    Tool: dynamic(() => import("@/components/tools/BarcodeGenerator/BarcodeGeneratorTool").then((m) => m.BarcodeGeneratorTool)),
    schema: true, suggested: true, suspense: false,
  },
  "budget-vs-actual": {
    Tool: dynamic(() => import("@/components/tools/analysis/BudgetVsActualTool").then((m) => m.BudgetVsActualTool)),
    schema: false, suggested: false, suspense: false,
  },
  "business-profile": {
    Tool: dynamic(() => import("@/components/tools/BusinessProfile/BusinessProfileTool").then((m) => m.BusinessProfileTool)),
    schema: true, suggested: true, suspense: false,
  },
  "cash-book": {
    Tool: dynamic(() => import("@/components/tools/CashBook/CashBookTool").then((m) => m.CashBookTool)),
    schema: true, suggested: true, suspense: false,
  },
  "cash-flow-statement": {
    Tool: dynamic(() => import("@/components/tools/statements/CashFlowTool").then((m) => m.CashFlowTool)),
    schema: false, suggested: false, suspense: false,
  },
  "chart-of-accounts": {
    Tool: dynamic(() => import("@/components/tools/bookkeeping/ChartOfAccountsTool").then((m) => m.ChartOfAccountsTool)),
    schema: false, suggested: false, suspense: false,
  },
  "credit-note-generator": {
    Tool: dynamic(async () => {
      const { DocumentTool } = await import("@/components/tools/docgen/DocumentTool");
      return function CreditNoteGenerator() {
        return createElement(DocumentTool, { docType: "credit-note" });
      };
    }),
    schema: false, suggested: false, suspense: false,
  },
  "customer-ledger": {
    Tool: dynamic(() => import("@/components/tools/CustomerLedger/CustomerLedgerTool").then((m) => m.CustomerLedgerTool)),
    schema: true, suggested: true, suspense: false,
  },
  "customer-statement": {
    Tool: dynamic(() => import("@/components/tools/statements/CustomerStatementTool").then((m) => m.CustomerStatementTool)),
    schema: false, suggested: false, suspense: false,
  },
  "debit-note-generator": {
    Tool: dynamic(async () => {
      const { DocumentTool } = await import("@/components/tools/docgen/DocumentTool");
      return function DebitNoteGenerator() {
        return createElement(DocumentTool, { docType: "debit-note" });
      };
    }),
    schema: false, suggested: false, suspense: false,
  },
  "expense-tracker": {
    Tool: dynamic(() => import("@/components/tools/ExpenseTracker/ExpenseTrackerTool").then((m) => m.ExpenseTrackerTool)),
    schema: true, suggested: true, suspense: false,
  },
  "general-ledger": {
    Tool: dynamic(() => import("@/components/tools/bookkeeping/GeneralLedgerTool").then((m) => m.GeneralLedgerTool)),
    schema: false, suggested: false, suspense: false,
  },
  "invoice-aging-report": {
    Tool: dynamic(async () => {
      const { AgingReportTool } = await import("@/components/tools/aging/AgingReportTool");
      return function InvoiceAgingReport() {
        return createElement(AgingReportTool, { kind: "receivable" });
      };
    }),
    schema: false, suggested: false, suspense: false,
  },
  "invoice-generator": {
    Tool: dynamic(() => import("@/components/tools/InvoiceGenerator/InvoiceGeneratorTool").then((m) => m.InvoiceGeneratorTool)),
    schema: true, suggested: false, suspense: false,
  },
  "journal-entry": {
    Tool: dynamic(() => import("@/components/tools/bookkeeping/JournalEntryTool").then((m) => m.JournalEntryTool)),
    schema: false, suggested: false, suspense: false,
  },
  "label-printer": {
    Tool: dynamic(() => import("@/components/tools/LabelPrinter/LabelPrinterTool").then((m) => m.LabelPrinterTool)),
    schema: true, suggested: true, suspense: false,
  },
  "profit-dashboard": {
    Tool: dynamic(() => import("@/components/tools/ProfitDashboard/ProfitDashboardTool").then((m) => m.ProfitDashboardTool)),
    schema: true, suggested: true, suspense: false,
  },
  "profit-loss-statement": {
    Tool: dynamic(() => import("@/components/tools/statements/ProfitLossTool").then((m) => m.ProfitLossTool)),
    schema: false, suggested: false, suspense: false,
  },
  "purchase-order-generator": {
    Tool: dynamic(async () => {
      const { DocumentTool } = await import("@/components/tools/docgen/DocumentTool");
      return function PurchaseOrderGenerator() {
        return createElement(DocumentTool, { docType: "purchase-order" });
      };
    }),
    schema: false, suggested: false, suspense: false,
  },
  "purchase-register": {
    Tool: dynamic(() => import("@/components/tools/PurchaseRegister/PurchaseRegisterTool").then((m) => m.PurchaseRegisterTool)),
    schema: true, suggested: true, suspense: false,
  },
  "qr-menu-generator": {
    Tool: dynamic(() => import("@/components/tools/QrMenuGenerator/QrMenuGeneratorTool").then((m) => m.QrMenuGeneratorTool)),
    schema: true, suggested: false, suspense: false,
  },
  "quotation-generator": {
    Tool: dynamic(() => import("@/components/tools/QuotationGenerator/QuotationGeneratorTool").then((m) => m.QuotationGeneratorTool)),
    schema: true, suggested: true, suspense: false,
  },
  "receipt-designer": {
    Tool: dynamic(() => import("@/components/tools/ReceiptDesigner/ReceiptDesignerTool").then((m) => m.ReceiptDesignerTool)),
    schema: true, suggested: true, suspense: false,
  },
  "sales-order-generator": {
    Tool: dynamic(async () => {
      const { DocumentTool } = await import("@/components/tools/docgen/DocumentTool");
      return function SalesOrderGenerator() {
        return createElement(DocumentTool, { docType: "sales-order" });
      };
    }),
    schema: false, suggested: false, suspense: false,
  },
  "stock-register": {
    Tool: dynamic(() => import("@/components/tools/StockRegister/StockRegisterTool").then((m) => m.StockRegisterTool)),
    schema: true, suggested: true, suspense: false,
  },
  "supplier-book": {
    Tool: dynamic(() => import("@/components/tools/SupplierBook/SupplierBookTool").then((m) => m.SupplierBookTool)),
    schema: true, suggested: true, suspense: false,
  },
  "trial-balance": {
    Tool: dynamic(() => import("@/components/tools/bookkeeping/TrialBalanceTool").then((m) => m.TrialBalanceTool)),
    schema: false, suggested: false, suspense: false,
  },
  "upi-qr-generator": {
    Tool: dynamic(() => import("@/components/tools/UpiQrGenerator/UpiQrGeneratorTool").then((m) => m.UpiQrGeneratorTool)),
    schema: true, suggested: false, suspense: false,
  },
  "upi-qr-split": {
    Tool: dynamic(() => import("@/components/tools/UpiQrSplit/UpiQrSplitTool").then((m) => m.UpiQrSplitTool)),
    schema: true, suggested: false, suspense: true,
  },
  "vendor-comparison": {
    Tool: dynamic(() => import("@/components/tools/analysis/VendorComparisonTool").then((m) => m.VendorComparisonTool)),
    schema: false, suggested: false, suspense: false,
  },
};
