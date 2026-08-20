export type ScreenId = "counter" | "issue" | "history" | "reports" | "settings";

export type NavigateFn = (screen: ScreenId) => void;
