// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect } from "vitest";
import { useImeComposition } from "./use-ime-composition";

describe("useImeComposition", () => {
  it("初期は変換中ではない", () => {
    const { result } = renderHook(() => useImeComposition());
    expect(result.current.isComposing()).toBe(false);
  });

  it("compositionStart で変換中・compositionEnd で解除", () => {
    const { result } = renderHook(() => useImeComposition());
    act(() => result.current.bind.onCompositionStart());
    expect(result.current.isComposing()).toBe(true);
    act(() => result.current.bind.onCompositionEnd());
    expect(result.current.isComposing()).toBe(false);
  });

  it("bind ハンドラと isComposing は再レンダ間で安定参照", () => {
    const { result, rerender } = renderHook(() => useImeComposition());
    const first = result.current;
    rerender();
    expect(result.current.isComposing).toBe(first.isComposing);
    expect(result.current.bind.onCompositionStart).toBe(
      first.bind.onCompositionStart
    );
  });
});
