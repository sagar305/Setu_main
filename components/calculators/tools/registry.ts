import dynamic from "next/dynamic";
import type { ComponentType } from "react";

/**
 * The interactive part of each calculator page, by slug.
 *
 * The English pages under app/calculators/<slug> each import their own tool, so
 * a localized route — one file serving every slug in every language — needs a
 * way to reach the same components. Generated from those pages by
 * scripts/sync-calculator-registry.mjs rather than kept by hand, so a new
 * calculator cannot be added to the English site and quietly go missing here.
 *
 * The imports are lazy so that a page still ships only the calculator it
 * renders. A plain map of static imports would pull all twenty-nine into the
 * bundle of every calculator page, on a site whose readers are largely on
 * phones.
 */
export const CALCULATOR_TOOLS: Record<string, ComponentType> = {
  "aov-calculator": dynamic(() =>
    import("@/components/calculators/tools/AovCalculatorTool").then(
      (m) => m.AovCalculatorTool,
    ),
  ),
  "break-even-calculator": dynamic(() =>
    import("@/components/calculators/tools/BreakEvenCalculatorTool").then(
      (m) => m.BreakEvenCalculatorTool,
    ),
  ),
  "cac-calculator": dynamic(() =>
    import("@/components/calculators/tools/CacCalculatorTool").then(
      (m) => m.CacCalculatorTool,
    ),
  ),
  "depreciation-calculator": dynamic(() =>
    import("@/components/calculators/tools/DepreciationCalculatorTool").then(
      (m) => m.DepreciationCalculatorTool,
    ),
  ),
  "discount-calculator": dynamic(() =>
    import("@/components/calculators/tools/DiscountCalculatorTool").then(
      (m) => m.DiscountCalculatorTool,
    ),
  ),
  "financial-ratio-calculator": dynamic(() =>
    import("@/components/calculators/tools/FinancialRatioCalculatorTool").then(
      (m) => m.FinancialRatioCalculatorTool,
    ),
  ),
  "food-cost-calculator": dynamic(() =>
    import("@/components/calculators/tools/FoodCostCalculatorTool").then(
      (m) => m.FoodCostCalculatorTool,
    ),
  ),
  "gratuity-calculator": dynamic(() =>
    import("@/components/calculators/tools/GratuityCalculatorTool").then(
      (m) => m.GratuityCalculatorTool,
    ),
  ),
  "gst-calculator": dynamic(() =>
    import("@/components/calculators/tools/GstCalculatorTool").then(
      (m) => m.GstCalculatorTool,
    ),
  ),
  "income-tax-calculator": dynamic(() =>
    import("@/components/calculators/tools/IncomeTaxCalculatorTool").then(
      (m) => m.IncomeTaxCalculatorTool,
    ),
  ),
  "inventory-turnover-calculator": dynamic(() =>
    import("@/components/calculators/tools/InventoryTurnoverCalculatorTool").then(
      (m) => m.InventoryTurnoverCalculatorTool,
    ),
  ),
  "liquor-cost-calculator": dynamic(() =>
    import("@/components/calculators/tools/LiquorCostCalculatorTool").then(
      (m) => m.LiquorCostCalculatorTool,
    ),
  ),
  "loan-emi-calculator": dynamic(() =>
    import("@/components/calculators/tools/LoanEmiCalculatorTool").then(
      (m) => m.LoanEmiCalculatorTool,
    ),
  ),
  "markup-calculator": dynamic(() =>
    import("@/components/calculators/tools/MarkupCalculatorTool").then(
      (m) => m.MarkupCalculatorTool,
    ),
  ),
  "mdr-calculator": dynamic(() =>
    import("@/components/calculators/tools/MdrCalculatorTool").then(
      (m) => m.MdrCalculatorTool,
    ),
  ),
  "menu-engineering-calculator": dynamic(() =>
    import("@/components/calculators/tools/MenuEngineeringCalculatorTool").then(
      (m) => m.MenuEngineeringCalculatorTool,
    ),
  ),
  "online-menu-price-calculator": dynamic(() =>
    import("@/components/calculators/tools/OnlineMenuPriceCalculatorTool").then(
      (m) => m.OnlineMenuPriceCalculatorTool,
    ),
  ),
  "online-order-commission-calculator": dynamic(() =>
    import("@/components/calculators/tools/OnlineOrderCommissionCalculatorTool").then(
      (m) => m.OnlineOrderCommissionCalculatorTool,
    ),
  ),
  "payment-terms-calculator": dynamic(() =>
    import("@/components/calculators/tools/PaymentTermsCalculatorTool").then(
      (m) => m.PaymentTermsCalculatorTool,
    ),
  ),
  "profit-margin-calculator": dynamic(() =>
    import("@/components/calculators/tools/ProfitMarginCalculatorTool").then(
      (m) => m.ProfitMarginCalculatorTool,
    ),
  ),
  "purchase-price-variance-calculator": dynamic(() =>
    import("@/components/calculators/tools/PurchasePriceVarianceCalculatorTool").then(
      (m) => m.PurchasePriceVarianceCalculatorTool,
    ),
  ),
  "recipe-costing-calculator": dynamic(() =>
    import("@/components/calculators/tools/RecipeCostingCalculatorTool").then(
      (m) => m.RecipeCostingCalculatorTool,
    ),
  ),
  "roi-calculator": dynamic(() =>
    import("@/components/calculators/tools/RoiCalculatorTool").then(
      (m) => m.RoiCalculatorTool,
    ),
  ),
  "sales-tax-calculator": dynamic(() =>
    import("@/components/calculators/tools/SalesTaxCalculatorTool").then(
      (m) => m.SalesTaxCalculatorTool,
    ),
  ),
  "stock-reorder-point-calculator": dynamic(() =>
    import("@/components/calculators/tools/StockReorderPointCalculatorTool").then(
      (m) => m.StockReorderPointCalculatorTool,
    ),
  ),
  "table-turnover-calculator": dynamic(() =>
    import("@/components/calculators/tools/TableTurnoverCalculatorTool").then(
      (m) => m.TableTurnoverCalculatorTool,
    ),
  ),
  "take-home-salary-calculator": dynamic(() =>
    import("@/components/calculators/tools/TakeHomeSalaryCalculatorTool").then(
      (m) => m.TakeHomeSalaryCalculatorTool,
    ),
  ),
  "tip-split-calculator": dynamic(() =>
    import("@/components/calculators/tools/TipSplitCalculatorTool").then(
      (m) => m.TipSplitCalculatorTool,
    ),
  ),
  "vat-calculator": dynamic(() =>
    import("@/components/calculators/tools/VatCalculatorTool").then(
      (m) => m.VatCalculatorTool,
    ),
  ),
};
