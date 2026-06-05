import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { jstMonthRange, formatJstDate, shiftMonth, ymKey } from "@/lib/date";
import { requireHouseholdId } from "@/lib/api";
import { buildMonthlySummary } from "@/lib/monthly-summary";

export async function GET(req: NextRequest) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;
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

  // 集計は純粋関数に委譲（テスト可能にするため）。
  const summary = buildMonthlySummary({
    year,
    month,
    expenses,
    compareExpenses,
    sixMonthExpenses,
    sixMonthKeys,
    hasCompare: compareRange !== null,
  });

  return NextResponse.json(summary);
}
