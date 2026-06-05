import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId } from "@/lib/auth";
import { listExpenses, validateExpenseInput } from "@/lib/expenses";
import { requireHouseholdId, parseJsonBody, jsonError } from "@/lib/api";

export async function GET(req: NextRequest) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  const { searchParams } = new URL(req.url);
  const yearParam = searchParams.get("year");
  const monthParam = searchParams.get("month");
  const categoryId = searchParams.get("categoryId") || undefined;

  const expenses = await listExpenses(
    {
      year: yearParam ? Number(yearParam) : undefined,
      month: monthParam ? Number(monthParam) : undefined,
      categoryId,
    },
    householdId
  );

  return NextResponse.json(expenses);
}

export async function POST(req: NextRequest) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { data, error } = await validateExpenseInput(body, {
    partial: false,
    householdId,
  });
  if (error) return jsonError(error.message, 400);

  const createdByUserId = await getDemoUserId();

  const expense = await prisma.expense.create({
    data: {
      householdId,
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
