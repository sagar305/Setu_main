export type ScreenId =
  | "sell"
  | "medicines"
  | "purchases"
  | "expiry"
  | "returns"
  | "customers"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId) => void;
