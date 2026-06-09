import { describe, it, expect } from "vitest";
import { markDuplicates } from "@/lib/duplicate";
import type { StatementRow } from "@/types/api";

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
