import { describe, it, expect } from "vitest";
import { sortExpenses } from "./expense-sort";

// spentAt と updatedAt が逆順になるデータ（発生は古いが直近に更新、など）
const rows = [
  { id: "a", amount: 300, spentAt: "2026-06-01T03:00:00.000Z", updatedAt: "2026-06-07T10:00:00.000Z" },
  { id: "b", amount: 100, spentAt: "2026-06-05T03:00:00.000Z", updatedAt: "2026-06-05T03:00:00.000Z" },
  { id: "c", amount: 200, spentAt: "2026-06-03T03:00:00.000Z", updatedAt: "2026-06-01T09:00:00.000Z" },
];

const ids = (xs: { id: string }[]) => xs.map((x) => x.id);

describe("sortExpenses", () => {
  it("発生日 降順（新しい→古い）", () => {
    expect(ids(sortExpenses(rows, "spentAt", "desc"))).toEqual(["b", "c", "a"]);
  });
  it("発生日 昇順（古い→新しい）", () => {
    expect(ids(sortExpenses(rows, "spentAt", "asc"))).toEqual(["a", "c", "b"]);
  });
  it("更新日 降順", () => {
    expect(ids(sortExpenses(rows, "updatedAt", "desc"))).toEqual(["a", "b", "c"]);
  });
  it("更新日 昇順", () => {
    expect(ids(sortExpenses(rows, "updatedAt", "asc"))).toEqual(["c", "b", "a"]);
  });
  it("金額 降順（大→小）", () => {
    expect(ids(sortExpenses(rows, "amount", "desc"))).toEqual(["a", "c", "b"]);
  });
  it("金額 昇順（小→大）", () => {
    expect(ids(sortExpenses(rows, "amount", "asc"))).toEqual(["b", "c", "a"]);
  });
  it("元配列を破壊しない", () => {
    const copy = [...rows];
    sortExpenses(rows, "spentAt", "asc");
    expect(rows).toEqual(copy);
  });
});
