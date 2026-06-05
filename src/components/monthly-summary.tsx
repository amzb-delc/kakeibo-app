"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getTrendLevel, TREND_TEXT_COLOR } from "@/lib/trend";
import { formatJstDate, formatJstDateLabel } from "@/lib/date";
import { formatYen, formatDiff } from "@/lib/format";
import { categoryColor, OTHERS_COLOR } from "@/lib/category-color";
import { OTHERS_CATEGORY_ID } from "@/lib/category-constants";
import { useExpenseModal } from "@/components/expense-modal";
import { DonutChart } from "@/components/donut-chart";
import type { MonthlySummary, CategorySummary, BoxStats } from "@/types";

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

// 単一選択表示のため、明細カードは常に展開状態（開閉トグルは持たない）。
// showName: 「その他」など複数カテゴリをまとめて表示する場面で、どのカテゴリかが
// 分かるようカード上部にカテゴリ名タグを出す（単一選択時は見出しに名前が出るので不要）。
function CategoryRow({
  category,
  showName = false,
}: {
  category: CategorySummary;
  showName?: boolean;
}) {
  const { openEdit } = useExpenseModal();
  // 今月視点で比較する: 今月 > 表示月 なら up(赤=今月の方が多い), 今月 < 表示月 なら down(緑=今月の方が少ない)
  const compareTotal = category.compareTotal;
  const level = compareTotal !== null ? getTrendLevel(compareTotal, category.total) : null;
  const diff = compareTotal !== null ? formatDiff(compareTotal - category.total) : null;
  const color = categoryColor(category.sortOrder);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <div className="p-4">
        <div
          className={`flex items-center mb-2 ${showName ? "justify-between gap-2" : "justify-end"}`}
        >
          {showName && (
            <span
              className={`inline-flex min-w-0 items-center rounded-lg px-2.5 py-0.5 text-sm font-medium ${color.tag}`}
            >
              <span className="truncate">{category.name}</span>
            </span>
          )}
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
      </div>

      {/* 支出明細リスト（常時表示。各行タップで編集モーダルを開く） */}
      <div className="px-4 pb-4 pt-3 text-sm border-t border-border/50">
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
  );
}

type Props = {
  summary: MonthlySummary;
  openCategoryId: string | null;
  onToggleCategory: (categoryId: string) => void;
};

// 全体カードのレジェンド／ドーナツの表示ルール:
//   - 7件以下: 全カテゴリを個別表示（「その他」は出さない）
//   - 8件以上: 上位 TOP_N 件＋「その他」(残り合算)。＝「その他」は必ず2件以上を束ねる
// （残り1件だけを「その他」にするのは無駄なので、7件ちょうどはそのまま7件出す）
const TOP_N = 6;
const OTHERS_THRESHOLD = 7; // これを超える件数のときだけ「その他」に集約する

