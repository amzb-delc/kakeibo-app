"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getTrendLevel, TREND_TEXT_COLOR } from "@/lib/trend";
import { formatJstDate, formatJstDateLabel } from "@/lib/date";
import { categoryColor } from "@/lib/category-color";
import { useExpenseModal } from "@/components/expense-modal";
import { DonutChart } from "@/components/donut-chart";
import type { MonthlySummary, CategorySummary, BoxStats } from "@/types";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDiff(diff: number) {
  if (diff === 0) return "±¥0";
  const abs = Math.abs(diff).toLocaleString("ja-JP");
  return diff > 0 ? `+¥${abs}` : `-¥${abs}`;
}

// 過去6ヶ月の異常値検出バー（フィル方式）。
// 100% = 上フェンス(Q3+1.5*IQR)、超過時は 100% でクランプ。
// サンプル不足 (boxStats=null) はストライプ表示にして「判定不能」を視覚的に区別する。
function AnomalyBar({
  value,
  boxStats,
  fillClass,
}: {
  value: number;
  boxStats: BoxStats | null;
  fillClass: string;
}) {
  const isInsufficient = !boxStats || boxStats.upperFence <= 0;
  const targetFill = isInsufficient
    ? 0
    : Math.min((value / boxStats.upperFence) * 100, 100);

  // 初回マウント時も 0% → target にトランジションさせるため、1フレーム遅らせて反映
  const [renderedFill, setRenderedFill] = useState(0);
  useEffect(() => {
    if (isInsufficient) return;
    const id = requestAnimationFrame(() => setRenderedFill(targetFill));
    return () => cancelAnimationFrame(id);
  }, [targetFill, isInsufficient]);

  if (isInsufficient) {
    return (
      <div
        className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden"
        title="サンプル不足のため参考表示"
        aria-label="サンプル不足のため判定なし"
        style={{
          backgroundImage:
            "repeating-linear-gradient(45deg, transparent 0 4px, rgba(0,0,0,0.06) 4px 8px)",
        }}
      />
    );
  }

  const rounded = Math.round(targetFill);
  return (
    <div
      className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden"
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={rounded}
      aria-label={`直近6ヶ月の上限基準で ${rounded}%`}
    >
      <div
        className={`h-full rounded-full transition-all duration-500 ${fillClass}`}
        style={{ width: `${renderedFill}%` }}
      />
    </div>
  );
}

type CategoryRowProps = {
  category: CategorySummary;
  isOpen: boolean;
  onToggle: () => void;
};

