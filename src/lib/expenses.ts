import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { DEMO_HOUSEHOLD_ID } from "@/lib/auth";
import { jstMonthRange, parseJstDate } from "@/lib/date";

export const EXPENSE_LIST_LIMIT = 500;

export type ExpenseListParams = {
  year?: number;
  month?: number;
  categoryId?: string;
};

export async function listExpenses(params: ExpenseListParams) {
  const where: Prisma.ExpenseWhereInput = { householdId: DEMO_HOUSEHOLD_ID };
  if (params.year && params.month) {
    where.spentAt = jstMonthRange(params.year, params.month);
  }
  if (params.categoryId) {
    where.categoryId = params.categoryId;
  }
  return prisma.expense.findMany({
    where,
    include: { category: { select: { id: true, name: true } } },
    orderBy: [{ spentAt: "desc" }, { createdAt: "desc" }],
    take: EXPENSE_LIST_LIMIT,
  });
}

export type ExpenseInput = {
  amount: number;
  spentAt: Date;
  categoryId: string;
  storeName: string | null;
  memo: string | null;
  receiptImageUrl: string | null;
};

export type ValidationError = { field: string; message: string };

const MAX_AMOUNT = 100_000_000;
const MAX_STORE_NAME = 100;
const MAX_MEMO = 500;

type RawInput = Record<string, unknown>;

// partial=true で PATCH 用（未指定フィールドはスキップ）
export async function validateExpenseInput(
  body: RawInput,
  opts: { partial: boolean }
): Promise<{ data: Partial<ExpenseInput>; error?: ValidationError }> {
  const data: Partial<ExpenseInput> = {};

  // amount
  if (body.amount !== undefined) {
    const raw = body.amount;
    const n = typeof raw === "number" ? raw : Number(raw);
    if (!Number.isFinite(n) || !Number.isInteger(n) || n <= 0 || n > MAX_AMOUNT) {
      return { data, error: { field: "amount", message: "amount は1〜100,000,000の整数" } };
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
      where: { id: body.categoryId, householdId: DEMO_HOUSEHOLD_ID },
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

  // receiptImageUrl
  if (body.receiptImageUrl !== undefined) {
    if (body.receiptImageUrl === null || body.receiptImageUrl === "") {
      data.receiptImageUrl = null;
    } else if (typeof body.receiptImageUrl === "string") {
      data.receiptImageUrl = body.receiptImageUrl;
    } else {
      return { data, error: { field: "receiptImageUrl", message: "receiptImageUrl が不正" } };
    }
  }

  return { data };
}
