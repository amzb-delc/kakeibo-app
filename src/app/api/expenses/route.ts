import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId, getEnteredBy } from "@/lib/auth";
import { validateExpenseInput } from "@/lib/expenses";
import { requireHouseholdId, parseJsonBody, jsonError } from "@/lib/api";

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

  // 入力者は端末設定（cookie）から付与する。未設定の端末では登録できない。
  const enteredBy = await getEnteredBy();
  if (enteredBy == null) return jsonError("enteredByRequired", 400);

  const createdByUserId = await getDemoUserId();

  const expense = await prisma.expense.create({
    data: {
      householdId,
      categoryId: data.categoryId!,
      amount: data.amount!,
      spentAt: data.spentAt!,
      storeName: data.storeName ?? null,
      memo: data.memo ?? null,
      enteredBy,
      createdByUserId,
    },
    include: { category: { select: { id: true, name: true } } },
  });

  return NextResponse.json(expense, { status: 201 });
}
