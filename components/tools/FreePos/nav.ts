export type ScreenId =
  | "dashboard"
  | "sell"
  | "products"
  | "orders"
  | "customers"
  | "reports"
  | "settings"
  /** A connected tool's tab: "tool:<slug>" (see ToolsScreen). */
  | `tool:${string}`;

export type NavigateFn = (screen: ScreenId, query?: string) => void;
