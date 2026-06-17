// 6ヶ月の縦型積み上げ棒グラフ（自前SVG）。donut-chart.tsx 同様 recharts 等は使わない。
// 6本固定の縦棒（古い月が左・表示月が右端）を、各月の byCategory を sortOrder 昇順で
// 下から積み上げて描画する。色は category-color.ts の categoryColor(sortOrder).hex。
//
// selectedCategoryIds（複数選択）を渡すと「選択カテゴリのみの積み上げ棒」に切り替わる
// （空集合で全カテゴリ積み上げに戻る）。各セグメント色は categoryColor(sortOrder) のまま。
// 高さは 6ヶ月の最大合計（選択ありのときは選択カテゴリ合計の最大額）で正規化する。

import { categoryColor } from "@/lib/category-color";
import type { SixMonthSummary } from "@/types";

// viewBox の論理サイズ。実表示は親要素幅にスケールする。
const VIEW_W = 360;
const VIEW_H = 220;
const PAD_X = 12; // 左右の余白
const AXIS_W = 24; // 左の目盛ラベル用ガター（棒の描画域はこの分だけ右に寄せる）
const LABEL_H = 22; // 月ラベル帯の高さ
const TOTAL_H = 18; // 合計額ラベル帯の高さ（棒の上）
const GAP_RATIO = 0.34; // 棒間の隙間（バー幅に対する比率）

// 積み上げ表示時のセグメント不透明度（全体・選択時とも積み上げなので共通）。
const STACK_FILL_OPACITY = 0.6;

// "YYYY-MM" → 月ラベル。年が変わる棒（または先頭）だけ "'25 12月" のように年付きにする。
function monthLabel(ym: string, prevYm: string | null): { year: string | null; month: string } {
  const [y, m] = ym.split("-");
  const month = `${parseInt(m, 10)}月`;
  const prevYear = prevYm ? prevYm.split("-")[0] : null;
  const showYear = prevYear === null || prevYear !== y;
  return { year: showYear ? `'${y.slice(2)}` : null, month };
}

// 棒の上に載せる合計額表記。省略しない（実質6桁まで・カンマ区切り）。0 は空。
function formatAmountLabel(amount: number): string {
  if (amount <= 0) return "";
  return amount.toLocaleString("ja-JP");
}

// 左の目盛ラベル用の短縮表記（ガターに収める）。1万以上は「5万」「100万」、未満はカンマ区切り。
// niceRound 由来の値は基本キリが良く、万単位は整数になる（小数が出たら1桁）。
function formatAxisLabel(amount: number): string {
  if (amount <= 0) return "";
  if (amount >= 10000) {
    const man = amount / 10000;
    const s = Number.isInteger(man) ? String(man) : man.toFixed(1);
    return `${s}万`;
  }
  return amount.toLocaleString("ja-JP");
}

// 目盛線に使う「キリの良い」金額を、与えた値の近傍から選ぶ（1/2/5 × 10^n に丸める）。
// frac 7.0〜9.99 は 10 に切り上がるため最大 1.43 倍まで上振れするが、2 倍未満なので
// gridValue が maxTotal を超えず目盛線が描画域上端を飛び出すことはない（近傍切り上げ寄り）。
function niceRound(value: number): number {
  if (value <= 0) return 0;
  const exp = Math.floor(Math.log10(value));
  const base = Math.pow(10, exp);
  const frac = value / base;
  const niceFrac = frac < 1.5 ? 1 : frac < 3 ? 2 : frac < 7 ? 5 : 10;
  return niceFrac * base;
}

type Props = {
  data: SixMonthSummary[];
  // 表示対象カテゴリの集合。空集合=全カテゴリ積み上げ。選択あり=選択カテゴリのみ積み上げ。
  selectedCategoryIds: Set<string>;
  // 表示中の月 "YYYY-MM"。一致する棒の月ラベルを強調（太字＋下線）する。null=強調なし。
  selectedYm: string | null;
};

