export type ScreenId = "floor" | "menu" | "tables" | "bills" | "reports" | "settings";

export type NavigateFn = (screen: ScreenId, query?: string) => void;
