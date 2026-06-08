// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, renderHook, screen, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useToast, Toast } from "./toast";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("useToast", () => {
  it("初期状態は message=null、show() でセットされる", () => {
    const { result } = renderHook(() => useToast());
    expect(result.current.message).toBeNull();
    act(() => result.current.show("保存しました"));
    expect(result.current.message).toBe("保存しました");
  });

  it("2200ms 後に自動で消える", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show("削除しました"));
    act(() => {
      vi.advanceTimersByTime(2199);
    });
    expect(result.current.message).toBe("削除しました");
    act(() => {
      vi.advanceTimersByTime(1);
    });
    expect(result.current.message).toBeNull();
  });

  it("連続 show() でタイマーがリセットされ、最後のメッセージ基準で消える", () => {
    const { result } = renderHook(() => useToast());
    act(() => result.current.show("A"));
    act(() => {
      vi.advanceTimersByTime(2000);
    });
    act(() => result.current.show("B"));
    // A 基準なら 2200ms で消えるはずだが、リセットされているので B が残る
    act(() => {
      vi.advanceTimersByTime(300);
    });
    expect(result.current.message).toBe("B");
    // B 基準で 2200ms 到達 → 消える
    act(() => {
      vi.advanceTimersByTime(1900);
    });
    expect(result.current.message).toBeNull();
  });
});

describe("Toast", () => {
  it("message があれば status ロールで表示", () => {
    render(<Toast message="やった" />);
    expect(screen.getByRole("status")).toHaveTextContent("やった");
  });

  it("message が null なら何も描画しない", () => {
    const { container } = render(<Toast message={null} />);
    expect(container.firstChild).toBeNull();
  });
});
