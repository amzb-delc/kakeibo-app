import type { CategoryExpense } from "@/types";

// 明細の並び替え（純粋関数）。
// - spentAt / updatedAt は ISO 文字列なので辞書順比較がそのまま時系列順になる。
// - amount は数値比較。
export type SortField = "spentAt" | "updatedAt" | "amount"; // 発生日 / 更新日 / 金額
export type SortDir = "asc" | "desc"; // 昇順（小/古い→大/新しい） / 降順

export function sortExpenses<
  T extends Pick<CategoryExpense, "spentAt" | "updatedAt" | "amount">,
>(expenses: T[], field: SortField, dir: SortDir): T[] {
  const sign = dir === "asc" ? 1 : -1;
  // Array.prototype.sort は安定なので、同値は元の並びを保持する。
  return [...expenses].sort((a, b) => {
    const av = a[field];
    const bv = b[field];
    let cmp: number;
    if (typeof av === "number" && typeof bv === "number") {
      cmp = av - bv; // 金額
    } else {
      const as = String(av);
      const bs = String(bv);
      cmp = as < bs ? -1 : as > bs ? 1 : 0; // 日付（ISO 文字列）
    }
    return cmp * sign;
  });
}
