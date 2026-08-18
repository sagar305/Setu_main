export type ScreenId =
  | "floor"
  | "menu"
  | "tables"
  | "stock"
  | "bookings"
  | "bills"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId, query?: string) => void;
