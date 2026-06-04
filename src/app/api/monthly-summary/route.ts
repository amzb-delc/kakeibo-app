import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getHouseholdId } from "@/lib/auth";
import { jstMonthRange, formatJstDate } from "@/lib/date";
import { calculateBoxStats } from "@/lib/anomaly";

function shiftMonth(year: number, month: number, delta: number) {
  let y = year;
  let m = month + delta;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

function ymKey(year: number, month: number) {
  return `${year}-${String(month).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const householdId = await getHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const { searchParams } = new URL(req.url);
  // 当月判定はサーバTZに依存せずJSTで行う
  const [todayYearStr, todayMonthStr] = formatJstDate(new Date()).split("-");
  const currentYear = Number(todayYearStr);
  const currentMonth = Number(todayMonthStr);
  const year = Number(searchParams.get("year") ?? currentYear);
  const month = Number(searchParams.get("month") ?? currentMonth);

  const isCurrentMonth = year === currentYear && month === currentMonth;

  const range = jstMonthRange(year, month);
  // 当月閲覧時は比較しない。過去月閲覧時は「今月」を比較対象とする。
  const compareRange = isCurrentMonth ? null : jstMonthRange(currentYear, currentMonth);

  // 偏差値用に「表示月含む過去6ヶ月」の範囲を作る
  const sixMonthsAgo = shiftMonth(year, month, -5);
  const sixMonthRange = {
    gte: jstMonthRange(sixMonthsAgo.year, sixMonthsAgo.month).gte,
    lt: range.lt,
  };
  const sixMonthKeys: string[] = [];
  for (let i = 5; i >= 0; i--) {
    const { year: y, month: m } = shiftMonth(year, month, -i);
    sixMonthKeys.push(ymKey(y, m));
  }

  // 表示月の支出をカテゴリ別に集計（明細は日付降順で並べる）
  const expenses = await prisma.expense.findMany({
    where: {
      householdId,
      spentAt: range,
    },
    include: {
      category: { select: { id: true, name: true, sortOrder: true } },
    },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
  });

  // 比較対象（今月）の支出を集計
  const compareExpenses = compareRange
    ? await prisma.expense.findMany({
        where: {
          householdId,
          spentAt: compareRange,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      })
    : [];

  // 偏差値算出用に過去6ヶ月の支出を取得（amount/categoryId/spentAtのみ）
  const sixMonthExpenses = await prisma.expense.findMany({
    where: {
      householdId,
      spentAt: sixMonthRange,
    },
    select: { amount: true, spentAt: true, categoryId: true },
  });

  // カテゴリ別集計
  type CategoryExpense = {
    id: string;
    amount: number;
    spentAt: Date;
    storeName: string | null;
    memo: string | null;
  };
  const categoryMap = new Map<
    string,
    { name: string; sortOrder: number; total: number; expenses: CategoryExpense[] }
  >();
  for (const expense of expenses) {
    const key = expense.categoryId;
    const item: CategoryExpense = {
      id: expense.id,
      amount: expense.amount,
      spentAt: expense.spentAt,
      storeName: expense.storeName,
      memo: expense.memo,
    };
    const existing = categoryMap.get(key);
    if (existing) {
      existing.total += expense.amount;
      existing.expenses.push(item);
    } else {
      categoryMap.set(key, {
        name: expense.category.name,
        sortOrder: expense.category.sortOrder,
        total: expense.amount,
        expenses: [item],
      });
    }
  }

  const compareCategoryMap = new Map<string, number>();
  for (const expense of compareExpenses) {
    compareCategoryMap.set(
      expense.categoryId,
      (compareCategoryMap.get(expense.categoryId) ?? 0) + expense.amount
    );
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const compareTotal = compareRange
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
        compareTotal: compareRange ? compareCategoryMap.get(categoryId) ?? 0 : null,
        boxStats: calculateBoxStats(categorySamples),
        expenses: categoryExpenses,
      };
    })
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return NextResponse.json({
    year,
    month,
    total,
    compareTotal,
    boxStats,
    categories,
  });
}
