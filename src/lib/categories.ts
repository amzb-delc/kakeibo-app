import { prisma } from "@/lib/prisma";
import { CATEGORY_SLOTS, CATEGORY_NAME_MAX, slotName } from "@/lib/category-constants";

export type CategoryRow = {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
};

// 世帯のカテゴリが 16 個に満たない場合、無効の空きスロットを補充する。
// 世帯コード変更で id が付け替わった世帯でも、seed を待たずに 16 枠を揃えるための遅延生成。
export async function ensureCategorySlots(householdId: string): Promise<void> {
  const existing = await prisma.category.findMany({
    where: { householdId },
    select: { sortOrder: true },
    orderBy: { sortOrder: "desc" },
  });
  if (existing.length >= CATEGORY_SLOTS) return;

  const maxSortOrder = existing[0]?.sortOrder ?? -1;
  const toCreate = CATEGORY_SLOTS - existing.length;
  const data = Array.from({ length: toCreate }, (_, k) => {
    const sortOrder = maxSortOrder + 1 + k;
    return {
      householdId,
      name: slotName(sortOrder),
      sortOrder,
      enabled: false,
    };
  });
  // 競合や名前衝突は黙ってスキップ（並行リクエストでも 16 枠に収束する）
  await prisma.category.createMany({ data, skipDuplicates: true });
}

export type CategoryPatchInput = {
  name?: string;
  enabled?: boolean;
};

export type CategoryValidationError = { field: string; message: string };

// PATCH 入力の検証。name は trim 済みを返す。
export function validateCategoryPatch(body: Record<string, unknown>): {
  data: CategoryPatchInput;
  error?: CategoryValidationError;
} {
  const data: CategoryPatchInput = {};

  if (body.name !== undefined) {
    if (typeof body.name !== "string") {
      return { data, error: { field: "name", message: "name は文字列" } };
    }
    const name = body.name.trim();
    if (name.length === 0) {
      return { data, error: { field: "name", message: "name は必須" } };
    }
    if (name.length > CATEGORY_NAME_MAX) {
      return {
        data,
        error: { field: "name", message: `name は${CATEGORY_NAME_MAX}文字以内` },
      };
    }
    data.name = name;
  }

  if (body.enabled !== undefined) {
    if (typeof body.enabled !== "boolean") {
      return { data, error: { field: "enabled", message: "enabled は真偽値" } };
    }
    data.enabled = body.enabled;
  }

  if (data.name === undefined && data.enabled === undefined) {
    return { data, error: { field: "_", message: "更新対象がありません" } };
  }

  return { data };
}
