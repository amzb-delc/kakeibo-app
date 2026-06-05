import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { ensureCategorySlots } from "@/lib/categories";
import { requireHouseholdId } from "@/lib/api";

export async function GET(req: NextRequest) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  // scope=all: 管理用に全16スロット（無効含む）を返す。既定はフォーム用に有効のみ。
  const scope = new URL(req.url).searchParams.get("scope");
  const includeDisabled = scope === "all";

  if (includeDisabled) {
    // 管理画面を開いたタイミングで 16 枠を揃える
    await ensureCategorySlots(householdId);
  }

  const categories = await prisma.category.findMany({
    where: { householdId, ...(includeDisabled ? {} : { enabled: true }) },
    orderBy: { sortOrder: "asc" },
    select: {
      id: true,
      name: true,
      sortOrder: true,
      enabled: true,
    },
  });

  return NextResponse.json(categories);
}
