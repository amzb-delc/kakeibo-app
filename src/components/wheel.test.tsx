// @vitest-environment jsdom
import { render, cleanup, act } from "@testing-library/react";
import { useState } from "react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { Wheel } from "./wheel";

// wheel.tsx の内部定数（テストの位置計算に必要）。実装と一致させること。
const ITEM_H = 36;
const LOOP_COPIES = 21;
const CENTER = (LOOP_COPIES - 1) / 2; // 中央コピー番号 = 10
const SETTLE_MS = 90; // handleScroll のスクロール停止判定タイマ

beforeEach(() => {
  vi.useFakeTimers();
  // jsdom は Element.scrollTo を実装しないため、scrollTop を更新するスタブを入れる
  // （非ループ分岐の snap で使われる）。
  // @ts-expect-error テスト用スタブ
  Element.prototype.scrollTo = function (opts: { top?: number }) {
    if (opts && typeof opts.top === "number") this.scrollTop = opts.top;
  };
});

afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

// value を state で保持し、onChange を観測できるハーネス。
function Harness({
  values,
  initial,
  loop,
  onValue,
}: {
  values: number[];
  initial: number;
  loop?: boolean;
  onValue: (v: number) => void;
}) {
  const [value, setValue] = useState(initial);
  return (
    <Wheel
      values={values}
      value={value}
      loop={loop}
      onChange={(v) => {
        setValue(v);
        onValue(v);
      }}
      ariaLabel="wheel"
    />
  );
}

function setup(props: {
  values: number[];
  initial: number;
  loop?: boolean;
}) {
  const onValue = vi.fn();
  const { container } = render(<Harness {...props} onValue={onValue} />);
  const el = container.querySelector('[role="listbox"]') as HTMLDivElement;
  return { el, onValue };
}

// scrollTop を設定して scroll イベントを発火し、settle タイマを進める。
function scrollTo(el: HTMLDivElement, top: number) {
  act(() => {
    el.scrollTop = top;
    el.dispatchEvent(new Event("scroll"));
  });
  act(() => {
    vi.advanceTimersByTime(SETTLE_MS);
  });
}

const MONTHS = Array.from({ length: 12 }, (_, i) => i + 1); // [1..12]

describe("Wheel（汎用ドラム）", () => {
  describe("loop=true の巡回", () => {
    it("先頭から1つ手前へスクロールすると末尾へ巡回し、中央コピーへ瞬間移動する", () => {
      // value=1（valIdx=0）。初期 scrollTop = CENTER*len*ITEM_H。
      const { el, onValue } = setup({ values: MONTHS, initial: 1, loop: true });
      const base = CENTER * MONTHS.length; // 120
      // 1つ上（手前）へスクロール → 12 に巡回するはず。
      scrollTo(el, (base - 1) * ITEM_H);
      expect(onValue).toHaveBeenCalledWith(12);
      // 中央コピーの 12 の位置へ瞬間移動している。
      const expectedTop = (base + MONTHS.indexOf(12)) * ITEM_H; // (120+11)*36
      expect(el.scrollTop).toBe(expectedTop);
    });

    it("末尾から1つ先へスクロールすると先頭へ巡回する", () => {
      const { el, onValue } = setup({ values: MONTHS, initial: 12, loop: true });
      const base = CENTER * MONTHS.length; // 120
      const startTop = (base + MONTHS.indexOf(12)) * ITEM_H; // 12 の中央位置
      scrollTo(el, startTop + ITEM_H); // 1つ先 → 1 へ巡回
      expect(onValue).toHaveBeenCalledWith(1);
      expect(el.scrollTop).toBe(base * ITEM_H);
    });

    it("同じ値の位置で止まったら onChange は呼ばない", () => {
      const { el, onValue } = setup({ values: MONTHS, initial: 1, loop: true });
      const base = CENTER * MONTHS.length;
      scrollTo(el, base * ITEM_H); // 1 のまま
      expect(onValue).not.toHaveBeenCalled();
    });
  });

  describe("loop=false のスナップ", () => {
    it("中間位置で止まると最寄りの値へスナップして onChange する", () => {
      const years = [2021, 2022, 2023, 2024, 2025, 2026];
      // value=2026（valIdx=5）。非ループは centeredIndex = valIdx。
      const { el, onValue } = setup({ values: years, initial: 2026 });
      // index 3（2024）付近の半端な位置へ。
      scrollTo(el, 3 * ITEM_H + 10);
      expect(onValue).toHaveBeenCalledWith(2024);
      expect(el.scrollTop).toBe(3 * ITEM_H); // スナップ済み
    });
  });
});
