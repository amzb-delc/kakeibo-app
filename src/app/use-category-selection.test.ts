// @vitest-environment jsdom
import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { useCategorySelection } from "./use-category-selection";
import type { MonthlySummary } from "@/types";

const SUMMARY: MonthlySummary = {
  year: 2026,
  month: 6,
  total: 150,
  compareTotal: null,
  boxStats: null,
  categories: [
    { categoryId: "a", name: "食費", sortOrder: 0, total: 100, compareTotal: null, boxStats: null, expenses: [] },
    { categoryId: "b", name: "日用品", sortOrder: 1, total: 50, compareTotal: null, boxStats: null, expenses: [] },
  ],
};

const baseOpts = (over: Partial<Parameters<typeof useCategorySelection>[0]> = {}) => ({
  summary: SUMMARY,
  year: 2026,
  month: 6,
  mutationVersion: 0,
  lastMutatedCategoryId: null,
  setComposeContext: vi.fn(),
  ...over,
});

afterEach(() => {
  cleanup();
});

describe("useCategorySelection", () => {
  it("初期は最大カテゴリ(total最大)を自動選択", () => {
    const { result } = renderHook(() => useCategorySelection(baseOpts()));
    expect(result.current.openCategoryId).toBe("a");
  });

  it("toggleCategory で選択を切替える", () => {
    const { result } = renderHook(() => useCategorySelection(baseOpts()));
    act(() => result.current.toggleCategory("b"));
    expect(result.current.openCategoryId).toBe("b");
  });

  it("setComposeContext に year/month/選択カテゴリを公開", () => {
    const setComposeContext = vi.fn();
    renderHook(() => useCategorySelection(baseOpts({ setComposeContext })));
    expect(setComposeContext).toHaveBeenCalledWith({
      year: 2026,
      month: 6,
      categoryId: "a",
    });
  });

  it("CRUD 後 lastMutatedCategoryId に選択を同期", () => {
    const setComposeContext = vi.fn();
    const { result, rerender } = renderHook(
      (p: Parameters<typeof useCategorySelection>[0]) => useCategorySelection(p),
      { initialProps: baseOpts({ setComposeContext }) }
    );
    expect(result.current.openCategoryId).toBe("a");
    rerender(baseOpts({ setComposeContext, mutationVersion: 1, lastMutatedCategoryId: "b" }));
    expect(result.current.openCategoryId).toBe("b");
  });
});
