import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getDemoUserId, getEnteredBy } from "@/lib/auth";
import { validateExpenseInput } from "@/lib/expenses";
import { requireHouseholdId, parseJsonBody, jsonError } from "@/lib/api";
import type { BatchExpenseResult } from "@/types/api";

// 一括登録は明細取り込み用。1リクエストの上限（暴発防止）。
const MAX_ROWS = 500;

export async function POST(req: NextRequest) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const rows = (body as { rows?: unknown }).rows;
  if (!Array.isArray(rows) || rows.length === 0) {
    return jsonError("登録する明細がありません", 400);
  }
  if (rows.length > MAX_ROWS) {
    return jsonError(`一度に登録できるのは${MAX_ROWS}件までです`, 400);
  }

  // 入力者は端末設定（cookie）から付与する。未設定でも既定値が起動時に入るため必須にはしない。
  const enteredBy = await getEnteredBy();

  const createdByUserId = await getDemoUserId();

  // 全行をバリデーション。1行でも失敗したら何も作らず errors を返す（＝全行ロールバック）。
  // プレビューで確認済みの前提なので、部分コミットより「全成功か全失敗」が明快。
  const validated: {
    amount: number;
    spentAt: Date;
    categoryId: string;
    storeName: string | null;
    memo: string | null;
  }[] = [];
  const errors: { index: number; message: string }[] = [];

  for (let i = 0; i < rows.length; i++) {
    const { data, error } = await validateExpenseInput(
      rows[i] as Record<string, unknown>,
      { partial: false, householdId }
    );
    if (error) {
      errors.push({ index: i, message: error.message });
      continue;
    }
    validated.push({
      amount: data.amount!,
      spentAt: data.spentAt!,
      categoryId: data.categoryId!,
      storeName: data.storeName ?? null,
      memo: data.memo ?? null,
    });
  }

  if (errors.length > 0) {
    return NextResponse.json({ created: 0, errors } satisfies BatchExpenseResult, {
      status: 400,
    });
  }

  await prisma.$transaction(
    validated.map((v) =>
      prisma.expense.create({
        data: {
          householdId,
          categoryId: v.categoryId,
          amount: v.amount,
          spentAt: v.spentAt,
          storeName: v.storeName,
          memo: v.memo,
          enteredBy,
          createdByUserId,
        },
      })
    )
  );

  return NextResponse.json(
    { created: validated.length, errors: [] } satisfies BatchExpenseResult,
    { status: 201 }
  );
}
