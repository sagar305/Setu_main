import type { TKey } from "@/lib/i18n/translate";

// Static reference data for the VAT and Sales Tax calculators.
// Standard VAT/GST rates by country and US state sales-tax rates
// (state rate + population-weighted average local rate). Reference values —
// rates change; users can always override with a custom rate.

export type CountryVatRate = {
  /** ISO 3166-1 alpha-2. The name is rendered from this, so the table reads in
   *  the page's language without a hand-maintained translation per country. */
  code: string;
  /** English name, kept as the stable label for anywhere Intl has no data. */
  country: string;
  type: "VAT" | "GST";
  rate: number; // standard rate %
  /** Reduced rates as written, e.g. "5%, 13%" — figures, so no translation. */
  reduced?: string;
  /** Anything that is prose rather than a rate. */
  note?: TKey;
};

export const COUNTRY_VAT_RATES: CountryVatRate[] = [
  { code: "AL", country: "Albania", type: "VAT", rate: 20 },
  { code: "AR", country: "Argentina", type: "VAT", rate: 21, reduced: "10.5%" },
  { code: "AU", country: "Australia", type: "GST", rate: 10 },
  { code: "AT", country: "Austria", type: "VAT", rate: 20, reduced: "10%, 13%" },
  { code: "BH", country: "Bahrain", type: "VAT", rate: 10 },
  { code: "BD", country: "Bangladesh", type: "VAT", rate: 15 },
  { code: "BE", country: "Belgium", type: "VAT", rate: 21, reduced: "6%, 12%" },
  { code: "BR", country: "Brazil", type: "VAT", rate: 17, note: "vatNoteIcms" },
  { code: "BG", country: "Bulgaria", type: "VAT", rate: 20, reduced: "9%" },
  { code: "CA", country: "Canada", type: "GST", rate: 5, note: "vatNoteProvincial" },
  { code: "CL", country: "Chile", type: "VAT", rate: 19 },
  { code: "CN", country: "China", type: "VAT", rate: 13, reduced: "9%, 6%" },
  { code: "CO", country: "Colombia", type: "VAT", rate: 19 },
  { code: "HR", country: "Croatia", type: "VAT", rate: 25, reduced: "5%, 13%" },
  { code: "CY", country: "Cyprus", type: "VAT", rate: 19 },
  { code: "CZ", country: "Czech Republic", type: "VAT", rate: 21, reduced: "12%" },
  { code: "DK", country: "Denmark", type: "VAT", rate: 25 },
  { code: "EG", country: "Egypt", type: "VAT", rate: 14 },
  { code: "EE", country: "Estonia", type: "VAT", rate: 22 },
  { code: "FI", country: "Finland", type: "VAT", rate: 25.5, reduced: "10%, 14%" },
  { code: "FR", country: "France", type: "VAT", rate: 20, reduced: "5.5%, 10%" },
  { code: "DE", country: "Germany", type: "VAT", rate: 19, reduced: "7%" },
  { code: "GR", country: "Greece", type: "VAT", rate: 24, reduced: "6%, 13%" },
  { code: "HU", country: "Hungary", type: "VAT", rate: 27, note: "vatNoteHighest" },
  { code: "IS", country: "Iceland", type: "VAT", rate: 24, reduced: "11%" },
  { code: "IN", country: "India", type: "GST", rate: 18, note: "vatNoteSlabs" },
  { code: "ID", country: "Indonesia", type: "VAT", rate: 11 },
  { code: "IE", country: "Ireland", type: "VAT", rate: 23, reduced: "9%, 13.5%" },
  { code: "IL", country: "Israel", type: "VAT", rate: 18 },
  { code: "IT", country: "Italy", type: "VAT", rate: 22, reduced: "4%, 5%, 10%" },
  { code: "JP", country: "Japan", type: "VAT", rate: 10, reduced: "8%", note: "vatNoteFoodOnly" },
  { code: "KE", country: "Kenya", type: "VAT", rate: 16 },
  { code: "LV", country: "Latvia", type: "VAT", rate: 21 },
  { code: "LT", country: "Lithuania", type: "VAT", rate: 21 },
  { code: "LU", country: "Luxembourg", type: "VAT", rate: 17, note: "vatNoteLowestEu" },
  { code: "MY", country: "Malaysia", type: "VAT", rate: 8, note: "vatNoteSst" },
  { code: "MT", country: "Malta", type: "VAT", rate: 18 },
  { code: "MX", country: "Mexico", type: "VAT", rate: 16 },
  { code: "NL", country: "Netherlands", type: "VAT", rate: 21, reduced: "9%" },
  { code: "NZ", country: "New Zealand", type: "GST", rate: 15 },
  { code: "NG", country: "Nigeria", type: "VAT", rate: 7.5 },
  { code: "NO", country: "Norway", type: "VAT", rate: 25, reduced: "12%, 15%" },
  { code: "PK", country: "Pakistan", type: "VAT", rate: 18 },
  { code: "PH", country: "Philippines", type: "VAT", rate: 12 },
  { code: "PL", country: "Poland", type: "VAT", rate: 23, reduced: "5%, 8%" },
  { code: "PT", country: "Portugal", type: "VAT", rate: 23, reduced: "6%, 13%" },
  { code: "RO", country: "Romania", type: "VAT", rate: 19, reduced: "5%, 9%" },
  { code: "SA", country: "Saudi Arabia", type: "VAT", rate: 15 },
  { code: "SG", country: "Singapore", type: "GST", rate: 9, note: "vatNoteRaised2024" },
  { code: "SK", country: "Slovakia", type: "VAT", rate: 23 },
  { code: "SI", country: "Slovenia", type: "VAT", rate: 22 },
  { code: "ZA", country: "South Africa", type: "VAT", rate: 15 },
  { code: "KR", country: "South Korea", type: "VAT", rate: 10 },
  { code: "ES", country: "Spain", type: "VAT", rate: 21, reduced: "4%, 10%" },
  { code: "LK", country: "Sri Lanka", type: "VAT", rate: 18 },
  { code: "SE", country: "Sweden", type: "VAT", rate: 25, reduced: "6%, 12%" },
  { code: "CH", country: "Switzerland", type: "VAT", rate: 8.1, reduced: "2.6%, 3.8%" },
  { code: "TW", country: "Taiwan", type: "VAT", rate: 5 },
  { code: "TH", country: "Thailand", type: "VAT", rate: 7 },
  { code: "TR", country: "Turkey", type: "VAT", rate: 20, reduced: "1%, 10%" },
  { code: "AE", country: "UAE", type: "VAT", rate: 5 },
  { code: "GB", country: "United Kingdom", type: "VAT", rate: 20, reduced: "5%", note: "vatNoteZeroRatedFoodBooks" },
  { code: "VN", country: "Vietnam", type: "VAT", rate: 10, note: "vatNoteTemporary8" },
];

