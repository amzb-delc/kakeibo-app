import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID, getDemoUserId } from "@/lib/auth";
import { listExpenses, validateExpenseInput } from "@/lib/expenses";

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const categoryId = searchParams.get("categoryId") || undefined;

  const expenses = await listExpenses({
    year: yearParam ? Number(yearParam) : undefined,
    month: monthParam ? Number(monthParam) : undefined,
    categoryId,
  });

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { data, error } = await validateExpenseInput(body as Record<string, unknown>, {
    partial: false,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  const createdByUserId = await getDemoUserId();

  const expense = await prisma.expense.create({
    data: {
      householdId: DEMO_HOUSEHOLD_ID,
      categoryId: data.categoryId!,
      amount: data.amount!,
      spentAt: data.spentAt!,
      storeName: data.storeName ?? null,
      memo: data.memo ?? null,
      receiptImageUrl: data.receiptImageUrl ?? null,
      createdByUserId,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json(expense, { status: 201 });
}
