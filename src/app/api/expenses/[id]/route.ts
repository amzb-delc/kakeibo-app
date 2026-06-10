import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { validateExpenseInput } from "@/lib/expenses";
import {
  requireHouseholdId,
  parseJsonBody,
  jsonError,
  requireSameOrigin,
} from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, householdId },
    include: { category: { select: { id: true, name: true } } },
  });

  if (!expense) return jsonError("not found", 404);

  return NextResponse.json(expense);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const csrf = requireSameOrigin(req); // SEC-6
  if (csrf) return csrf;

  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  const { id } = await params;
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { data, error } = await validateExpenseInput(body, {
    partial: true,
    householdId,
  });
  if (error) return jsonError(error.message, 400);

  // 世帯スコープを where に含めて1クエリで更新
  const result = await prisma.expense.updateMany({
    where: { id, householdId },
    data,
  });
  if (result.count === 0) return jsonError("not found", 404);

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  return NextResponse.json(expense);
}

export async function DELETE(req: NextRequest, { params }: Params) {
  const csrf = requireSameOrigin(req); // SEC-6
  if (csrf) return csrf;

  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  const { id } = await params;

  const result = await prisma.expense.deleteMany({
    where: { id, householdId },
  });
  if (result.count === 0) return jsonError("not found", 404);

  return NextResponse.json({ ok: true });
}
