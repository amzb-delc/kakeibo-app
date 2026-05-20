import { notFound } from "next/navigation";
import { ExpenseForm } from "@/components/expense-form";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { formatJstDate } from "@/lib/date";
import { PageHeader } from "@/components/page-header";
import type { Expense } from "@/types";

type Params = Promise<{ id: string }>;
type SearchParams = Promise<{ back?: string }>;

function safeBackHref(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  // 内部リンクのみ許可（オープンリダイレクト防止）
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

export default async function EditExpensePage({
  params,
  searchParams,
}: {
  params: Params;
  searchParams: SearchParams;
}) {
  const { id } = await params;
  const { back } = await searchParams;

  const [expense, categories] = await Promise.all([
    prisma.expense.findFirst({
      where: { id, householdId: DEMO_HOUSEHOLD_ID },
      include: { category: { select: { id: true, name: true } } },
    }),
    prisma.category.findMany({
      where: { householdId: DEMO_HOUSEHOLD_ID },
      orderBy: { sortOrder: "asc" },
    }),
  ]);

  if (!expense) notFound();

  const spentAtJst = formatJstDate(expense.spentAt);
  const expenseForClient: Expense = {
    id: expense.id,
    categoryId: expense.categoryId,
    amount: expense.amount,
    spentAt: spentAtJst,
    storeName: expense.storeName,
    memo: expense.memo,
    receiptImageUrl: expense.receiptImageUrl,
    category: expense.category,
  };

  const d = expense.spentAt;
  const fallbackBack = `/expenses?year=${d.getUTCFullYear()}&month=${d.getUTCMonth() + 1}&categoryId=${expense.categoryId}`;
  const backHref = safeBackHref(back, fallbackBack);

  return (
    <div className="min-h-screen bg-background">
      <PageHeader
        title="支出を編集"
        subtitle={`${spentAtJst} ・ ${formatYen(expense.amount)}`}
        backHref={backHref}
      />
      <main>
        <ExpenseForm
          categories={categories}
          expense={expenseForClient}
          backHref={backHref}
        />
      </main>
    </div>
  );
}
