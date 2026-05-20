import Link from "next/link";
import { Button } from "@/components/ui/button";
import { prisma } from "@/lib/prisma";
import { getTrendLevel, TREND_ICON, TREND_TEXT_COLOR, TREND_BG_COLOR } from "@/lib/trend";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { jstMonthRange } from "@/lib/date";

async function getHomeSummary() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  const range = jstMonthRange(year, month);
  const prevRange = jstMonthRange(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);

  const [expenses, prevExpenses] = await Promise.all([
    prisma.expense.aggregate({
      where: { householdId: DEMO_HOUSEHOLD_ID, spentAt: range },
      _sum: { amount: true },
    }),
    prisma.expense.aggregate({
      where: { householdId: DEMO_HOUSEHOLD_ID, spentAt: prevRange },
      _sum: { amount: true },
    }),
  ]);

  const total = expenses._sum.amount ?? 0;
  const prevTotal = prevExpenses._sum.amount ?? 0;

  return { total, prevTotal, month };
}

export default async function Home() {
  const { total, prevTotal, month } = await getHomeSummary();
  const trend = getTrendLevel(total, prevTotal);
  const diffPercent = prevTotal > 0
    ? Math.round(((total - prevTotal) / prevTotal) * 100)
    : null;

  return (
    <div className="min-h-screen flex flex-col px-4 py-6">
      <h1 className="text-xl font-bold text-center mb-6">家計簿</h1>

      {/* 今月のサマリーカード */}
      <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 mb-6">
        <p className="text-sm text-muted-foreground mb-1">
          {month}月の支出
        </p>
        <div className="flex items-baseline gap-3">
          <p className="text-3xl font-bold">
            ¥{total.toLocaleString()}
          </p>
          {diffPercent !== null && (
            <span
              className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TREND_TEXT_COLOR[trend]} ${TREND_BG_COLOR[trend]}`}
            >
              {TREND_ICON[trend]} {diffPercent > 0 ? "+" : ""}{diffPercent}%
            </span>
          )}
        </div>
        {prevTotal > 0 && (
          <p className="text-xs text-muted-foreground mt-1">
            先月: ¥{prevTotal.toLocaleString()}
          </p>
        )}
      </div>

      {/* アクションボタン */}
      <div className="flex flex-col gap-3">
        <Button render={<Link href="/expenses/new" />}>
          支出を登録
        </Button>
        <Button render={<Link href="/summary" />} variant="secondary">
          月次サマリー
        </Button>
      </div>
    </div>
  );
}
