import { describe, it, expect, vi, beforeEach } from "vitest";

// categoryId の世帯スコープ検証で使う prisma.category.findFirst をモックする。
const { findFirst } = vi.hoisted(() => ({ findFirst: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { category: { findFirst } },
}));

import { validateExpenseInput } from "./expenses";

const HH = "hh-1";
const base = { amount: 1280, spentAt: "2024-03-15", categoryId: "cat-1" };

beforeEach(() => {
  findFirst.mockReset();
  findFirst.mockResolvedValue({ id: "cat-1" }); // 既定: カテゴリは自世帯に存在
});

describe("validateExpenseInput: amount", () => {
  it("正常な整数を受理", async () => {
    const { data, error } = await validateExpenseInput(base, {
      partial: false,
      householdId: HH,
    });
    expect(error).toBeUndefined();
    expect(data.amount).toBe(1280);
  });

  it("0 は許可", async () => {
    const { data, error } = await validateExpenseInput(
      { ...base, amount: 0 },
      { partial: false, householdId: HH }
    );
    expect(error).toBeUndefined();
    expect(data.amount).toBe(0);
  });

  it("負・非整数・上限超はエラー", async () => {
    for (const amount of [-1, 1.5, 100_000_001]) {
      const { error } = await validateExpenseInput(
        { ...base, amount },
        { partial: false, householdId: HH }
      );
      expect(error?.field).toBe("amount");
    }
  });

  it("partial=false で amount 未指定は必須エラー", async () => {
    const { error } = await validateExpenseInput(
      { spentAt: "2024-03-15", categoryId: "cat-1" },
      { partial: false, householdId: HH }
    );
    expect(error?.field).toBe("amount");
  });

  it("partial=true なら未指定はスキップ", async () => {
    const { data, error } = await validateExpenseInput(
      { storeName: "店" },
      { partial: true, householdId: HH }
    );
    expect(error).toBeUndefined();
    expect(data.amount).toBeUndefined();
  });
});

describe("validateExpenseInput: spentAt", () => {
  it("不正なフォーマットはエラー", async () => {
    const { error } = await validateExpenseInput(
      { ...base, spentAt: "2024/03/15" },
      { partial: false, householdId: HH }
    );
    expect(error?.field).toBe("spentAt");
  });
});

describe("validateExpenseInput: categoryId 世帯スコープ(IDOR防止)", () => {
  it("自世帯に存在すれば通る", async () => {
    findFirst.mockResolvedValue({ id: "cat-1" });
    const { error } = await validateExpenseInput(base, {
      partial: false,
      householdId: HH,
    });
    expect(error).toBeUndefined();
  });

  it("他世帯/存在しない categoryId はエラー", async () => {
    findFirst.mockResolvedValue(null);
    const { error } = await validateExpenseInput(
      { ...base, categoryId: "other-household-cat" },
      { partial: false, householdId: HH }
    );
    expect(error?.field).toBe("categoryId");
  });
});

describe("validateExpenseInput: storeName / memo", () => {
  it("空文字は null に正規化", async () => {
    const { data } = await validateExpenseInput(
      { storeName: "", memo: "" },
      { partial: true, householdId: HH }
    );
    expect(data.storeName).toBeNull();
    expect(data.memo).toBeNull();
  });

  it("storeName が長すぎるとエラー", async () => {
    const { error } = await validateExpenseInput(
      { storeName: "a".repeat(101) },
      { partial: true, householdId: HH }
    );
    expect(error?.field).toBe("storeName");
  });
});