export function StackedBarChart({
  data,
  selectedCategoryIds,
  selectedYm,
}: Props) {
  const hasSelection = selectedCategoryIds.size > 0;
  // 各棒の「描画に使う合計」: 通常は month.total、選択ありは選択カテゴリ合計。
  const barTotals = data.map((m) => {
    if (!hasSelection) return m.total;
    return m.byCategory
      .filter((c) => selectedCategoryIds.has(c.categoryId))
      .reduce((sum, c) => sum + c.total, 0);
  });
  const maxTotal = Math.max(...barTotals, 1); // 0除算回避

  const n = data.length || 1;
  // 左に目盛ラベル用ガター（AXIS_W）を確保し、棒の描画域はその分だけ右に寄せる。
  const plotLeft = PAD_X + AXIS_W;
  const innerW = VIEW_W - plotLeft - PAD_X;
  const slot = innerW / n;
  const barW = slot / (1 + GAP_RATIO);
  const gap = slot - barW;

  // 棒の描画領域（上の合計ラベル帯と下の月ラベル帯を除いた高さ）
  const chartTop = TOTAL_H;
  const chartBottom = VIEW_H - LABEL_H;
  const chartH = chartBottom - chartTop;

  // 金額の目盛線は1本。中央付近（maxTotal の半分）のキリの良い金額を選び、その値に
  // 対応する高さに引く（ラベルとの整合のため位置は中央固定にしない）。全月 0 のときは引かない。
  const gridValue = Math.max(...barTotals, 0) > 0 ? niceRound(maxTotal / 2) : 0;

  return (
    <div className="w-full">
      <svg
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        className="w-full h-auto"
        role="img"
        aria-label="過去6ヶ月の支出比較グラフ"
      >
        {/* 金額の目盛線（キリの良い金額1本）。線は薄いグレー。目盛値は左ガター内に
            短縮表記（「5万」等）で右寄せ配置し、棒・合計額と一切重ならないようにする。 */}
        {gridValue > 0 &&
          (() => {
            const gy = chartBottom - (gridValue / maxTotal) * chartH;
            return (
              <g>
                <line
                  x1={plotLeft}
                  y1={gy}
                  x2={VIEW_W - PAD_X}
                  y2={gy}
                  stroke="#e5e7eb"
                  strokeWidth={1}
                  strokeDasharray="2 3"
                />
                <text
                  x={plotLeft - 4}
                  y={gy}
                  dominantBaseline="central"
                  textAnchor="end"
                  className="fill-muted-foreground"
                  style={{ fontSize: "8px" }}
                >
                  {formatAxisLabel(gridValue)}
                </text>
              </g>
            );
          })()}
        {/* ベースライン */}
        <line
          x1={plotLeft}
          y1={chartBottom}
          x2={VIEW_W - PAD_X}
          y2={chartBottom}
          stroke="#e5e7eb"
          strokeWidth={1}
        />
        {data.map((month, i) => {
          const x = plotLeft + slot * i + gap / 2;
          const barTotal = barTotals[i];
          const barH = (barTotal / maxTotal) * chartH;
          // 表示中の月（窓内のどこにあるか不定）の棒を強調する
          const isCurrent = selectedYm !== null && month.ym === selectedYm;
          // 全体・選択時とも積み上げなのでセグメントは一律に薄くする
          const fillOpacity = STACK_FILL_OPACITY;

          // 積み上げる対象セグメント（選択ありは選択カテゴリだけ）。常に sortOrder 昇順で下から積む。
          const segments = (
            hasSelection
              ? month.byCategory.filter((c) => selectedCategoryIds.has(c.categoryId))
              : [...month.byCategory]
          ).sort((a, b) => a.sortOrder - b.sortOrder);

          // 下から積む（y は上端基準なので chartBottom から差し引いていく）
          let stackBottom = chartBottom;
          const rects = segments
            .filter((s) => s.total > 0)
            .map((s) => {
              const h = (s.total / maxTotal) * chartH;
              const y = stackBottom - h;
              stackBottom = y;
              return {
                categoryId: s.categoryId,
                y,
                h,
                color: categoryColor(s.sortOrder).hex,
              };
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
                    fillOpacity={fillOpacity}
                  />
                );
              })}
              {/* 合計額ラベル（全6本・省略なし）。表示月は太字で強調 */}
              {barTotal > 0 && (
                <text
                  x={x + barW / 2}
                  y={chartBottom - barH - 4}
                  textAnchor="middle"
                  className={isCurrent ? "fill-foreground" : "fill-muted-foreground"}
                  style={{ fontSize: "9px", fontWeight: isCurrent ? 700 : 500 }}
                >
                  {formatAmountLabel(barTotal)}
                </text>
              )}
              {/* 月ラベル。表示中の月は太字＋下線で強調（右端とは限らないため） */}
              <text
                x={x + barW / 2}
                y={chartBottom + 14}
                textAnchor="middle"
                className={isCurrent ? "fill-foreground" : "fill-muted-foreground"}
                style={{
                  fontSize: "10px",
                  fontWeight: isCurrent ? 700 : 400,
                  textDecoration: isCurrent ? "underline" : "none",
                }}
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
