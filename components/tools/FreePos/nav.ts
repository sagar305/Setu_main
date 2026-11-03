export type ScreenId =
  | "dashboard"
  | "sell"
  | "products"
  | "orders"
  | "customers"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId, query?: string) => void;
