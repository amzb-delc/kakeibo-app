import { prisma } from "@/lib/prisma";
import { CATEGORY_SLOTS, CATEGORY_NAME_MAX, slotName } from "@/lib/category-constants";
import type { ValidationError } from "@/lib/validation";

// 世帯のカテゴリ sortOrder 0..15 のうち欠けている枠を、無効の空きスロットで補充する。
// 世帯コード変更で id が付け替わった世帯でも、seed を待たずに 16 枠を揃えるための遅延生成。
// 歯抜け（途中の欠番）があっても確実に 0..15 を埋め、範囲外の sortOrder は作らない。
export async function ensureCategorySlots(householdId: string): Promise<void> {
  const existing = await prisma.category.findMany({
    where: { householdId },
    select: { sortOrder: true },
  });
  const used = new Set(existing.map((c) => c.sortOrder));

  const data = [];
  for (let sortOrder = 0; sortOrder < CATEGORY_SLOTS; sortOrder++) {
    if (used.has(sortOrder)) continue;
    data.push({
      householdId,
      name: slotName(sortOrder),
      sortOrder,
      enabled: false,
    });
  }
  if (data.length === 0) return;
  // 名前は slotName(sortOrder) で一意なので、並行リクエストが同じ欠番を埋めても
  // @@unique([householdId, name]) で弾かれる → skipDuplicates で握り潰して 16 枠に収束。
  await prisma.category.createMany({ data, skipDuplicates: true });
}

export type CategoryPatchInput = {
  name?: string;
  enabled?: boolean;
};

// PATCH 入力の検証。name は trim 済みを返す。
export function validateCategoryPatch(body: Record<string, unknown>): {
  data: CategoryPatchInput;
  error?: ValidationError;
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
