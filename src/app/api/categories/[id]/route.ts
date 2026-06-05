import { NextRequest, NextResponse } from "next/server";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { getHouseholdId } from "@/lib/auth";
import { validateCategoryPatch } from "@/lib/categories";
import { isRequiredSlot } from "@/lib/category-constants";

type Params = { params: Promise<{ id: string }> };

export async function PATCH(req: NextRequest, { params }: Params) {
  const householdId = await getHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }
  const { id } = await params;
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { data, error } = validateCategoryPatch(body as Record<string, unknown>);
  if (error) {
    return NextResponse.json({ error: error.message }, { status: 400 });
  }

  // 対象が自世帯に存在するか確認（cross-household の改竄防止）
  const target = await prisma.category.findFirst({
    where: { id, householdId },
    select: { id: true, sortOrder: true },
  });
  if (!target) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }

  // 必須スロット（先頭4個）は無効化できない
  if (data.enabled === false && isRequiredSlot(target.sortOrder)) {
    return NextResponse.json(
      { error: "このカテゴリは無効にできません" },
      { status: 400 }
    );
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
      return NextResponse.json(
        { error: "同じ名前のカテゴリが既にあります" },
        { status: 409 }
      );
    }
    throw e;
  }
}