function CategoryRow({ category, isOpen, onToggle }: CategoryRowProps) {
  const { openEdit } = useExpenseModal();
  // 今月視点で比較する: 今月 > 表示月 なら up(赤=今月の方が多い), 今月 < 表示月 なら down(緑=今月の方が少ない)
  const compareTotal = category.compareTotal;
  const level = compareTotal !== null ? getTrendLevel(compareTotal, category.total) : null;
  const diff = compareTotal !== null ? formatDiff(compareTotal - category.total) : null;
  const color = categoryColor(category.sortOrder);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        className="w-full text-left p-4 min-h-[56px] active:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <span
            className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-medium ${color.tag}`}
          >
            {category.name}
          </span>
          <div className="flex flex-col items-end">
            <span className="text-base font-semibold">{formatYen(category.total)}</span>
            {level && (
              <span className={`text-xs font-medium ${TREND_TEXT_COLOR[level]}`}>
                {diff}
              </span>
            )}
          </div>
        </div>
        {/* 直近6ヶ月の異常値バー（フィル長で支出量を可視化） */}
        <AnomalyBar
          value={category.total}
          boxStats={category.boxStats}
          fillClass={color.bar}
        />
      </button>

      {/* 展開時: 支出明細リスト（可変高さに対応） */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-3 text-sm border-t border-border/50">
            {/* 支出明細（タップで編集モーダルを開く） */}
            <div className="divide-y divide-border/50">
              {category.expenses.map((exp) => (
                <button
                  key={exp.id}
                  type="button"
                  onClick={() =>
                    openEdit({
                      id: exp.id,
                      amount: exp.amount,
                      spentAt: formatJstDate(new Date(exp.spentAt)),
                      categoryId: category.categoryId,
                      storeName: exp.storeName,
                      memo: exp.memo,
                    })
                  }
                  className="w-full text-left flex items-center justify-between gap-2 -mx-4 px-4 py-2.5 min-h-[44px] active:bg-muted/50 transition-colors"
                >
                  <div className="flex items-center gap-2 min-w-0 flex-1">
                    <span className="text-muted-foreground shrink-0">
                      {formatJstDateLabel(new Date(exp.spentAt))}
                    </span>
                    {(exp.storeName || exp.memo) && (
                      <span className="text-xs text-muted-foreground truncate">
                        {exp.storeName ?? exp.memo}
                      </span>
                    )}
                  </div>
                  <span className="font-medium shrink-0">{formatYen(exp.amount)}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

type Props = {
  summary: MonthlySummary;
  openCategoryId: string | null;
  onToggleCategory: (categoryId: string) => void;
};

export function MonthlySummaryView({ summary, openCategoryId, onToggleCategory }: Props) {
  const compareTotal = summary.compareTotal;
  const totalLevel = compareTotal !== null ? getTrendLevel(compareTotal, summary.total) : null;
  const totalDiff = compareTotal !== null ? formatDiff(compareTotal - summary.total) : null;
  // ドーナツは金額の大きい順に並べる（カテゴリ別リストの sortOrder 順とは独立）
  const sortedByTotal = [...summary.categories].sort((a, b) => b.total - a.total);
  const topCategories = sortedByTotal.slice(0, 7);

  return (
    <main className="px-4 py-6 space-y-6">
        {/* 合計カード: 左にドーナツ（中央に合計金額）、右に上位3カテゴリのレジェンド */}
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-[160px]">
              <DonutChart
                segments={sortedByTotal.map((c) => ({
                  id: c.categoryId,
                  value: c.total,
                  color: categoryColor(c.sortOrder).hex,
                }))}
              >
                <span className="text-xs text-muted-foreground">合計</span>
                <p className="text-xl font-bold tabular-nums whitespace-nowrap">
                  {formatYen(summary.total)}
                </p>
                {totalLevel && (
                  <p className={`text-[11px] font-medium mt-0.5 ${TREND_TEXT_COLOR[totalLevel]}`}>
                    {totalDiff}
                  </p>
                )}
              </DonutChart>
            </div>
            {topCategories.length > 0 && (
              <ul className="flex-1 min-w-0 space-y-1 pt-1">
                {topCategories.map((c) => {
                  const color = categoryColor(c.sortOrder);
                  return (
                    <li key={c.categoryId} className="min-w-0">
                      <span
                        className={`inline-block max-w-full truncate rounded-lg px-2 py-0.5 text-xs font-medium ${color.tag}`}
                      >
                        {c.name}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* カテゴリ別 */}
        <div>
          <h2 className="text-base font-semibold mb-3">カテゴリ別</h2>
          <div className="space-y-3">
            {summary.categories.length === 0 ? (
              <div className="py-8 flex flex-col items-center text-center">
                <Image
                  src="/character.png"
                  alt=""
                  width={128}
                  height={128}
                  sizes="128px"
                  className="w-28 h-28 mb-3 opacity-90"
                />
                <p className="text-sm text-muted-foreground">
                  キロクナシ
                </p>
              </div>
            ) : (
              summary.categories.map((cat) => (
                <CategoryRow
                  key={cat.categoryId}
                  category={cat}
                  isOpen={openCategoryId === cat.categoryId}
                  onToggle={() => onToggleCategory(cat.categoryId)}
                />
              ))
            )}
          </div>
        </div>
    </main>
  );
}
