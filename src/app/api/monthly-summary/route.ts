import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { jstMonthRange } from "@/lib/date";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const now = new Date();
  const year = Number(searchParams.get("year") ?? now.getFullYear());
  const month = Number(searchParams.get("month") ?? now.getMonth() + 1);

  const range = jstMonthRange(year, month);
  const prevRange = jstMonthRange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);

  // 当月の支出をカテゴリ別に集計（明細は日付降順で並べる）
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

  // 前月の支出を集計（トレンド計算用）
  const prevExpenses = await prisma.expense.findMany({
    where: {
      householdId: DEMO_HOUSEHOLD_ID,
      spentAt: prevRange,
    },
    include: {
      category: { select: { id: true, name: true } },
    },
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

  const prevCategoryMap = new Map<string, number>();
  for (const expense of prevExpenses) {
    prevCategoryMap.set(
      expense.categoryId,
      (prevCategoryMap.get(expense.categoryId) ?? 0) + expense.amount
    );
  }

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);
  const prevTotal = prevExpenses.reduce((sum, e) => sum + e.amount, 0);

  const categories = Array.from(categoryMap.entries())
    .map(([categoryId, { name, sortOrder, total: categoryTotal, expenses: categoryExpenses }]) => ({
      categoryId,
      name,
      sortOrder,
      total: categoryTotal,
      prevTotal: prevCategoryMap.get(categoryId) ?? 0,
      expenses: categoryExpenses,
    }))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  return NextResponse.json({
    year,
    month,
    total,
    prevTotal,
    categories,
  });
}
