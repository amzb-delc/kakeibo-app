"use client";

import { useEffect, useRef } from "react";
import { lastDayOfMonth } from "@/lib/date";

const ITEM_H = 36;
const VISIBLE = 3; // 奇数。中央が選択
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;

type Props = {
  year: number;
  month: number; // 1-12
  value: number; // 選択中の日
  onChange: (day: number) => void;
  disabled?: boolean;
};

// 日のみを縦ホイール（ドラム）で選ぶ。「YYYY年M月 [d] 日」の d としてインライン表示する想定。
export function DayWheel({ year, month, value, onChange, disabled }: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastDay = lastDayOfMonth(year, month);
  const days = Array.from({ length: lastDay }, (_, i) => i + 1);

  // 初期位置 & value 外部変更時にスクロール位置を同期
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = (value - 1) * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [value]);

  const handleScroll = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const idx = Math.round(el.scrollTop / ITEM_H);
      const day = Math.min(Math.max(idx + 1, 1), lastDay);
      const snapTop = (day - 1) * ITEM_H;
      if (Math.abs(el.scrollTop - snapTop) > 1) {
        el.scrollTo({ top: snapTop, behavior: "smooth" });
      }
      if (day !== value) onChange(day);
    }, 90);
  };

  return (
    <div
      className="relative w-9 select-none"
      style={{ height: VISIBLE * ITEM_H }}
    >
      {/* 上下のフェード（中央の選択日だけ濃く見せる） */}
      <div
        className="pointer-events-none absolute inset-x-0 top-0 z-10 bg-gradient-to-b from-card via-card/70 to-transparent"
        style={{ height: PAD }}
      />
      <div
        className="pointer-events-none absolute inset-x-0 bottom-0 z-10 bg-gradient-to-t from-card via-card/70 to-transparent"
        style={{ height: PAD }}
      />

      <div
        ref={ref}
        onScroll={disabled ? undefined : handleScroll}
        className={`h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div style={{ height: PAD }} />
        {days.map((d) => (
          <button
            key={d}
            type="button"
            tabIndex={-1}
            onClick={() => {
              ref.current?.scrollTo({ top: (d - 1) * ITEM_H, behavior: "smooth" });
              onChange(d);
            }}
            className="flex w-full snap-center items-center justify-center"
            style={{ height: ITEM_H }}
          >
            <span
              className={`tabular-nums leading-none transition-all ${
                d === value
                  ? "text-xl font-bold text-foreground"
                  : "text-base font-normal text-muted-foreground/40"
              }`}
            >
              {d}
            </span>
          </button>
        ))}
        <div style={{ height: PAD }} />
      </div>
    </div>
  );
}
