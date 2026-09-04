export type ScreenId =
  | "jobs"
  | "intake"
  | "customers"
  | "parts"
  | "billing"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId) => void;
