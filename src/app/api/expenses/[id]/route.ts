import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { validateExpenseInput } from "@/lib/expenses";

type Params = { params: Promise<{ id: string }> };

export async function GET(_req: NextRequest, { params }: Params) {
  const { id } = await params;
  const expense = await prisma.expense.findFirst({
    where: { id, householdId: DEMO_HOUSEHOLD_ID },
    include: { category: { select: { id: true, name: true } } },
  });

  if (!expense) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json(expense);
}

export async function PATCH(req: NextRequest, { params }: Params) {
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { data, error } = await validateExpenseInput(body as Record<string, unknown>, {
    partial: true,
  });
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 世帯スコープを where に含めて1クエリで更新
  const result = await prisma.expense.updateMany({
    where: { id, householdId: DEMO_HOUSEHOLD_ID },
    data,
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  const expense = await prisma.expense.findUnique({
    where: { id },
    include: { category: { select: { id: true, name: true } } },
  });
  return NextResponse.json(expense);
}

export async function DELETE(_req: NextRequest, { params }: Params) {
  const { id } = await params;

  const result = await prisma.expense.deleteMany({
    where: { id, householdId: DEMO_HOUSEHOLD_ID },
  });
  if (result.count === 0) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
