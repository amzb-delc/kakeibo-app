// API レスポンスの契約（ルートと呼び出し側で単一ソース化する）。
// Category / Expense / MonthlySummary は @/types で既に共有しているため、
// ここには「個別ルート固有のレスポンス形」だけを置く。
// ルート側は `satisfies` で、クライアント側は `as`/注釈でこの型を参照し、
// 双方がずれたら tsc で検知できるようにする。

// lib/api.ts の jsonError が返す統一エラー形。
export type ApiError = { error: string };

// GET /api/session: 保存状態。
export type SessionStatus = {
  unlocked: boolean;
  householdName?: string | null;
};

// POST /api/session: 世帯コード保存の結果。
export type SessionUnlockResult = {
  ok: boolean;
  householdName?: string | null;
};

// POST /api/ocr: レシート抽出結果。
// カテゴリは世帯の categoryId に解決済み（抽出時の categoryName ではない）。
export type OcrResult = {
  amount: number | null;
  storeName: string | null;
  spentAt: string | null; // YYYY-MM-DD
  categoryId: string | null;
};
