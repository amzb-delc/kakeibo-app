import { prisma } from "@/lib/prisma";
import { parseReceiptDate, parseJstDate, pad2, formatJstDate } from "@/lib/date";
import type { StatementRow } from "@/types/api";

// 明細取り込みの「重複かも」判定。
// 既存支出と、日付×金額×店名が近い行にフラグを立てる（除外はしない＝ユーザー判断）。

// 店名の正規化。NFKC で全角/半角のゆれを吸収（全角英数字→半角、全角スペース→半角など）
// したうえで前後空白除去＋小文字化する。OCR が同じ店名を全角/半角で揺らしても同一視できる。
function normStore(s: string | null | undefined): string {
  return (s ?? "").normalize("NFKC").trim().toLowerCase();
}

// 既存支出（spentAtYmd は JST の YYYY-MM-DD）と抽出行を突合する純関数。
// 「重複かも」= 同日 かつ 金額一致 かつ 店名が近い（包含 or 一致）。
// どちらかの店名が空なら、日付×金額のみで弱一致（重複とみなす）。
// prisma 非依存なのでユニットテストしやすい。
export function markDuplicates(
  rows: StatementRow[],
  existing: { amount: number; spentAtYmd: string; storeName: string | null }[]
): StatementRow[] {
  return rows.map((row) => {
    if (row.amount == null || !row.spentAt) {
      return { ...row, duplicateLikely: false };
    }
    const a = normStore(row.storeName);
    const hit = existing.some((e) => {
      if (e.amount !== row.amount) return false;
      if (e.spentAtYmd !== row.spentAt) return false;
      const b = normStore(e.storeName);
      if (!a || !b) return true; // どちらか店名なし → 日付×金額のみで弱一致
      return a === b || a.includes(b) || b.includes(a);
    });
    return { ...row, duplicateLikely: hit };
  });
}

// 抽出行の対象期間の既存支出を世帯スコープで1クエリ取得し、markDuplicates でフラグを付ける。
export async function findDuplicateFlags(
  householdId: string,
  rows: StatementRow[]
): Promise<StatementRow[]> {
  const parsed = rows
    .map((r) => parseReceiptDate(r.spentAt))
    .filter((d): d is { year: number; month: number; day: number } => d !== null);
  if (parsed.length === 0) {
    return rows.map((r) => ({ ...r, duplicateLikely: false }));
  }

  // 有効日付の min/max から JST 境界の期間を作る（[min 00:00, max+1日 00:00)）。
  const keys = parsed
    .map((d) => `${d.year}-${pad2(d.month)}-${pad2(d.day)}`)
    .sort();
  const minDate = parseJstDate(keys[0]);
  const maxDate = parseJstDate(keys[keys.length - 1]);
  if (!minDate || !maxDate) {
    return rows.map((r) => ({ ...r, duplicateLikely: false }));
  }
  const lt = new Date(maxDate.getTime() + 24 * 60 * 60 * 1000);

  const existingRaw = await prisma.expense.findMany({
    where: { householdId, spentAt: { gte: minDate, lt } },
    select: { amount: true, spentAt: true, storeName: true },
  });
  const existing = existingRaw.map((e) => ({
    amount: e.amount,
    spentAtYmd: formatJstDate(e.spentAt),
    storeName: e.storeName,
  }));

  return markDuplicates(rows, existing);
}