export function MonthlySummaryView({ summary, openCategoryId, onToggleCategory }: Props) {
  const { categories: allCategories } = useExpenseModal();
  const compareTotal = summary.compareTotal;
  const totalLevel = compareTotal !== null ? getTrendLevel(compareTotal, summary.total) : null;
  const totalDiff = compareTotal !== null ? formatDiff(compareTotal - summary.total) : null;

  // 金額の大きい順に並べる。8件以上のときだけ上位 TOP_N 件＋「その他」に分け、
  // 7件以下は全件を個別表示する。レジェンドとドーナツはこの並びで 1:1 に対応する。
  const sortedByTotal = [...summary.categories].sort((a, b) => b.total - a.total);
  const useOthers = sortedByTotal.length > OTHERS_THRESHOLD;
  const topCategories = useOthers ? sortedByTotal.slice(0, TOP_N) : sortedByTotal;
  const otherCategories = useOthers ? sortedByTotal.slice(TOP_N) : []; // すでに金額降順
  const othersTotal = otherCategories.reduce((sum, c) => sum + c.total, 0);
  const hasOthers = otherCategories.length > 0;

  // レジェンド項目＝ドーナツのセグメント（同じ並び・同じ色）。
  const legendItems = topCategories.map((c) => ({
    id: c.categoryId,
    name: c.name,
    total: c.total,
    color: categoryColor(c.sortOrder),
  }));
  if (hasOthers) {
    legendItems.push({
      id: OTHERS_CATEGORY_ID,
      name: "その他",
      total: othersTotal,
      color: OTHERS_COLOR,
    });
  }

  // 選択解決: openCategoryId は実カテゴリID / OTHERS_CATEGORY_ID / null のいずれか。
  // 「解除なし」設計: 未選択(null)のときだけ最大カテゴリにフォールバック（初回描画フリッカ防止）。
  //   - 「その他」明示 → その他
  //   - 上位6件のid → その個別カテゴリ
  //   - 当月に支出はあるが圏外のid（その他バケツ内）→ 「その他」に集約
  //   - 当月に支出が無い（＝存在しない）id → 個別のまま維持し下の「キロクナシ」へ
  //     （月送りで (a) の無い月に来ても (a) の選択を保つ。その他へは吸収しない）
  const topIds = new Set(topCategories.map((c) => c.categoryId));
  const presentIds = new Set(summary.categories.map((c) => c.categoryId));
  const rawSelected = openCategoryId ?? sortedByTotal[0]?.categoryId ?? null;
  let selectedId: string | null;
  if (rawSelected === OTHERS_CATEGORY_ID) {
    selectedId = hasOthers ? OTHERS_CATEGORY_ID : null;
  } else if (rawSelected && topIds.has(rawSelected)) {
    selectedId = rawSelected;
  } else if (rawSelected && presentIds.has(rawSelected)) {
    selectedId = OTHERS_CATEGORY_ID;
  } else {
    selectedId = rawSelected;
  }

  // ドーナツ／レジェンドのハイライト対象。描画セグメントに無いid（キロクナシ等）は
  // null 扱いにして「全セグメント減光・ハイライト無し」になるのを防ぐ。
  const highlightId = legendItems.some((it) => it.id === selectedId) ? selectedId : null;

  // 明細: 「その他」選択時はバケツ内の全カテゴリを金額順で並べる。個別選択時はその1件。
  const visibleCategories =
    selectedId === OTHERS_CATEGORY_ID
      ? otherCategories
      : selectedId
        ? summary.categories.filter((c) => c.categoryId === selectedId)
        : [];

  // 明細見出し横のラベル。「その他」はグレーのまとめラベル。
  // 個別は当月明細→全カテゴリの順に名前/色を解決（キロクナシ時も名前を出す）。
  let selectedLabel: { name: string; sortOrder: number } | null = null;
  let selectedLabelColor = OTHERS_COLOR;
  if (selectedId === OTHERS_CATEGORY_ID) {
    selectedLabel = { name: "その他", sortOrder: -1 };
    selectedLabelColor = OTHERS_COLOR;
  } else if (selectedId) {
    const resolved =
      summary.categories.find((c) => c.categoryId === selectedId) ??
      (() => {
        const c = allCategories.find((x) => x.id === selectedId);
        return c ? { name: c.name, sortOrder: c.sortOrder } : null;
      })();
    if (resolved) {
      selectedLabel = { name: resolved.name, sortOrder: resolved.sortOrder };
      selectedLabelColor = categoryColor(resolved.sortOrder);
    }
  }

  return (
    <main className="px-4 py-6 space-y-6">
        {/* 合計カード: 左にドーナツ（中央に合計金額）、右に上位7カテゴリのレジェンド（＝カテゴリ選択UI） */}
        <div className="bg-card rounded-2xl p-4 shadow-sm border border-border/50">
          <div className="flex items-start gap-3">
            <div className="shrink-0 w-[160px]">
              <DonutChart
                segments={legendItems.map((it) => ({
                  id: it.id,
                  value: it.total,
                  color: it.color.hex,
                }))}
                selectedId={highlightId}
                dimAll={highlightId === null}
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
            {legendItems.length > 0 && (
              <ul className="flex-1 min-w-0 space-y-1 pt-1">
                {legendItems.map((it) => {
                  const isSelected = selectedId === it.id;
                  return (
                    <li key={it.id} className="min-w-0">
                      <button
                        type="button"
                        onClick={() => onToggleCategory(it.id)}
                        aria-pressed={isSelected}
                        className="flex w-full items-center justify-between gap-2 text-left"
                      >
                        <span
                          className={`inline-flex min-w-0 items-center rounded-lg px-2.5 py-1 text-sm font-medium ${it.color.tag} ${isSelected ? "ring-2 ring-current ring-offset-1" : ""}`}
                        >
                          <span className="truncate">{it.name}</span>
                        </span>
                        <span className="shrink-0 text-xs tabular-nums text-muted-foreground">
                          {formatYen(it.total)}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </div>

        {/* 明細（選択中カテゴリの支出明細）。見出しの右に選択カテゴリのラベルを表示 */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <h2 className="text-base font-semibold">明細</h2>
            {selectedLabel && (
              <span
                className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-medium ${selectedLabelColor.tag}`}
              >
                {selectedLabel.name}
              </span>
            )}
          </div>
          <div className="space-y-3">
            {visibleCategories.length === 0 ? (
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
              visibleCategories.map((cat) => (
                <CategoryRow
                  key={cat.categoryId}
                  category={cat}
                  showName={selectedId === OTHERS_CATEGORY_ID}
                />
              ))
            )}
          </div>
        </div>
    </main>
  );
}
