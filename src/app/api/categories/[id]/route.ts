import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { validateCategoryPatch } from "@/lib/categories";
import { isRequiredSlot } from "@/lib/category-constants";
import { requireHouseholdId, parseJsonBody, jsonError } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  const { id } = await params;
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { data, error } = validateCategoryPatch(body);
  if (error) return jsonError(error.message, 400);

  // 対象が自世帯に存在するか確認（cross-household の改竄防止）
  const target = await prisma.category.findFirst({
    where: { id, householdId },
    select: { id: true, sortOrder: true },
  });
  if (!target) return jsonError("not found", 404);

  // 必須スロット（先頭4個）は無効化できない
  if (data.enabled === false && isRequiredSlot(target.sortOrder)) {
    return jsonError("このカテゴリは無効にできません", 400);
  }

  try {
    const updated = await prisma.category.update({
      where: { id },
      data,
      select: { id: true, name: true, sortOrder: true, enabled: true },
    });
    return NextResponse.json(updated);
  } catch (e) {
    // @@unique([householdId, name]) 違反 → 同名カテゴリが既にある
    if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === "P2002") {
      return jsonError("同じ名前のカテゴリが既にあります", 409);
    }
    throw e;
  }
}
