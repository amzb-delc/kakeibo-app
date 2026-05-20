export type TrendLevel = "up2" | "up1" | "flat" | "down";

export function getTrendLevel(current: number, prev: number): TrendLevel {
  if (prev === 0) return current > 0 ? "up2" : "flat";
  const ratio = (current - prev) / prev;
  if (ratio >= 0.2) return "up2";
  if (ratio >= 0.05) return "up1";
  if (ratio <= -0.05) return "down";
  return "flat";
}

export const TREND_ICON: Record<TrendLevel, string> = {
  up2: "↑↑",
  up1: "↑",
  flat: "→",
  down: "↓",
};

export const TREND_TEXT_COLOR: Record<TrendLevel, string> = {
  up2: "text-red-600",
  up1: "text-orange-500",
  flat: "text-gray-400",
  down: "text-emerald-600",
};

export const TREND_BG_COLOR: Record<TrendLevel, string> = {
  up2: "bg-red-50",
  up1: "bg-orange-50",
  flat: "bg-gray-50",
  down: "bg-emerald-50",
};
