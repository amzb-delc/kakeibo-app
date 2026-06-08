import { describe, it, expect } from "vitest";
import {
  buildMonthlySummary,
  type SummaryExpense,
  type SixMonthExpense,
} from "./monthly-summary";
import { parseJstDate } from "./date";

const d = (s: string) => parseJstDate(s) as Date;

// 表示月含む過去6ヶ月（2026-04 視点）
const SIX_KEYS = [
  "2025-11",
  "2025-12",
  "2026-01",
  "2026-02",
  "2026-03",
  "2026-04",
];

function exp(p: {
  id: string;
  amount: number;
  categoryId: string;
  name: string;
  sortOrder: number;
  spentAt?: Date;
  updatedAt?: Date;
}): SummaryExpense {
  const spentAt = p.spentAt ?? d("2026-04-15");
  return {
    id: p.id,
    amount: p.amount,
    spentAt,
    updatedAt: p.updatedAt ?? spentAt,
    storeName: null,
    memo: null,
    categoryId: p.categoryId,
    category: { name: p.name, sortOrder: p.sortOrder },
  };
}

describe("buildMonthlySummary", () => {
  it("カテゴリ別に合計・明細をまとめ、sortOrder 昇順で返す。明細は渡した順を保持", () => {
    const expenses = [
      exp({ id: "e1", amount: 1000, categoryId: "food", name: "食費", sortOrder: 0, spentAt: d("2026-04-20") }),
      exp({ id: "e2", amount: 500, categoryId: "food", name: "食費", sortOrder: 0, spentAt: d("2026-04-10") }),
      exp({ id: "e3", amount: 2000, categoryId: "fun", name: "娯楽", sortOrder: 3 }),
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses,
      compareExpenses: [],
      sixMonthExpenses: [],
      sixMonthKeys: SIX_KEYS,
      hasCompare: false,
    });
    expect(r.total).toBe(3500);
    expect(r.categories.map((c) => c.categoryId)).toEqual(["food", "fun"]);
    const food = r.categories[0];
    expect(food.total).toBe(1500);
    expect(food.expenses.map((e) => e.id)).toEqual(["e1", "e2"]);
    expect(r.compareTotal).toBeNull();
    expect(food.compareTotal).toBeNull();
  });

  it("hasCompare=true で今月との比較合計を計算する", () => {
    const expenses = [exp({ id: "e1", amount: 1000, categoryId: "food", name: "食費", sortOrder: 0 })];
    const compareExpenses = [
      { categoryId: "food", amount: 1500 },
      { categoryId: "other", amount: 800 },
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses,
      compareExpenses,
      sixMonthExpenses: [],
      sixMonthKeys: SIX_KEYS,
      hasCompare: true,
    });
    expect(r.compareTotal).toBe(2300);
    expect(r.categories[0].compareTotal).toBe(1500);
  });

  it("比較対象に無いカテゴリの compareTotal は 0（hasCompare 時）", () => {
    const expenses = [exp({ id: "e1", amount: 1000, categoryId: "food", name: "食費", sortOrder: 0 })];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses,
      compareExpenses: [],
      sixMonthExpenses: [],
      sixMonthKeys: SIX_KEYS,
      hasCompare: true,
    });
    expect(r.categories[0].compareTotal).toBe(0);
  });

  it("boxStats: データのある月が2未満なら null", () => {
    const six: SixMonthExpense[] = [
      { amount: 10000, categoryId: "food", spentAt: d("2026-04-10") },
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [],
      compareExpenses: [],
      sixMonthExpenses: six,
      sixMonthKeys: SIX_KEYS,
      hasCompare: false,
    });
    expect(r.boxStats).toBeNull();
  });

  it("boxStats: 月別合計に散らばりがあれば算出される", () => {
    const six: SixMonthExpense[] = [
      { amount: 10000, categoryId: "food", spentAt: d("2026-01-10") },
      { amount: 20000, categoryId: "food", spentAt: d("2026-02-10") },
      { amount: 30000, categoryId: "food", spentAt: d("2026-03-10") },
      { amount: 40000, categoryId: "food", spentAt: d("2026-04-10") },
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [],
      compareExpenses: [],
      sixMonthExpenses: six,
      sixMonthKeys: SIX_KEYS,
      hasCompare: false,
    });
    expect(r.boxStats).not.toBeNull();
    expect(r.boxStats?.median).toBe(25000);
  });
});
