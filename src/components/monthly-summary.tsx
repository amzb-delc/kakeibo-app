"use client";

import { getTrendLevel, TREND_TEXT_COLOR } from "@/lib/trend";
import { formatJstDate, formatJstDateLabel } from "@/lib/date";
import { categoryColor } from "@/lib/category-color";
import { useExpenseModal } from "@/components/expense-modal";
import type { MonthlySummary, CategorySummary } from "@/types";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatDiff(diff: number) {
  if (diff === 0) return "±¥0";
  const abs = Math.abs(diff).toLocaleString("ja-JP");
  return diff > 0 ? `+¥${abs}` : `-¥${abs}`;
}

type CategoryRowProps = {
  category: CategorySummary;
  maxTotal: number;
  isOpen: boolean;
  onToggle: () => void;
};

function CategoryRow({ category, maxTotal, isOpen, onToggle }: CategoryRowProps) {
  const { openEdit } = useExpenseModal();
  // 今月視点で比較する: 今月 > 表示月 なら up(赤=今月の方が多い), 今月 < 表示月 なら down(緑=今月の方が少ない)
  const compareTotal = category.compareTotal;
  const level = compareTotal !== null ? getTrendLevel(compareTotal, category.total) : null;
  const diff = compareTotal !== null ? formatDiff(compareTotal - category.total) : null;
  const barWidth = maxTotal > 0 ? (category.total / maxTotal) * 100 : 0;
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
        {/* バーチャート */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className={`h-full rounded-full transition-all duration-300 ${color.bar}`}
            style={{ width: `${barWidth}%` }}
          />
        </div>
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

  const maxCategoryTotal = Math.max(...summary.categories.map((c) => c.total), 0);

  // 今月比プログレスバー（今月を100%として表示月の割合を表示）
  const progressPercent = compareTotal !== null && compareTotal > 0
    ? Math.min((summary.total / compareTotal) * 100, 150)
    : 0;

  return (
    <main className="px-4 py-6 space-y-6">
        {/* 合計カード */}
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
          <span className="text-sm text-muted-foreground">合計</span>
          <p className="text-3xl font-bold">{formatYen(summary.total)}</p>
          {totalLevel && (
            <p className={`text-xs font-medium mt-1 ${TREND_TEXT_COLOR[totalLevel]}`}>
              {totalDiff}
            </p>
          )}
          {compareTotal !== null && compareTotal > 0 && (
            <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-3">
              <div
                className={`h-full rounded-full transition-all duration-500 ${
                  progressPercent > 100 ? "bg-destructive/70" : "bg-primary"
                }`}
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              />
            </div>
          )}
        </div>

        {/* カテゴリ別 */}
        <div>
          <h2 className="text-base font-semibold mb-3">カテゴリ別</h2>
          <div className="space-y-3">
            {summary.categories.length === 0 ? (
              <p className="py-6 text-center text-sm text-muted-foreground">
                この月の支出はありません
              </p>
            ) : (
              summary.categories.map((cat) => (
                <CategoryRow
                  key={cat.categoryId}
                  category={cat}
                  maxTotal={maxCategoryTotal}
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
