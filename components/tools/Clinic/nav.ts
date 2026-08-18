export type ScreenId =
  | "today"
  | "patients"
  | "appointments"
  | "consult"
  | "billing"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId, query?: string) => void;
