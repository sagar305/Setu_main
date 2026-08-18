export type ScreenId =
  | "today"
  | "students"
  | "attendance"
  | "fees"
  | "tests"
  | "diary"
  | "enquiries"
  | "reports"
  | "settings";

export type NavigateFn = (screen: ScreenId, query?: string) => void;
