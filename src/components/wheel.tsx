"use client";

import { useEffect, useRef } from "react";

const ITEM_H = 36;
const VISIBLE = 3; // 奇数。中央が選択
const PAD = ((VISIBLE - 1) / 2) * ITEM_H;
// loop 時に前後へ持たせるバッファ。選択肢をこの数だけ繰り返し、中央コピーへ寄せ続ける。
const LOOP_COPIES = 21; // 奇数

type Props = {
  values: number[]; // 昇順の選択肢
  value: number; // 選択中の値
  onChange: (value: number) => void;
  disabled?: boolean;
  loop?: boolean; // 端で巡回する（12→1 / 31→1 とその逆）。月・日で使う
  className?: string; // 幅など（既定 w-9）。年は桁が多いので広めを渡す
  ariaLabel?: string;
};

// 数値を縦ホイール（ドラム）で選ぶ汎用コンポーネント。年/月/日で使い回す。
// loop=true のときは選択肢を繰り返し描画し、確定のたびに中央コピー（同じ値が映る位置）へ
// 瞬間移動することで、内容が周期的＝継ぎ目なく無限に回せる。
export function Wheel({
  values,
  value,
  onChange,
  disabled,
  loop = false,
  className = "w-9",
  ariaLabel,
}: Props) {
  const ref = useRef<HTMLDivElement>(null);
  const settle = useRef<ReturnType<typeof setTimeout> | null>(null);
  const len = values.length;
  const copies = loop ? LOOP_COPIES : 1;
  const center = (copies - 1) / 2; // 中央コピーの番号
  const valIdx = Math.max(0, values.indexOf(value));
  // スクロール位置の同期先（loop は中央コピーに value を置く）
  const centeredIndex = loop ? center * len + valIdx : valIdx;

  // 初期位置 & value 変更時にスクロール位置を同期
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const target = centeredIndex * ITEM_H;
    if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
  }, [centeredIndex]);

  const handleScroll = () => {
    if (settle.current) clearTimeout(settle.current);
    settle.current = setTimeout(() => {
      const el = ref.current;
      if (!el) return;
      const gi = Math.round(el.scrollTop / ITEM_H); // 全体での item インデックス
      if (loop) {
        const v = values[((gi % len) + len) % len];
        // 中央コピーの同じ値へ瞬間移動（内容が周期的なので継ぎ目なし＝無限ループ）
        const target = (center * len + values.indexOf(v)) * ITEM_H;
        if (Math.abs(el.scrollTop - target) > 1) el.scrollTop = target;
        if (v !== value) onChange(v);
      } else {
        const i = Math.min(Math.max(gi, 0), len - 1);
        const snapTop = i * ITEM_H;
        if (Math.abs(el.scrollTop - snapTop) > 1) {
          el.scrollTo({ top: snapTop, behavior: "smooth" });
        }
        if (values[i] !== value) onChange(values[i]);
      }
    }, 90);
  };

  const items = loop
    ? Array.from({ length: copies * len }, (_, i) => values[i % len])
    : values;

  return (
    <div
      className={`relative select-none ${className}`}
      style={{ height: VISIBLE * ITEM_H }}
    >
      {/* 上下のフェード（中央の選択値だけ濃く見せる） */}
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
        role="listbox"
        aria-label={ariaLabel}
        onScroll={disabled ? undefined : handleScroll}
        className={`h-full overflow-y-scroll snap-y snap-mandatory scrollbar-hide ${
          disabled ? "pointer-events-none opacity-50" : ""
        }`}
      >
        <div style={{ height: PAD }} />
        {items.map((v, i) => (
          <button
            key={i}
            type="button"
            tabIndex={-1}
            onClick={() => {
              ref.current?.scrollTo({ top: i * ITEM_H, behavior: "smooth" });
              onChange(v);
            }}
            className="flex w-full snap-center items-center justify-center"
            style={{ height: ITEM_H }}
          >
            <span
              className={`tabular-nums leading-none transition-all ${
                v === value
                  ? "text-lg font-semibold text-foreground"
                  : "text-sm font-normal text-muted-foreground/40"
              }`}
            >
              {v}
            </span>
          </button>
        ))}
        <div style={{ height: PAD }} />
      </div>
    </div>
  );
}
