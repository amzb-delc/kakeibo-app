import { prisma } from "@/lib/prisma";
import { parseJstDate } from "@/lib/date";
import type { ValidationError } from "@/lib/validation";

export type ExpenseInput = {
  amount: number;
  spentAt: Date;
  categoryId: string;
  storeName: string | null;
  memo: string | null;
};

const MAX_AMOUNT = 100_000_000;
const MAX_STORE_NAME = 100;
const MAX_MEMO = 500;

type RawInput = Record<string, unknown>;

// partial=true で PATCH 用（未指定フィールドはスキップ）
export async function validateExpenseInput(
  body: RawInput,
  opts: { partial: boolean; householdId: string }
): Promise<{ data: Partial<ExpenseInput>; error?: ValidationError }> {
  const data: Partial<ExpenseInput> = {};

  // amount
  if (body.amount !== undefined) {
    const raw = body.amount;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0 || n > MAX_AMOUNT) {
      return { data, error: { field: "amount", message: "amount は0〜100,000,000の整数" } };
    }
    data.amount = n;
  } else if (!opts.partial) {
    return { data, error: { field: "amount", message: "amount は必須" } };
  }

  // spentAt
  if (body.spentAt !== undefined) {
    if (typeof body.spentAt !== "string") {
      return { data, error: { field: "spentAt", message: "spentAt は YYYY-MM-DD" } };
    }
    const d = parseJstDate(body.spentAt);
    if (!d) {
      return { data, error: { field: "spentAt", message: "spentAt は YYYY-MM-DD" } };
    }
    data.spentAt = d;
  } else if (!opts.partial) {
    return { data, error: { field: "spentAt", message: "spentAt は必須" } };
  }

  // categoryId — DBで世帯スコープを検証
  if (body.categoryId !== undefined) {
    if (typeof body.categoryId !== "string" || body.categoryId.length === 0) {
      return { data, error: { field: "categoryId", message: "categoryId は必須" } };
    }
    const cat = await prisma.category.findFirst({
      where: { id: body.categoryId, householdId: opts.householdId },
      select: { id: true },
    });
    if (!cat) {
      return { data, error: { field: "categoryId", message: "categoryId が不正" } };
    }
    data.categoryId = body.categoryId;
  } else if (!opts.partial) {
    return { data, error: { field: "categoryId", message: "categoryId は必須" } };
  }

  // storeName
  if (body.storeName !== undefined) {
    if (body.storeName === null || body.storeName === "") {
      data.storeName = null;
    } else if (typeof body.storeName === "string" && body.storeName.length <= MAX_STORE_NAME) {
      data.storeName = body.storeName;
    } else {
      return { data, error: { field: "storeName", message: `storeName は${MAX_STORE_NAME}文字以下` } };
    }
  }

  // memo
  if (body.memo !== undefined) {
    if (body.memo === null || body.memo === "") {
      data.memo = null;
    } else if (typeof body.memo === "string" && body.memo.length <= MAX_MEMO) {
      data.memo = body.memo;
    } else {
      return { data, error: { field: "memo", message: `memo は${MAX_MEMO}文字以下` } };
    }
  }

  return { data };
}
