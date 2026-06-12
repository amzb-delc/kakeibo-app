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
    tags: [],
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
      chartKeys: SIX_KEYS,
      allCategories: [],
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
      chartKeys: SIX_KEYS,
      allCategories: [],
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
      chartKeys: SIX_KEYS,
      allCategories: [],
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
      chartKeys: SIX_KEYS,
      allCategories: [],
      hasCompare: false,
    });
    expect(r.boxStats).toBeNull();
  });

  it("明細アイテムに tags をそのままパススルーする", () => {
    const e = exp({ id: "e1", amount: 1000, categoryId: "food", name: "食費", sortOrder: 0 });
    e.tags = ["spouse:2", "card:楽天カード"];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [e],
      compareExpenses: [],
      sixMonthExpenses: [],
      sixMonthKeys: SIX_KEYS,
      chartKeys: SIX_KEYS,
      allCategories: [],
      hasCompare: false,
    });
    expect(r.categories[0].expenses[0].tags).toEqual(["spouse:2", "card:楽天カード"]);
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
      chartKeys: SIX_KEYS,
      allCategories: [],
      hasCompare: false,
    });
    expect(r.boxStats).not.toBeNull();
    expect(r.boxStats?.median).toBe(25000);
  });
});

// 6ヶ月比較グラフ用の sixMonths 集計
const ALL_CATS = [
  { id: "food", name: "食費", sortOrder: 0 },
  { id: "daily", name: "日用品", sortOrder: 1 },
  { id: "fun", name: "娯楽", sortOrder: 3 },
];

describe("buildMonthlySummary sixMonths（6ヶ月比較グラフ）", () => {
  it("sixMonthKeys の順で 6 本固定。データのない月は total=0・byCategory=[]", () => {
    // 2 つの月だけにデータを置く（残り 4 ヶ月は空棒になるはず）
    const six: SixMonthExpense[] = [
      { amount: 5000, categoryId: "food", spentAt: d("2026-01-10") },
      { amount: 8000, categoryId: "food", spentAt: d("2026-04-10") },
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [],
      compareExpenses: [],
      sixMonthExpenses: six,
      sixMonthKeys: SIX_KEYS,
      chartKeys: SIX_KEYS,
      allCategories: ALL_CATS,
      hasCompare: false,
    });
    // 6 本固定・キー順（古い月→表示月）を保持
    expect(r.sixMonths).toHaveLength(6);
    expect(r.sixMonths.map((m) => m.ym)).toEqual(SIX_KEYS);
    // データのない月は 0 / 空配列
    const byYm = Object.fromEntries(r.sixMonths.map((m) => [m.ym, m]));
    expect(byYm["2025-11"]).toEqual({ ym: "2025-11", total: 0, byCategory: [] });
    expect(byYm["2025-12"]).toEqual({ ym: "2025-12", total: 0, byCategory: [] });
    expect(byYm["2026-02"]).toEqual({ ym: "2026-02", total: 0, byCategory: [] });
    expect(byYm["2026-03"]).toEqual({ ym: "2026-03", total: 0, byCategory: [] });
    // データのある月は合計が入る
    expect(byYm["2026-01"].total).toBe(5000);
    expect(byYm["2026-04"].total).toBe(8000);
  });

  it("byCategory は sortOrder 昇順で、name/sortOrder は allCategories から解決される", () => {
    // 1 月に sortOrder の異なる 3 カテゴリを混在させる（投入順は sortOrder と逆）
    const six: SixMonthExpense[] = [
      { amount: 300, categoryId: "fun", spentAt: d("2026-04-10") }, // sortOrder 3
      { amount: 200, categoryId: "daily", spentAt: d("2026-04-11") }, // sortOrder 1
      { amount: 100, categoryId: "food", spentAt: d("2026-04-12") }, // sortOrder 0
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [],
      compareExpenses: [],
      sixMonthExpenses: six,
      sixMonthKeys: SIX_KEYS,
      chartKeys: SIX_KEYS,
      allCategories: ALL_CATS,
      hasCompare: false,
    });
    const apr = r.sixMonths.find((m) => m.ym === "2026-04")!;
    expect(apr.total).toBe(600);
    // sortOrder 昇順に並ぶ（food=0, daily=1, fun=3）
    expect(apr.byCategory.map((c) => c.categoryId)).toEqual(["food", "daily", "fun"]);
    // name / sortOrder は allCategories から解決される
    expect(apr.byCategory).toEqual([
      { categoryId: "food", name: "食費", sortOrder: 0, total: 100 },
      { categoryId: "daily", name: "日用品", sortOrder: 1, total: 200 },
      { categoryId: "fun", name: "娯楽", sortOrder: 3, total: 300 },
    ]);
  });

  it("同一カテゴリの複数支出は月内で合算される", () => {
    const six: SixMonthExpense[] = [
      { amount: 100, categoryId: "food", spentAt: d("2026-03-01") },
      { amount: 250, categoryId: "food", spentAt: d("2026-03-20") },
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [],
      compareExpenses: [],
      sixMonthExpenses: six,
      sixMonthKeys: SIX_KEYS,
      chartKeys: SIX_KEYS,
      allCategories: ALL_CATS,
      hasCompare: false,
    });
    const mar = r.sixMonths.find((m) => m.ym === "2026-03")!;
    expect(mar.total).toBe(350);
    expect(mar.byCategory).toEqual([
      { categoryId: "food", name: "食費", sortOrder: 0, total: 350 },
    ]);
  });

  it("allCategories に無い categoryId は name='' / sortOrder=0 にフォールバックする", () => {
    const six: SixMonthExpense[] = [
      { amount: 500, categoryId: "ghost", spentAt: d("2026-02-10") },
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [],
      compareExpenses: [],
      sixMonthExpenses: six,
      sixMonthKeys: SIX_KEYS,
      chartKeys: SIX_KEYS,
      allCategories: ALL_CATS,
      hasCompare: false,
    });
    const feb = r.sixMonths.find((m) => m.ym === "2026-02")!;
    expect(feb.byCategory).toEqual([
      { categoryId: "ghost", name: "", sortOrder: 0, total: 500 },
    ]);
  });

  it("月跨ぎの支出が JST 月キーで正しく振り分けられる（月境界）", () => {
    // JST 2026-02-01 00:00 は UTC 2026-01-31 15:00。spentAt は parseJstDate（JST解釈）。
    const six: SixMonthExpense[] = [
      { amount: 111, categoryId: "food", spentAt: d("2026-01-31") }, // 1月末
      { amount: 222, categoryId: "food", spentAt: d("2026-02-01") }, // 2月頭
    ];
    const r = buildMonthlySummary({
      year: 2026,
      month: 4,
      expenses: [],
      compareExpenses: [],
      sixMonthExpenses: six,
      sixMonthKeys: SIX_KEYS,
      chartKeys: SIX_KEYS,
      allCategories: ALL_CATS,
      hasCompare: false,
    });
    const byYm = Object.fromEntries(r.sixMonths.map((m) => [m.ym, m.total]));
    expect(byYm["2026-01"]).toBe(111);
    expect(byYm["2026-02"]).toBe(222);
  });
});
