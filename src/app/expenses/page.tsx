import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { formatJstDateLabel } from "@/lib/date";
import { listExpenses } from "@/lib/expenses";
import { PageHeader } from "@/components/page-header";

type SearchParams = Promise<{
  year?: string;
  month?: string;
  categoryId?: string;
}>;

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const sp = await searchParams;
  const now = new Date();
  const year = Number(sp.year ?? now.getFullYear());
  const month = Number(sp.month ?? now.getMonth() + 1);
  const categoryId = sp.categoryId || undefined;

  const [expenses, category] = await Promise.all([
    listExpenses({ year, month, categoryId }),
    categoryId
      ? prisma.category.findFirst({
          where: { id: categoryId, householdId: DEMO_HOUSEHOLD_ID },
        })
      : Promise.resolve(null),
  ]);

  const total = expenses.reduce((sum, e) => sum + e.amount, 0);

  const listParams = new URLSearchParams({ year: String(year), month: String(month) });
  if (categoryId) listParams.set("categoryId", categoryId);
  const listSelfHref = `/expenses?${listParams.toString()}`;
  const backHref = `/summary?year=${year}&month=${month}`;

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title={`${year}年${month}月${category ? ` ・ ${category.name}` : ""}`}
        backHref={backHref}
      />

      <main className="px-4 py-6 space-y-6">
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
          <div className="flex items-baseline justify-between">
            <span className="text-sm text-muted-foreground">
              {expenses.length}件
            </span>
            <p className="text-2xl font-bold">{formatYen(total)}</p>
          </div>
        </div>

        <div className="space-y-3">
          {expenses.length === 0 ? (
            <p className="py-12 text-center text-sm text-muted-foreground">
              この期間の支出はありません
            </p>
          ) : (
            expenses.map((exp) => {
              const editHref = `/expenses/${exp.id}/edit?back=${encodeURIComponent(listSelfHref)}`;
              return (
                <Link
                  key={exp.id}
                  href={editHref}
                  className="block bg-card rounded-2xl border border-border/50 shadow-sm p-4 min-h-[56px] active:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm text-muted-foreground">
                      {formatJstDateLabel(exp.spentAt)}
                    </span>
                    <span className="text-base font-semibold">
                      {formatYen(exp.amount)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-gray-100 text-gray-700">
                      {exp.category.name}
                    </span>
                    {(exp.storeName || exp.memo) && (
                      <span className="text-muted-foreground truncate ml-2">
                        {exp.storeName ?? exp.memo}
                      </span>
                    )}
                  </div>
                </Link>
              );
            })
          )}
        </div>
      </main>
    </div>
  );
}
