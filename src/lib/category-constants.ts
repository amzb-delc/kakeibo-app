// カテゴリのスロット定義（prisma 非依存の純粋な定数）。
// サーバ／クライアント両方から安全に import できるよう、ここには副作用を置かない。

// 世帯ごとにカテゴリは 16 個で固定。
export const CATEGORY_SLOTS = 16;

// カテゴリ名の最大長
export const CATEGORY_NAME_MAX = 20;

// 先頭 REQUIRED_SLOT_COUNT 個（sortOrder 0..3）は無効化できない必須カテゴリ。
export const REQUIRED_SLOT_COUNT = 4;

export const isRequiredSlot = (sortOrder: number) => sortOrder < REQUIRED_SLOT_COUNT;

// プリセット名: 「ヒヨウ」+ 2桁ゼロ詰め連番（1始まり。例: sortOrder 0 → ヒヨウ01）。
// @@unique([householdId, name]) を満たすため sortOrder 由来で世帯内一意・非空。
export const slotName = (sortOrder: number) =>
  `ヒヨウ${String(sortOrder + 1).padStart(2, "0")}`;
