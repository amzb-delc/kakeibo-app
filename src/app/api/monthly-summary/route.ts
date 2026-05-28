import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { jstMonthRange, formatJstDate } from "@/lib/date";

export async function GET(req: NextRequest) {
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

  // 表示月の支出をカテゴリ別に集計（明細は日付降順で並べる）
  const expenses = await prisma.expense.findMany({
    where: {
      householdId: DEMO_HOUSEHOLD_ID,
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
          householdId: DEMO_HOUSEHOLD_ID,
          spentAt: compareRange,
        },
        include: {
          category: { select: { id: true, name: true } },
        },
      })
    : [];

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

  const categories = Array.from(categoryMap.entries())
    .map(([categoryId, { name, sortOrder, total: categoryTotal, expenses: categoryExpenses }]) => ({
      categoryId,
      name,
      sortOrder,
      total: categoryTotal,
      compareTotal: compareRange ? compareCategoryMap.get(categoryId) ?? 0 : null,
      expenses: categoryExpenses,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return NextResponse.json({
    year,
    month,
    total,
    compareTotal,
    categories,
  });
}
