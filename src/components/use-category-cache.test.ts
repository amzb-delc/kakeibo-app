// @vitest-environment jsdom
import { renderHook, waitFor, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// useSession をモックして unlocked を制御する。
const { unlockedRef } = vi.hoisted(() => ({
  unlockedRef: { current: true as boolean | null },
}));
vi.mock("@/components/session-provider", () => ({
  useSession: () => ({ unlocked: unlockedRef.current }),
}));

import { useCategoryCache } from "./use-category-cache";

const CATS = [{ id: "c1", name: "食費", sortOrder: 0, enabled: true }];

beforeEach(() => {
  unlockedRef.current = true;
  vi.stubGlobal(
    "fetch",
    vi.fn(() => Promise.resolve({ ok: true, json: () => Promise.resolve(CATS) }))
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("useCategoryCache", () => {
  it("unlocked のとき scope=all を取得して categories/loaded をセット", async () => {
    const { result } = renderHook(() => useCategoryCache());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(result.current.categories).toEqual(CATS);
    expect(fetch).toHaveBeenCalledWith("/api/categories?scope=all");
  });

  it("未保存(unlocked=false)のときは取得しない", () => {
    unlockedRef.current = false;
    const { result } = renderHook(() => useCategoryCache());
    expect(fetch).not.toHaveBeenCalled();
    expect(result.current.loaded).toBe(false);
    expect(result.current.categories).toEqual([]);
  });

  it("refresh() で version を増分して再取得する", async () => {
    const { result } = renderHook(() => useCategoryCache());
    await waitFor(() => expect(result.current.loaded).toBe(true));
    expect(fetch).toHaveBeenCalledTimes(1);
    act(() => result.current.refresh());
    await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  });
});
