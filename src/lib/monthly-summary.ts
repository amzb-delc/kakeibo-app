import { formatJstDate } from "@/lib/date";
import { calculateBoxStats } from "@/lib/anomaly";
import type { BoxStats } from "@/types";

// 月次サマリーの集計（純粋関数）。DB アクセスは route 側で行い、ここはデータ整形に専念する。
// （唯一テスト不能だった集計ロジックをユニットテスト可能にするための切り出し）

// 表示月の支出（カテゴリ情報を含む）
export type SummaryExpense = {
  id: string;
  amount: number;
  spentAt: Date;
  updatedAt: Date;
  storeName: string | null;
  memo: string | null;
  tags: string[];
  categoryId: string;
  category: { name: string; sortOrder: number };
};
// 比較対象（今月）の支出
export type CompareExpense = { categoryId: string; amount: number };
// 偏差値用の過去6ヶ月の支出
export type SixMonthExpense = { amount: number; spentAt: Date; categoryId: string };

export type SummaryCategoryExpense = {
  id: string;
  amount: number;
  spentAt: Date; // route の NextResponse.json で ISO 文字列にシリアライズされる
  updatedAt: Date;
  storeName: string | null;
  memo: string | null;
  tags: string[]; // 内部タグ（src/lib/tags.ts）。識別ドット表示に使う
};

// 6ヶ月比較グラフ用の月別集計（古い月 → 表示月の順・6本固定）
export type SixMonthSummary = {
  ym: string; // "YYYY-MM"
  total: number; // データのない月は 0（空棒として描画する）
  byCategory: Array<{
    categoryId: string;
    name: string;
    sortOrder: number; // categoryColor() の色解決に使う
    total: number;
  }>;
};

export type MonthlySummaryResult = {
  year: number;
  month: number;
  total: number;
  compareTotal: number | null;
  boxStats: BoxStats | null;
  categories: Array<{
    categoryId: string;
    name: string;
    sortOrder: number;
    total: number;
    compareTotal: number | null;
    boxStats: BoxStats | null;
    expenses: SummaryCategoryExpense[];
  }>;
  sixMonths: SixMonthSummary[];
};

export function buildMonthlySummary(params: {
  year: number;
  month: number;
  expenses: SummaryExpense[]; // 表示月（spentAt 降順で渡す前提。並びは保持する）
  compareExpenses: CompareExpense[];
  sixMonthExpenses: SixMonthExpense[];
  sixMonthKeys: string[]; // 表示月含む過去6ヶ月の "YYYY-MM"
  allCategories: Array<{ id: string; name: string; sortOrder: number }>; // 世帯の全カテゴリ（16枠）
  hasCompare: boolean; // 過去月閲覧時のみ true（当月は比較しない）
}): MonthlySummaryResult {
  const {
    year,
    month,
    expenses,
    compareExpenses,
    sixMonthExpenses,
    sixMonthKeys,
    allCategories,
    hasCompare,
  } = params;

  // 表示月をカテゴリ別に集計（明細の並びは渡された順を保持）
  const categoryMap = new Map<
    string,
    { name: string; sortOrder: number; total: number; expenses: SummaryCategoryExpense[] }
  >();
  for (const expense of expenses) {
    const item: SummaryCategoryExpense = {
      id: expense.id,
      amount: expense.amount,
      spentAt: expense.spentAt,
      updatedAt: expense.updatedAt,
      storeName: expense.storeName,
      memo: expense.memo,
      tags: expense.tags,
    };
    const existing = categoryMap.get(expense.categoryId);
    if (existing) {
      existing.total += expense.amount;
      existing.expenses.push(item);
    } else {
      categoryMap.set(expense.categoryId, {
        name: expense.category.name,
        sortOrder: expense.category.sortOrder,
        total: expense.amount,
        expenses: [item],
      });
    }
  }

  // 比較対象（今月）のカテゴリ別合計
  const compareCategoryMap = new Map<string, number>();
  for (const expense of compareExpenses) {
    compareCategoryMap.set(
      expense.categoryId,
      (compareCategoryMap.get(expense.categoryId) ?? 0) + expense.amount
    );
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const compareTotal = hasCompare
    ? compareExpenses.reduce((sum, e) => sum + e.amount, 0)
    : null;

  // 過去6ヶ月の月別合計 / 月別カテゴリ合計を JST 月キーで集計
  const monthlyTotals = new Map<string, number>();
  const monthlyCategoryTotals = new Map<string, Map<string, number>>();
  for (const e of sixMonthExpenses) {
    const ym = formatJstDate(e.spentAt).slice(0, 7);
    monthlyTotals.set(ym, (monthlyTotals.get(ym) ?? 0) + e.amount);
    let inner = monthlyCategoryTotals.get(ym);
    if (!inner) {
      inner = new Map();
      monthlyCategoryTotals.set(ym, inner);
    }
    inner.set(e.categoryId, (inner.get(e.categoryId) ?? 0) + e.amount);
  }
  // 「データのある月」のみサンプルに使う（家計簿開始前の月をゼロ埋めしない）
  const availableMonths = sixMonthKeys.filter((k) => monthlyTotals.has(k));
  const totalSamples = availableMonths.map((k) => monthlyTotals.get(k)!);
  const boxStats = calculateBoxStats(totalSamples);

  const categories = Array.from(categoryMap.entries())
    .map(([categoryId, { name, sortOrder, total: categoryTotal, expenses: categoryExpenses }]) => {
      // カテゴリの異常値は「そのカテゴリの支出があった月」のみをサンプルに採る。
      // 0埋めすると、たまにしか使わないカテゴリで IQR=0 になり判定不能になるため。
      const categorySamples = availableMonths
        .map((k) => monthlyCategoryTotals.get(k)?.get(categoryId))
        .filter((v): v is number => typeof v === "number" && v > 0);
      return {
        categoryId,
        name,
        sortOrder,
        total: categoryTotal,
        compareTotal: hasCompare ? compareCategoryMap.get(categoryId) ?? 0 : null,
        boxStats: calculateBoxStats(categorySamples),
        expenses: categoryExpenses,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 6ヶ月比較グラフ用に月別の積み上げデータを整形（sixMonthKeys は古い月→表示月の順）。
  // データのない月も total=0 で 6 本固定にする（棒の本数・位置を安定させる）。
  const categoryMeta = new Map(allCategories.map((c) => [c.id, c]));
  const sixMonths: SixMonthSummary[] = sixMonthKeys.map((ym) => {
    const inner = monthlyCategoryTotals.get(ym);
    const byCategory = inner
      ? Array.from(inner.entries())
          .map(([categoryId, categoryTotal]) => {
            const meta = categoryMeta.get(categoryId);
            return {
              categoryId,
              name: meta?.name ?? "",
              sortOrder: meta?.sortOrder ?? 0,
              total: categoryTotal,
            };
          })
          .sort((a, b) => a.sortOrder - b.sortOrder)
      : [];
    return { ym, total: monthlyTotals.get(ym) ?? 0, byCategory };
  });

  return { year, month, total, compareTotal, boxStats, categories, sixMonths };
}
