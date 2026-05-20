import Link from "next/link";
import { ExpenseForm } from "@/components/expense-form";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";

async function getCategories() {
  return prisma.category.findMany({
    where: { householdId: DEMO_HOUSEHOLD_ID },
    orderBy: { sortOrder: "asc" },
  });
}

export default async function NewExpensePage() {
  const categories = await getCategories();

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-10 bg-background border-b">
        <div className="flex items-center px-4 py-3">
          <Link
            href="/"
            className="text-muted-foreground hover:text-foreground min-w-[44px] min-h-[44px] flex items-center"
          >
            ← 戻る
          </Link>
          <h1 className="flex-1 text-center text-base font-semibold pr-[44px]">
            支出を登録
          </h1>
        </div>
      </header>
      <main>
        <ExpenseForm categories={categories} />
      </main>
    </div>
  );
}
