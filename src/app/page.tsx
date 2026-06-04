import Image from "next/image";
import { prisma } from "@/lib/prisma";
import { getTrendLevel, TREND_ICON, TREND_TEXT_COLOR, TREND_BG_COLOR } from "@/lib/trend";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { jstMonthRange } from "@/lib/date";
import { PageHeader } from "@/components/page-header";

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
    <div className="min-h-screen bg-background">
      <PageHeader title="ホーム" />
      <main className="px-4 py-6">
        {total === 0 ? (
          <div className="bg-card rounded-2xl p-6 shadow-sm border border-border/50 flex flex-col items-center text-center">
            <Image
              src="/character.png"
              alt="ワレワレ"
              width={160}
              height={160}
              priority
              className="w-32 h-32 sm:w-40 sm:h-40 mb-3"
            />
            <p className="text-base font-semibold mb-1">
              {month}月の記録はまだないよ
            </p>
            <p className="text-xs text-muted-foreground">
              右下の ＋ から登録してね
            </p>
          </div>
        ) : (
          <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50 flex items-center gap-4">
            <Image
              src="/character.png"
              alt="ワレワレ"
              width={72}
              height={72}
              priority
              className="w-16 h-16 sm:w-[72px] sm:h-[72px] shrink-0"
            />
            <div className="min-w-0 flex-1">
              <p className="text-sm text-muted-foreground mb-1">
                {month}月の支出
              </p>
              <div className="flex items-baseline gap-3 flex-wrap">
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
          </div>
        )}
      </main>
    </div>
  );
}
