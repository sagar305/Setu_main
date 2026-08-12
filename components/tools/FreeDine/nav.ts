export type ScreenId =
  | "floor"
  | "menu"
  | "tables"
  | "stock"
  | "bookings"
  | "khata"
  | "bills"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId, query?: string) => void;
