// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  render,
  renderHook,
  screen,
  fireEvent,
  act,
  cleanup,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useBottomSheet, BottomSheet } from "./bottom-sheet";

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  // globals 無効のため RTL の自動クリーンアップが効かない。明示的に DOM を破棄する。
  cleanup();
  vi.useRealTimers();
});

// 疑似ポインタイベントを作る。target.closest は null（ボタン外）を返す。
function makePointerEvent(clientY: number) {
  return {
    clientY,
    pointerId: 1,
    target: { closest: () => null },
    currentTarget: { setPointerCapture() {} },
  };
}

describe("useBottomSheet", () => {
  it("初期状態は mounted=false、draggable 未指定なら dragHandlers は空", () => {
    const { result } = renderHook(() => useBottomSheet());
    expect(result.current.mounted).toBe(false);
    expect(result.current.dragHandlers.onPointerDown).toBeUndefined();
  });

  it("open() で mounted=true になる", () => {
    const { result } = renderHook(() => useBottomSheet());
    act(() => {
      result.current.open();
    });
    expect(result.current.mounted).toBe(true);
  });

  it("close() は ANIM_MS(320ms) 後に mounted=false かつ onClosed を1回呼ぶ", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useBottomSheet({ onClosed }));
    act(() => {
      result.current.open();
    });
    expect(result.current.mounted).toBe(true);

    act(() => {
      result.current.close();
    });
    // まだアニメ中
    expect(result.current.mounted).toBe(true);
    expect(onClosed).not.toHaveBeenCalled();

    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(result.current.mounted).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("Escape キーで close される", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() => useBottomSheet({ onClosed }));
    act(() => {
      result.current.open();
    });
    expect(result.current.mounted).toBe(true);

    act(() => {
      fireEvent.keyDown(window, { key: "Escape" });
    });
    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(result.current.mounted).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("draggable:true なら dragHandlers に各 onPointer 関数が入る", () => {
    const { result } = renderHook(() => useBottomSheet({ draggable: true }));
    expect(typeof result.current.dragHandlers.onPointerDown).toBe("function");
    expect(typeof result.current.dragHandlers.onPointerMove).toBe("function");
    expect(typeof result.current.dragHandlers.onPointerUp).toBe("function");
    expect(typeof result.current.dragHandlers.onPointerCancel).toBe("function");
  });

  it("dy が閾値(110)を超えるドラッグで close される", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() =>
      useBottomSheet({ draggable: true, onClosed })
    );
    act(() => {
      result.current.open();
    });

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.dragHandlers.onPointerDown?.(makePointerEvent(0) as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.dragHandlers.onPointerUp?.(makePointerEvent(200) as any);
    });
    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(result.current.mounted).toBe(false);
    expect(onClosed).toHaveBeenCalledTimes(1);
  });

  it("小さいドラッグ(dy=10)では閉じず mounted=true のまま", () => {
    const onClosed = vi.fn();
    const { result } = renderHook(() =>
      useBottomSheet({ draggable: true, onClosed })
    );
    act(() => {
      result.current.open();
    });

    act(() => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.dragHandlers.onPointerDown?.(makePointerEvent(0) as any);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      result.current.dragHandlers.onPointerUp?.(makePointerEvent(10) as any);
    });
    act(() => {
      vi.advanceTimersByTime(320);
    });
    expect(result.current.mounted).toBe(true);
    expect(onClosed).not.toHaveBeenCalled();
  });
});

describe("BottomSheet", () => {
  const baseProps = {
    ariaLabel: "テストシート",
    title: "タイトル",
    panelStyle: {},
    backdropStyle: {},
  };

  it("role=dialog・aria-label・title・children を表示する", () => {
    render(
      <BottomSheet {...baseProps} onClose={() => {}}>
        <p>本文コンテンツ</p>
      </BottomSheet>
    );
    const dialog = screen.getByRole("dialog");
    expect(dialog).toBeInTheDocument();
    expect(dialog).toHaveAttribute("aria-label", "テストシート");
    expect(screen.getByText("タイトル")).toBeInTheDocument();
    expect(screen.getByText("本文コンテンツ")).toBeInTheDocument();
  });

  it("✕ ボタンクリックで onClose が呼ばれる", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet {...baseProps} onClose={onClose}>
        <p>本文</p>
      </BottomSheet>
    );
    fireEvent.click(screen.getByLabelText("閉じる"));
    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it("headerActions が描画される", () => {
    render(
      <BottomSheet
        {...baseProps}
        onClose={() => {}}
        headerActions={<button>削除</button>}
      >
        <p>本文</p>
      </BottomSheet>
    );
    expect(screen.getByText("削除")).toBeInTheDocument();
  });

  it("パネル本文クリックでは onClose が呼ばれない（stopPropagation）", () => {
    const onClose = vi.fn();
    render(
      <BottomSheet {...baseProps} onClose={onClose}>
        <p>本文コンテンツ</p>
      </BottomSheet>
    );
    fireEvent.click(screen.getByText("本文コンテンツ"));
    expect(onClose).not.toHaveBeenCalled();
  });
});

describe("背面スクロールロック（多重シート対応 / SL-1）", () => {
  beforeEach(() => {
    document.body.style.cssText = "";
    // jsdom の scrollY は 0 固定なので、復元位置の検証用に値を差し込む。
    Object.defineProperty(window, "scrollY", { value: 100, configurable: true });
    window.scrollTo = vi.fn();
  });

  it("開くと body を fixed で固定し、閉じると元のスタイル＋スクロール位置へ戻す", () => {
    const { result } = renderHook(() => useBottomSheet());
    act(() => result.current.open());
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-100px");

    act(() => result.current.close());
    act(() => vi.advanceTimersByTime(320));
    expect(document.body.style.position).toBe("");
    expect(document.body.style.top).toBe("");
    expect(window.scrollTo).toHaveBeenCalledWith(0, 100);
  });

  it("2枚重ねても固定は1度だけ。1枚目を閉じても固定は維持し、最後の1枚で復元する", () => {
    const a = renderHook(() => useBottomSheet());
    const b = renderHook(() => useBottomSheet());

    act(() => a.result.current.open());
    expect(document.body.style.position).toBe("fixed");
    expect(document.body.style.top).toBe("-100px");

    // 2枚目を開く。既に固定中なので捕捉し直さず top は 1枚目の値のまま。
    act(() => b.result.current.open());
    expect(document.body.style.top).toBe("-100px");

    // 1枚目を閉じる → まだ 2枚目が開いているので固定は維持（早期復元しない）。
    act(() => a.result.current.close());
    act(() => vi.advanceTimersByTime(320));
    expect(document.body.style.position).toBe("fixed");

    // 2枚目を閉じる → ここで初めて復元される。
    act(() => b.result.current.close());
    act(() => vi.advanceTimersByTime(320));
    expect(document.body.style.position).toBe("");
    expect(window.scrollTo).toHaveBeenLastCalledWith(0, 100);
  });
});
