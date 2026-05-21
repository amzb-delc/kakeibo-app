"use client";

import { useState } from "react";
import { getTrendLevel, TREND_ICON, TREND_TEXT_COLOR, TREND_BG_COLOR } from "@/lib/trend";
import { formatJstDate, formatJstDateLabel } from "@/lib/date";
import { useExpenseModal } from "@/components/expense-modal";
import type { MonthlySummary, CategorySummary } from "@/types";

function formatYen(amount: number) {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

function formatPercent(current: number, prev: number) {
  if (prev === 0) return null;
  const ratio = Math.round(((current - prev) / prev) * 100);
  return ratio >= 0 ? `+${ratio}%` : `${ratio}%`;
}

type CategoryRowProps = {
  category: CategorySummary;
  maxTotal: number;
  isOpen: boolean;
  onToggle: () => void;
};

function CategoryRow({ category, maxTotal, isOpen, onToggle }: CategoryRowProps) {
  const { openEdit } = useExpenseModal();
  const level = getTrendLevel(category.total, category.prevTotal);
  const percent = formatPercent(category.total, category.prevTotal);
  const barWidth = maxTotal > 0 ? (category.total / maxTotal) * 100 : 0;

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <button
        type="button"
        aria-expanded={isOpen}
        className="w-full text-left p-4 min-h-[56px] active:bg-muted/50 transition-colors"
        onClick={onToggle}
      >
        <div className="flex items-center justify-between mb-2">
          <span className="text-base font-medium">{category.name}</span>
          <div className="flex items-center gap-2">
            <span className="text-base font-semibold">{formatYen(category.total)}</span>
            <span
              className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-medium ${TREND_TEXT_COLOR[level]} ${TREND_BG_COLOR[level]}`}
            >
              {TREND_ICON[level]}
            </span>
          </div>
        </div>
        {/* バーチャート */}
        <div className="w-full h-2 bg-gray-100 rounded-full overflow-hidden">
          <div
            className="h-full bg-primary rounded-full transition-all duration-300"
            style={{ width: `${barWidth}%` }}
          />
        </div>
      </button>

      {/* 展開時: 前月比詳細 + 支出明細リスト（可変高さに対応） */}
      <div
        className="grid transition-[grid-template-rows] duration-200 ease-out"
        style={{ gridTemplateRows: isOpen ? "1fr" : "0fr" }}
      >
        <div className="overflow-hidden">
          <div className="px-4 pb-4 pt-3 text-sm border-t border-border/50">
            <div className="flex justify-between text-muted-foreground">
              <span>先月</span>
              <span>{formatYen(category.prevTotal)}</span>
            </div>
            {percent && (
              <div className={`flex justify-between font-medium ${TREND_TEXT_COLOR[level]}`}>
                <span>前月比</span>
                <span>{percent}</span>
              </div>
            )}

            {/* 支出明細（タップで編集モーダルを開く） */}
            <div className="mt-3 border-t border-border/50 divide-y divide-border/50">
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
                  <div className="min-w-0">
                    <span className="text-muted-foreground">
                      {formatJstDateLabel(new Date(exp.spentAt))}
                    </span>
                    {(exp.storeName || exp.memo) && (
                      <span className="block text-xs text-muted-foreground truncate">
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
};

export function MonthlySummaryView({ summary }: Props) {
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  const handleToggle = (categoryId: string) => {
    setOpenCategoryId((prev) => (prev === categoryId ? null : categoryId));
  };

  const totalLevel = getTrendLevel(summary.total, summary.prevTotal);
  const totalPercent = formatPercent(summary.total, summary.prevTotal);

  const maxCategoryTotal = Math.max(...summary.categories.map((c) => c.total), 0);

  // 前月比プログレスバー（先月を100%として当月の割合を表示）
  const progressPercent = summary.prevTotal > 0
    ? Math.min((summary.total / summary.prevTotal) * 100, 150)
    : 0;

  return (
    <main className="px-4 py-6 space-y-6">
        {/* 合計カード */}
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
          <div className="flex items-baseline justify-between mb-1">
            <span className="text-sm text-muted-foreground">合計</span>
            {totalPercent && (
              <span
                className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-medium ${TREND_TEXT_COLOR[totalLevel]} ${TREND_BG_COLOR[totalLevel]}`}
              >
                {TREND_ICON[totalLevel]} {totalPercent}
              </span>
            )}
          </div>
          <p className="text-3xl font-bold">{formatYen(summary.total)}</p>
          {summary.prevTotal > 0 && (
            <>
              <p className="text-xs text-muted-foreground mt-1">
                先月 {formatYen(summary.prevTotal)}
              </p>
              {/* プログレスバー */}
              <div className="w-full h-2.5 bg-gray-100 rounded-full overflow-hidden mt-3">
                <div
                  className={`h-full rounded-full transition-all duration-500 ${
                    progressPercent > 100 ? "bg-destructive/70" : "bg-primary"
                  }`}
                  style={{ width: `${Math.min(progressPercent, 100)}%` }}
                />
              </div>
            </>
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
                  onToggle={() => handleToggle(cat.categoryId)}
                />
              ))
            )}
          </div>
        </div>
    </main>
  );
}
