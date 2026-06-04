// シンプルな静的ドーナツ。<circle> + stroke-dasharray で各セグメントを描画する方式。
// (path arc 方式と違い 100% セグメントが破綻しないのが利点)
// 中央には任意の JSX を重ねられる。

import type { ReactNode } from "react";

export type DonutSegment = {
  id?: string; // React key 用。未指定なら index にフォールバック
  value: number;
  color: string; // 実 hex（Tailwind class ではない）
};

type Props = {
  segments: DonutSegment[];
  size?: number; // viewBox の論理サイズ。実表示は親要素幅にスケール
  ringWidth?: number;
  emptyColor?: string;
  children?: ReactNode;
};

export function DonutChart({
  segments,
  size = 200,
  ringWidth = 22,
  emptyColor = "#e5e7eb",
  children,
}: Props) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  // stroke の中央線が半径になるよう ringWidth の半分を内側に寄せる
  const r = (size - ringWidth) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs =
    total > 0
      ? segments.map((seg, i) => {
          const segLen = (seg.value / total) * circumference;
          const dash = `${segLen} ${circumference - segLen}`;
          const dashOffset = -offset;
          offset += segLen;
          return (
            <circle
              key={seg.id ?? i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={ringWidth}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
            />
          );
        })
      : null;

  return (
    <div className="relative aspect-square w-full">
      <svg
        viewBox={`0 0 ${size} ${size}`}
        className="w-full h-full"
        aria-hidden="true"
      >
        {/* 背景リング（セグメント間の隙間や empty 表示用） */}
        <circle
          cx={cx}
          cy={cy}
          r={r}
          fill="none"
          stroke={emptyColor}
          strokeWidth={ringWidth}
        />
        {/* セグメントは 12 時方向から時計回りに */}
        <g transform={`rotate(-90 ${cx} ${cy})`}>{arcs}</g>
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center text-center px-6">
        {children}
      </div>
    </div>
  );
}
