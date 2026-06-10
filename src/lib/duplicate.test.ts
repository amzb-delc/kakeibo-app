import { describe, it, expect, vi, beforeEach } from "vitest";
import type { StatementRow } from "@/types/api";

// findDuplicateFlags は prisma.expense.findMany を使う（markDuplicates は prisma 非依存）。
const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { expense: { findMany } },
}));

import { markDuplicates, findDuplicateFlags } from "@/lib/duplicate";

function row(p: Partial<StatementRow>): StatementRow {
  return {
    amount: 1000,
    spentAt: "2026-05-03",
    storeName: "セブン",
    categoryId: "c1",
    duplicateLikely: false,
    ...p,
  };
}

describe("markDuplicates", () => {
  it("同日・同額・同店は重複", () => {
    const res = markDuplicates(
      [row({})],
      [{ amount: 1000, spentAtYmd: "2026-05-03", storeName: "セブン" }]
    );
    expect(res[0].duplicateLikely).toBe(true);
  });

  it("日付違いは非重複", () => {
    const res = markDuplicates(
      [row({})],
      [{ amount: 1000, spentAtYmd: "2026-05-04", storeName: "セブン" }]
    );
    expect(res[0].duplicateLikely).toBe(false);
  });

  it("金額違いは非重複", () => {
    const res = markDuplicates(
      [row({})],
      [{ amount: 999, spentAtYmd: "2026-05-03", storeName: "セブン" }]
    );
    expect(res[0].duplicateLikely).toBe(false);
  });

  it("店名が包含関係なら重複（セブン ⊂ セブンイレブン渋谷）", () => {
    const res = markDuplicates(
      [row({ storeName: "セブン" })],
      [{ amount: 1000, spentAtYmd: "2026-05-03", storeName: "セブンイレブン渋谷" }]
    );
    expect(res[0].duplicateLikely).toBe(true);
  });

  it("店名が無関係なら非重複", () => {
    const res = markDuplicates(
      [row({ storeName: "ローソン" })],
      [{ amount: 1000, spentAtYmd: "2026-05-03", storeName: "セブン" }]
    );
    expect(res[0].duplicateLikely).toBe(false);
  });

  it("どちらか店名なしは日付×金額のみで弱一致", () => {
    const res = markDuplicates(
      [row({ storeName: null })],
      [{ amount: 1000, spentAtYmd: "2026-05-03", storeName: "セブン" }]
    );
    expect(res[0].duplicateLikely).toBe(true);
  });

  it("金額null/日付nullは判定対象外（非重複）", () => {
    const res = markDuplicates(
      [row({ amount: null }), row({ spentAt: null })],
      [{ amount: 1000, spentAtYmd: "2026-05-03", storeName: "セブン" }]
    );
    expect(res[0].duplicateLikely).toBe(false);
    expect(res[1].duplicateLikely).toBe(false);
  });
});

describe("findDuplicateFlags（prisma 突合）", () => {
  beforeEach(() => {
    findMany.mockReset();
  });

  it("有効な日付が1件も無ければ prisma を呼ばず全件 false", async () => {
    const res = await findDuplicateFlags("hh-1", [
      row({ spentAt: "" }),
      row({ spentAt: "2026-13-40" }), // 実在しない日付 → parseReceiptDate が null
    ]);
    expect(findMany).not.toHaveBeenCalled();
    expect(res.every((r) => r.duplicateLikely === false)).toBe(true);
  });

  it("対象期間の既存支出と突合して重複フラグを付ける（世帯スコープ＋日付範囲でクエリ）", async () => {
    findMany.mockResolvedValue([
      // JST のいずれかの瞬間。formatJstDate で "2026-05-03" になる。
      { amount: 1000, spentAt: new Date("2026-05-03T12:00:00+09:00"), storeName: "セブン" },
    ]);
    const rows = [
      row({ spentAt: "2026-05-03", amount: 1000, storeName: "セブン" }), // 重複
      row({ spentAt: "2026-05-04", amount: 2000, storeName: "ローソン" }), // 非重複
    ];
    const res = await findDuplicateFlags("hh-1", rows);
    expect(res[0].duplicateLikely).toBe(true);
    expect(res[1].duplicateLikely).toBe(false);

    expect(findMany).toHaveBeenCalledTimes(1);
    const arg = findMany.mock.calls[0][0];
    expect(arg.where.householdId).toBe("hh-1");
    expect(arg.where.spentAt.gte).toBeInstanceOf(Date);
    expect(arg.where.spentAt.lt).toBeInstanceOf(Date);
    // 期間は [min 00:00(JST), max+1日 00:00(JST)) なので lt > gte。
    expect(arg.where.spentAt.lt.getTime()).toBeGreaterThan(
      arg.where.spentAt.gte.getTime()
    );
  });

  it("既存支出が無ければ全件 false（クエリは走る）", async () => {
    findMany.mockResolvedValue([]);
    const res = await findDuplicateFlags("hh-1", [row({ spentAt: "2026-05-03" })]);
    expect(findMany).toHaveBeenCalledTimes(1);
    expect(res[0].duplicateLikely).toBe(false);
  });
});