export type StateTaxRate = {
  state: string;
  code: string;
  stateRate: number; // %
  avgLocalRate: number; // population-weighted average local %
};

// State + average local rates (Tax Foundation 2024–2025 data). Five states
// have no state-wide sales tax (AK/DE/MT/NH/OR — the "NOMAD" states), though
// some Alaska localities levy their own.
export const US_STATE_TAX_RATES: StateTaxRate[] = [
  { state: "Alabama", code: "AL", stateRate: 4, avgLocalRate: 5.29 },
  { state: "Alaska", code: "AK", stateRate: 0, avgLocalRate: 1.82 },
  { state: "Arizona", code: "AZ", stateRate: 5.6, avgLocalRate: 2.8 },
  { state: "Arkansas", code: "AR", stateRate: 6.5, avgLocalRate: 2.95 },
  { state: "California", code: "CA", stateRate: 7.25, avgLocalRate: 1.6 },
  { state: "Colorado", code: "CO", stateRate: 2.9, avgLocalRate: 4.91 },
  { state: "Connecticut", code: "CT", stateRate: 6.35, avgLocalRate: 0 },
  { state: "Delaware", code: "DE", stateRate: 0, avgLocalRate: 0 },
  { state: "Florida", code: "FL", stateRate: 6, avgLocalRate: 1 },
  { state: "Georgia", code: "GA", stateRate: 4, avgLocalRate: 3.39 },
  { state: "Hawaii", code: "HI", stateRate: 4, avgLocalRate: 0.5 },
  { state: "Idaho", code: "ID", stateRate: 6, avgLocalRate: 0.03 },
  { state: "Illinois", code: "IL", stateRate: 6.25, avgLocalRate: 2.61 },
  { state: "Indiana", code: "IN", stateRate: 7, avgLocalRate: 0 },
  { state: "Iowa", code: "IA", stateRate: 6, avgLocalRate: 0.94 },
  { state: "Kansas", code: "KS", stateRate: 6.5, avgLocalRate: 2.25 },
  { state: "Kentucky", code: "KY", stateRate: 6, avgLocalRate: 0 },
  { state: "Louisiana", code: "LA", stateRate: 5, avgLocalRate: 5.11 },
  { state: "Maine", code: "ME", stateRate: 5.5, avgLocalRate: 0 },
  { state: "Maryland", code: "MD", stateRate: 6, avgLocalRate: 0 },
  { state: "Massachusetts", code: "MA", stateRate: 6.25, avgLocalRate: 0 },
  { state: "Michigan", code: "MI", stateRate: 6, avgLocalRate: 0 },
  { state: "Minnesota", code: "MN", stateRate: 6.875, avgLocalRate: 1.17 },
  { state: "Mississippi", code: "MS", stateRate: 7, avgLocalRate: 0.06 },
  { state: "Missouri", code: "MO", stateRate: 4.225, avgLocalRate: 4.16 },
  { state: "Montana", code: "MT", stateRate: 0, avgLocalRate: 0 },
  { state: "Nebraska", code: "NE", stateRate: 5.5, avgLocalRate: 1.47 },
  { state: "Nevada", code: "NV", stateRate: 6.85, avgLocalRate: 1.39 },
  { state: "New Hampshire", code: "NH", stateRate: 0, avgLocalRate: 0 },
  { state: "New Jersey", code: "NJ", stateRate: 6.625, avgLocalRate: 0 },
  { state: "New Mexico", code: "NM", stateRate: 4.875, avgLocalRate: 2.73 },
  { state: "New York", code: "NY", stateRate: 4, avgLocalRate: 4.53 },
  { state: "North Carolina", code: "NC", stateRate: 4.75, avgLocalRate: 2.25 },
  { state: "North Dakota", code: "ND", stateRate: 5, avgLocalRate: 2.05 },
  { state: "Ohio", code: "OH", stateRate: 5.75, avgLocalRate: 1.49 },
  { state: "Oklahoma", code: "OK", stateRate: 4.5, avgLocalRate: 4.49 },
  { state: "Oregon", code: "OR", stateRate: 0, avgLocalRate: 0 },
  { state: "Pennsylvania", code: "PA", stateRate: 6, avgLocalRate: 0.34 },
  { state: "Rhode Island", code: "RI", stateRate: 7, avgLocalRate: 0 },
  { state: "South Carolina", code: "SC", stateRate: 6, avgLocalRate: 1.5 },
  { state: "South Dakota", code: "SD", stateRate: 4.2, avgLocalRate: 1.91 },
  { state: "Tennessee", code: "TN", stateRate: 7, avgLocalRate: 2.55 },
  { state: "Texas", code: "TX", stateRate: 6.25, avgLocalRate: 1.95 },
  { state: "Utah", code: "UT", stateRate: 6.1, avgLocalRate: 1.15 },
  { state: "Vermont", code: "VT", stateRate: 6, avgLocalRate: 0.36 },
  { state: "Virginia", code: "VA", stateRate: 5.3, avgLocalRate: 0.47 },
  { state: "Washington", code: "WA", stateRate: 6.5, avgLocalRate: 2.88 },
  { state: "Washington DC", code: "DC", stateRate: 6, avgLocalRate: 0 },
  { state: "West Virginia", code: "WV", stateRate: 6, avgLocalRate: 0.57 },
  { state: "Wisconsin", code: "WI", stateRate: 5, avgLocalRate: 0.7 },
  { state: "Wyoming", code: "WY", stateRate: 4, avgLocalRate: 1.44 },
];
