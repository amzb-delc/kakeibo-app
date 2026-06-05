import { describe, it, expect, vi } from "vitest";

// categories.ts は prisma を import するが、validateCategoryPatch は純粋なので
// prisma を空モックして DB 依存なしでテストする。
vi.mock("@/lib/prisma", () => ({ prisma: {} }));

import { validateCategoryPatch } from "./categories";

describe("validateCategoryPatch", () => {
  it("name を trim して返す", () => {
    expect(validateCategoryPatch({ name: "  食費  " })).toEqual({
      data: { name: "食費" },
    });
  });

  it("name が文字列でなければエラー", () => {
    expect(validateCategoryPatch({ name: 123 }).error?.field).toBe("name");
  });

  it("name が空白のみはエラー", () => {
    expect(validateCategoryPatch({ name: "   " }).error?.field).toBe("name");
  });

  it("name が20文字超はエラー", () => {
    expect(validateCategoryPatch({ name: "あ".repeat(21) }).error?.field).toBe(
      "name"
    );
  });

  it("enabled が真偽値でなければエラー", () => {
    expect(validateCategoryPatch({ enabled: "yes" }).error?.field).toBe(
      "enabled"
    );
  });

  it("更新対象が無ければエラー", () => {
    expect(validateCategoryPatch({}).error?.field).toBe("_");
  });

  it("name と enabled の同時指定は通る", () => {
    expect(validateCategoryPatch({ name: "光熱費", enabled: false })).toEqual({
      data: { name: "光熱費", enabled: false },
    });
  });
});
