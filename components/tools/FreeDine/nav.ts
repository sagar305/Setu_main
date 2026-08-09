export type ScreenId =
  | "floor"
  | "menu"
  | "tables"
  | "stock"
  | "bills"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId, query?: string) => void;
