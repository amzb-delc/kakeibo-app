// シンプルな静的ドーナツ。<circle> + stroke-dasharray で各セグメントを描画する方式。
// (path arc 方式と違い 100% セグメントが破綻しないのが利点)
// 中央には任意の JSX を重ねられる。

import type { ReactNode } from "react";

// 選択セグメントを太らせる量(px, viewBox 基準)。半径はこの分だけ内側に取り、
// 拡大しても viewBox からはみ出して見切れないようにする。減光が主役なので拡大は控えめに。
const SELECTED_BUMP = 2;
// 非選択／全体減光時の不透明度。
const DIM_OPACITY = 0.28;

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
  // 選択中セグメントの id。一致セグメントを太く強調し、他を減光する。
  // null/未指定なら全セグメントを等価に描画（ハイライトなし）。
  selectedId?: string | null;
  // 選択カテゴリが無い状態。全セグメントを一様に減光する（「どれも選ばれていない」を示す）。
  dimAll?: boolean;
  children?: ReactNode;
};

export function DonutChart({
  segments,
  size = 200,
  ringWidth = 22,
  emptyColor = "#e5e7eb",
  selectedId = null,
  dimAll = false,
  children,
}: Props) {
  const total = segments.reduce((sum, s) => sum + s.value, 0);
  const cx = size / 2;
  const cy = size / 2;
  // stroke の中央線が半径になるよう ringWidth の半分を内側に寄せる。
  // さらに選択時の拡大(SELECTED_BUMP)＋1px の安全余白ぶん内側へ取り、太らせても見切れないようにする。
  const r = (size - ringWidth - SELECTED_BUMP - 2) / 2;
  const circumference = 2 * Math.PI * r;

  let offset = 0;
  const arcs =
    total > 0
      ? segments.map((seg, i) => {
          const segLen = (seg.value / total) * circumference;
          const dash = `${segLen} ${circumference - segLen}`;
          const dashOffset = -offset;
          offset += segLen;
          // 選択中は太く・不透明、非選択は減光。dimAll のときは全て減光（選択なし）。
          const isSelected =
            !dimAll && selectedId != null && (seg.id ?? String(i)) === selectedId;
          const dimmed = dimAll || (selectedId != null && !isSelected);
          return (
            <circle
              key={seg.id ?? i}
              cx={cx}
              cy={cy}
              r={r}
              fill="none"
              stroke={seg.color}
              strokeWidth={isSelected ? ringWidth + SELECTED_BUMP : ringWidth}
              strokeOpacity={dimmed ? DIM_OPACITY : 1}
              strokeDasharray={dash}
              strokeDashoffset={dashOffset}
              className="transition-all duration-300"
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
