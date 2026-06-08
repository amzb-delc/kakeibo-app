// @vitest-environment jsdom
import { renderHook, act, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useMonthlySummary } from "./use-monthly-summary";
import type { MonthlySummary } from "@/types";

const SUMMARY: MonthlySummary = {
  year: 2026,
  month: 6,
  total: 0,
  compareTotal: null,
  boxStats: null,
  categories: [],
};

beforeEach(() => {
  vi.stubGlobal(
    "fetch",
    vi.fn(async () => ({ ok: true, json: async () => SUMMARY }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const opts = (over = {}) => ({
  unlocked: true,
  mutationVersion: 0,
  categoriesVersion: 0,
  ...over,
});

describe("useMonthlySummary", () => {
  it("unlocked のとき当月を取得し loading が戻る", async () => {
    const { result } = renderHook(() => useMonthlySummary(opts()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.summary).toEqual(SUMMARY);
    expect(result.current.isCurrentMonth).toBe(true);
    expect(fetch).toHaveBeenCalledTimes(1);
  });

  it("未保存(unlocked=false)では取得しない", () => {
    renderHook(() => useMonthlySummary(opts({ unlocked: false })));
    expect(fetch).not.toHaveBeenCalled();
  });

  it("goPrev で前月へ移り再取得（URLに前月）、isCurrentMonth=false", async () => {
    const { result } = renderHook(() => useMonthlySummary(opts()));
    await waitFor(() => expect(result.current.loading).toBe(false));
    const { year, month } = result.current;
    act(() => result.current.goPrev());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
    expect(result.current.isCurrentMonth).toBe(false);
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    expect(fetch).toHaveBeenLastCalledWith(
      `/api/monthly-summary?year=${prevYear}&month=${prevMonth}`
    );
  });
});
