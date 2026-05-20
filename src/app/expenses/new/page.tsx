import { ExpenseForm } from "@/components/expense-form";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { PageHeader } from "@/components/page-header";

type SearchParams = Promise<{ back?: string }>;

function safeBackHref(raw: string | undefined, fallback: string): string {
  if (!raw) return fallback;
  if (raw.startsWith("/") && !raw.startsWith("//")) return raw;
  return fallback;
}

async function getCategories() {
  return prisma.category.findMany({
    where: { householdId: DEMO_HOUSEHOLD_ID },
    orderBy: { sortOrder: "asc" },
  });
}

export default async function NewExpensePage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { back } = await searchParams;
  const backHref = safeBackHref(back, "/");
  const categories = await getCategories();

  return (
    <div className="min-h-screen bg-background">
      <PageHeader title="支出を登録" backHref={backHref} />
      <main>
        <ExpenseForm categories={categories} backHref={backHref} />
      </main>
    </div>
  );
}
