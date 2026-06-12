// 6ヶ月の縦型積み上げ棒グラフ（自前SVG）。donut-chart.tsx 同様 recharts 等は使わない。
// 6本固定の縦棒（古い月が左・表示月が右端）を、各月の byCategory を sortOrder 昇順で
// 下から積み上げて描画する。色は category-color.ts の categoryColor(sortOrder).hex。
//
// selectedCategoryId を渡すと「そのカテゴリのみの単色棒」に切り替わる（解除で積み上げに戻る）。
// 高さは 6ヶ月の最大合計（単独カテゴリ選択時はそのカテゴリの最大額）で正規化する。

import { categoryColor } from "@/lib/category-color";
import { formatYen } from "@/lib/format";
import type { SixMonthSummary } from "@/types";

// viewBox の論理サイズ。実表示は親要素幅にスケールする。
const VIEW_W = 360;
const VIEW_H = 220;
const PAD_X = 12; // 左右の余白
const LABEL_H = 22; // 月ラベル帯の高さ
const TOTAL_H = 18; // 合計額ラベル帯の高さ（棒の上）
const GAP_RATIO = 0.34; // 棒間の隙間（バー幅に対する比率）

// "YYYY-MM" → 月ラベル。年が変わる棒（または先頭）だけ "'25 12月" のように年付きにする。
function monthLabel(ym: string, prevYm: string | null): { year: string | null; month: string } {
  const [y, m] = ym.split("-");
  const month = `${parseInt(m, 10)}月`;
  const prevYear = prevYm ? prevYm.split("-")[0] : null;
  const showYear = prevYear === null || prevYear !== y;
  return { year: showYear ? `'${y.slice(2)}` : null, month };
}

type Props = {
  data: SixMonthSummary[];
  // 単独カテゴリ比較モード（その categoryId のみの単色棒）。null=積み上げ。
  selectedCategoryId: string | null;
  selectedSortOrder: number | null;
};

export function StackedBarChart({ data, selectedCategoryId, selectedSortOrder }: Props) {
  // 各棒の「描画に使う合計」: 通常は month.total、単独選択時はそのカテゴリの total。
  const barTotals = data.map((m) => {
    if (selectedCategoryId === null) return m.total;
    const hit = m.byCategory.find((c) => c.categoryId === selectedCategoryId);
    return hit ? hit.total : 0;
  });
  const maxTotal = Math.max(...barTotals, 1); // 0除算回避

  const n = data.length || 1;
  const innerW = VIEW_W - PAD_X * 2;
  const slot = innerW / n;
  const barW = slot / (1 + GAP_RATIO);
  const gap = slot - barW;

  // 棒の描画領域（上の合計ラベル帯と下の月ラベル帯を除いた高さ）
  const chartTop = TOTAL_H;
  const chartBottom = VIEW_H - LABEL_H;
  const chartH = chartBottom - chartTop;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto"
        role="img"
        aria-label="過去6ヶ月の支出比較グラフ"
      >
        {/* ベースライン */}
        <line
          x1={PAD_X}
          y1={chartBottom}
          x2={VIEW_W - PAD_X}
          y2={chartBottom}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        {data.map((month, i) => {
          const x = PAD_X + slot * i + gap / 2;
          const barTotal = barTotals[i];
          const barH = (barTotal / maxTotal) * chartH;
          const isLast = i === data.length - 1;

          // 積み上げる対象セグメント（単独選択時はそのカテゴリだけ）
          const segments =
            selectedCategoryId === null
              ? [...month.byCategory].sort((a, b) => a.sortOrder - b.sortOrder)
              : month.byCategory.filter((c) => c.categoryId === selectedCategoryId);

          // 下から積む（y は上端基準なので chartBottom から差し引いていく）
          let stackBottom = chartBottom;
          const rects = segments
            .filter((s) => s.total > 0)
            .map((s) => {
              const h = (s.total / maxTotal) * chartH;
              const y = stackBottom - h;
              stackBottom = y;
              const color =
                selectedSortOrder !== null
                  ? categoryColor(selectedSortOrder).hex
                  : categoryColor(s.sortOrder).hex;
              return { categoryId: s.categoryId, y, h, color };
            });

          const { year, month: mLabel } = monthLabel(
            month.ym,
            i > 0 ? data[i - 1].ym : null,
          );

          return (
            <g key={month.ym}>
              {/* 空棒（total=0）はベースライン上に薄い目盛りだけ残す */}
              {barTotal === 0 && (
                <rect
                  x={x}
                  y={chartBottom - 2}
                  width={barW}
                  height={2}
                  rx={1}
                  fill="#e5e7eb"
                />
              )}
              {/* 積み上げセグメント */}
              {rects.map((r, ri) => {
                // 角丸は最上段だけ（積み上げの一体感を出す）
                const isTop = ri === rects.length - 1;
                return (
                  <rect
                    key={r.categoryId}
                    x={x}
                    y={r.y}
                    width={barW}
                    height={r.h}
                    rx={isTop ? 3 : 0}
                    fill={r.color}
                  />
                );
              })}
              {/* 合計額ラベル（表示月＝右端の棒のみ。スペース節約） */}
              {isLast && barTotal > 0 && (
                <text
                  x={x + barW / 2}
                  y={chartBottom - barH - 5}
                  textAnchor="middle"
                  className="fill-foreground"
                  style={{ fontSize: "11px", fontWeight: 600 }}
                >
                  {formatYen(barTotal)}
                </text>
              )}
              {/* 月ラベル */}
              <text
                x={x + barW / 2}
                y={chartBottom + 14}
                textAnchor="middle"
                className={isLast ? "fill-foreground" : "fill-muted-foreground"}
                style={{ fontSize: "10px", fontWeight: isLast ? 600 : 400 }}
              >
                {year ? `${year} ${mLabel}` : mLabel}
              </text>
            </g>
          );
        })}
      </svg>
    </div>
  );
}
