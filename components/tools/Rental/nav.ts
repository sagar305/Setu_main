export type ScreenId =
  | "today"
  | "availability"
  | "bookings"
  | "items"
  | "customers"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId) => void;
