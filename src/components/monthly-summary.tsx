"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { getTrendLevel, TREND_TEXT_COLOR } from "@/lib/trend";
import { formatJstDate, formatJstDateLabel } from "@/lib/date";
import { formatYen, formatDiff } from "@/lib/format";
import { categoryColor } from "@/lib/category-color";
import { CategoryTag } from "@/components/category-tag";
import { OTHERS_CATEGORY_ID } from "@/lib/category-constants";
import { resolveSummaryView } from "@/lib/summary-view";
import { sortExpenses, type SortField, type SortDir } from "@/lib/expense-sort";
import { useExpenseModal } from "@/components/expense-modal";
import { DonutChart } from "@/components/donut-chart";
import { StackedBarChart } from "@/components/stacked-bar-chart";
import { tagColor, SPOUSE_TAGS } from "@/lib/tags";
import type { MonthlySummary, CategorySummary, BoxStats } from "@/types";

// 支出行のタグ識別ドット。色は tags.ts の tagColor() に集約（ここで再実装しない）。
// 色が付かない（null）タグはスキップ。装飾なので aria-hidden。
function TagDots({ tags }: { tags: string[] }) {
  const dots = tags
    .map((t) => tagColor(t))
    .filter((c): c is string => c !== null);
  if (dots.length === 0) return null;
  return (
    <span className="flex shrink-0 items-center gap-1" aria-hidden="true">
      {dots.map((color, i) => (
        <span
          key={i}
          className="size-1.5 rounded-full"
          style={{ backgroundColor: color }}
        />
      ))}
    </span>
  );
}

// 全体カードの夫婦タグフィルタの選択肢（全体=null / ♂=spouse:1 / ♀=spouse:2）。
const SPOUSE_FILTERS: { value: string | null; label: string }[] = [
  { value: null, label: "全体" },
  { value: SPOUSE_TAGS[0], label: "♂" },
  { value: SPOUSE_TAGS[1], label: "♀" },
];

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

// 並び替えの上下三角。アクティブ列は方向側を青く点灯、非アクティブはグレー。
function SortTriangles({ active, dir }: { active: boolean; dir: SortDir }) {
  const upClass = active && dir === "asc" ? "fill-blue-600" : "fill-muted-foreground/30";
  const downClass = active && dir === "desc" ? "fill-blue-600" : "fill-muted-foreground/30";
  return (
    <svg width="9" height="12" viewBox="0 0 9 12" aria-hidden="true" className="shrink-0">
      <path d="M4.5 0 L8.5 4.5 L0.5 4.5 Z" className={upClass} />
      <path d="M4.5 12 L8.5 7.5 L0.5 7.5 Z" className={downClass} />
    </svg>
  );
}

// 単一選択表示のため、明細カードは常に展開状態（開閉トグルは持たない）。
// showName: 「その他」など複数カテゴリをまとめて表示する場面で、どのカテゴリかが
// 分かるようカード上部にカテゴリ名タグを出す（単一選択時は見出しに名前が出るので不要）。
function CategoryRow({
  category,
  showName = false,
  sortField,
  sortDir,
  rowDateField,
}: {
  category: CategorySummary;
  showName?: boolean;
  sortField: SortField;
  sortDir: SortDir;
  rowDateField: "spentAt" | "updatedAt";
}) {
  const { openEdit } = useExpenseModal();
  // 今月視点で比較する: 今月 > 表示月 なら up(赤=今月の方が多い), 今月 < 表示月 なら down(緑=今月の方が少ない)
  const compareTotal = category.compareTotal;
  const level = compareTotal !== null ? getTrendLevel(compareTotal, category.total) : null;
  const diff = compareTotal !== null ? formatDiff(compareTotal - category.total) : null;
  const color = categoryColor(category.sortOrder);
  // 並び替えはヘッダ（全カード共通）から渡される。行の日付表示は rowDateField に従う。
  const sortedExpenses = sortExpenses(category.expenses, sortField, sortDir);

  return (
    <div className="bg-card rounded-2xl border border-border/50 shadow-sm overflow-hidden">
      <div className="px-4 pt-4 pb-3">
        {/* カード上部: 合計＋当月比較 */}
        <div
          className={`flex items-center mb-2 ${showName ? "justify-between gap-2" : "justify-end"}`}
        >
          {showName && (
            <CategoryTag name={category.name} sortOrder={category.sortOrder} truncate />
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

      {/* 支出明細リスト（区切り線なしで続ける。各行タップで編集モーダルを開く） */}
      <div className="px-4 pb-3 text-sm">
        <div className="divide-y divide-border/50">
          {sortedExpenses.map((exp) => (
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
              className="w-full text-left flex items-center gap-2 -mx-4 px-4 py-2.5 min-h-[44px] active:bg-muted/50 transition-colors"
            >
              {/* ヘッダと同じ3カラム（日付=固定幅 / 店名=可変 / 金額=右） */}
              <span className="w-[5.5rem] shrink-0 tabular-nums text-muted-foreground">
                {rowDateField === "updatedAt"
                  ? formatJstDate(new Date(exp.updatedAt)) // 2026-06-08 形式
                  : formatJstDateLabel(new Date(exp.spentAt))}
              </span>
              <span className="flex-1 min-w-0 flex items-center gap-1.5">
                <TagDots tags={exp.tags} />
                <span className="min-w-0 truncate text-xs text-muted-foreground">
                  {exp.storeName ?? exp.memo ?? ""}
                </span>
              </span>
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
  // 夫婦タグフィルタ（null=全体）。サーバ側で合計・カテゴリ・明細・比較すべて絞られる。
  tag: string | null;
  onTagChange: (tag: string | null) => void;
};

export function MonthlySummaryView({
  summary,
  openCategoryId,
  onToggleCategory,
  tag,
  onTagChange,
}: Props) {
  const { categories: allCategories } = useExpenseModal();
  const compareTotal = summary.compareTotal;
  const totalLevel = compareTotal !== null ? getTrendLevel(compareTotal, summary.total) : null;
  const totalDiff = compareTotal !== null ? formatDiff(compareTotal - summary.total) : null;

  // レジェンド/ドーナツ/選択解決/明細表示の導出は純関数に集約（テスト可能）。
  const {
    legendItems,
    selectedId,
    highlightId,
    visibleCategories,
    selectedLabel,
    selectedLabelColor,
  } = resolveSummaryView(summary.categories, openCategoryId, allCategories);

  // 明細の並び替え（ヘッダ＝全カード共通）。
  // 日付ボタンは1タップ判定で循環: 日付↓→日付↑→更新日↓→更新日↑（dateStep 0..3）。
  // 金額ボタンは↓↑トグル。アクティブな列（sortKey）で実際に並べ替える。既定=日付↓。
  const [dateStep, setDateStep] = useState(0);
  const [amountDir, setAmountDir] = useState<SortDir>("desc");
  const [sortKey, setSortKey] = useState<"date" | "amount">("date");

  // 全体カードの表示モード（単月ドーナツ ⇔ 6ヶ月積み上げ棒）。横スライドで切替。
  // 月送り時はモードを維持する（6ヶ月比較を見ている最中に勝手に単月へ戻ると不便なため）。
  const [cardMode, setCardMode] = useState<"month" | "sixMonths">("month");
  // 6ヶ月グラフの単独カテゴリ比較。null=積み上げ。単月の openCategoryId とは独立に持つ。
  const [chartCategoryId, setChartCategoryId] = useState<string | null>(null);
  const chartCategory =
    chartCategoryId !== null
      ? summary.categories.find((c) => c.categoryId === chartCategoryId) ?? null
      : null;

  const dateFieldFromStep: "spentAt" | "updatedAt" =
    dateStep < 2 ? "spentAt" : "updatedAt";
  const dateDirFromStep: SortDir = dateStep % 2 === 0 ? "desc" : "asc";
  const sortField: SortField = sortKey === "amount" ? "amount" : dateFieldFromStep;
  const sortDir: SortDir = sortKey === "amount" ? amountDir : dateDirFromStep;

  // 日付ボタン: アクティブなら循環を1つ進める。金額ソート中ならまず日付に戻す。
  const onDateSort = () => {
    if (sortKey === "date") setDateStep((s) => (s + 1) % 4);
    else setSortKey("date");
  };
  // 金額ボタン: アクティブなら↓↑トグル。日付ソート中ならまず金額にする。
  const onAmountSort = () => {
    if (sortKey === "amount") setAmountDir((d) => (d === "asc" ? "desc" : "asc"));
    else setSortKey("amount");
  };

  return (
    <main className="px-4 py-6 space-y-6">
        {/* 合計カード: 左にドーナツ（中央に合計金額）、右に上位7カテゴリのレジェンド（＝カテゴリ選択UI） */}
        <div className="relative bg-card rounded-2xl p-4 shadow-sm border border-border/50">
          {/* 夫婦タグフィルタ（全体/♂/♀）。選択でドーナツ・合計・前月比・明細すべてが絞られる。 */}
          <div className="mb-3 flex justify-end">
            <div
              role="group"
              aria-label="入力者で絞り込み"
              className="inline-flex rounded-lg bg-muted p-0.5"
            >
              {SPOUSE_FILTERS.map((f) => {
                const active = tag === f.value;
                return (
                  <button
                    key={f.label}
                    type="button"
                    onClick={() => onTagChange(f.value)}
                    aria-pressed={active}
                    className={`min-w-[2.5rem] rounded-md px-2.5 py-1 text-xs font-medium transition-colors ${
                      active
                        ? "bg-card text-foreground shadow-sm"
                        : "text-muted-foreground hover:text-foreground"
                    }`}
                  >
                    {f.label}
                  </button>
                );
              })}
            </div>
          </div>
          {/* 単月ペイン ⇔ 6ヶ月ペインを横スライドで切替。外枠で overflow を切り、
              内側の 2 枚（各 w-full）を translateX で左右に動かす。
              シェブロンはペインのレイアウト外に出し、カードに対する絶対配置の
              フローティングボタンにする（inert なペインの外なので常に操作可能）。 */}
          <div className="relative overflow-x-clip">
            <div
              className="flex w-[200%] transition-transform duration-300 ease-out"
              style={{
                transform:
                  cardMode === "sixMonths" ? "translateX(-50%)" : "translateX(0)",
              }}
            >
              {/* === 単月ペイン（ドーナツ＋レジェンド） === */}
              {/* 非表示側ペインは inert で配下のボタン群ごとフォーカス不可にする（WCAG 4.1.2）。
                  aria-hidden は jsdom（テスト）の role 除外用に併記 */}
              <div
                className="w-1/2 shrink-0"
                inert={cardMode === "sixMonths" ? true : undefined}
                aria-hidden={cardMode === "sixMonths"}
              >
                <div className="flex items-stretch">
                  <div className="flex flex-1 items-start gap-3 min-w-0">
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
                                <span className="flex min-w-0 items-center gap-1.5">
                                  <span
                                    className={`inline-flex min-w-0 items-center rounded-lg px-2.5 py-1 text-sm font-medium ${it.color.tag} ${isSelected ? "ring-2 ring-current ring-offset-1" : ""}`}
                                  >
                                    <span className="truncate">{it.name}</span>
                                  </span>
                                  <span className="shrink-0 text-[11px] tabular-nums text-muted-foreground/70">
                                    {it.count}件
                                  </span>
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
              </div>

              {/* === 6ヶ月ペイン（積み上げ棒） === */}
              <div
                className="w-1/2 shrink-0"
                inert={cardMode !== "sixMonths" ? true : undefined}
                aria-hidden={cardMode !== "sixMonths"}
              >
                <div className="flex items-stretch">
                  <div className="flex-1 min-w-0">
                    <StackedBarChart
                      data={summary.sixMonths}
                      selectedCategoryId={chartCategoryId}
                      selectedSortOrder={chartCategory?.sortOrder ?? null}
                      selectedYm={`${summary.year}-${String(summary.month).padStart(2, "0")}`}
                    />
                    {/* グラフ用カテゴリ選択（単月の選択とは独立）。タップで単独カテゴリ比較、
                        再タップ／「全体」で積み上げに戻る。 */}
                    {summary.categories.length > 0 && (
                      // ring-offset とスクロールバーが下端で見切れないよう pb で余白を確保
                      <div className="mt-2 pb-1 flex flex-wrap gap-1.5">
                        <button
                          type="button"
                          onClick={() => setChartCategoryId(null)}
                          aria-pressed={chartCategoryId === null}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${
                            chartCategoryId === null
                              ? "bg-foreground text-background"
                              : "bg-muted text-muted-foreground hover:text-foreground"
                          }`}
                        >
                          全体
                        </button>
                        {summary.categories.map((cat) => {
                          const active = chartCategoryId === cat.categoryId;
                          const color = categoryColor(cat.sortOrder);
                          return (
                            <button
                              key={cat.categoryId}
                              type="button"
                              onClick={() =>
                                setChartCategoryId(active ? null : cat.categoryId)
                              }
                              aria-pressed={active}
                              className={`inline-flex items-center rounded-lg px-2.5 py-1 text-xs font-medium transition-colors ${color.tag} ${
                                active ? "ring-2 ring-current ring-offset-1" : "opacity-70 hover:opacity-100"
                              }`}
                            >
                              {cat.name}
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>

          </div>
          {/* フローティングのシェブロン（カードの枠線上に乗せる絶対配置・縦中央）。
              コンテンツと被らないよう枠ギリギリ＝ボーダーを跨ぐ位置（半分外側）に置く。
              overflow-x-clip の内側だと外側半分が切れるため、クリップ枠の外（カード直下）に置く。
              inert なペインの外なので常に操作可能。表示モードに応じて出す向きを切替:
              単月表示中は右の › （6ヶ月へ）、6ヶ月表示中は左の ‹ （単月へ戻る）。 */}
          {cardMode === "month" ? (
            <button
              type="button"
              onClick={() => setCardMode("sixMonths")}
              aria-label="6ヶ月の比較を表示"
              className="absolute right-0 top-1/2 translate-x-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted active:bg-muted"
            >
              <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
                <path
                  d="M4 4 L10 10 L4 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          ) : (
            <button
              type="button"
              onClick={() => setCardMode("month")}
              aria-label="単月の内訳に戻る"
              className="absolute left-0 top-1/2 -translate-x-1/2 -translate-y-1/2 z-10 flex size-8 items-center justify-center rounded-full border border-border/50 bg-background text-muted-foreground shadow-sm transition-colors hover:bg-muted active:bg-muted"
            >
              <svg width="14" height="20" viewBox="0 0 14 20" aria-hidden="true">
                <path
                  d="M10 4 L4 10 L10 16"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="2"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              </svg>
            </button>
          )}
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
          {/* 並び替えヘッダ（全カード共通・明細の一番上に1つ）。明細行と同じ3カラムで整列。
              日付ボタンは1タップで循環、金額は↓↑トグル。px-4 はカード内 px-4 と揃える。 */}
          {visibleCategories.length > 0 && (
            <div className="flex items-center gap-2 px-4 mb-2 text-xs font-medium text-muted-foreground">
              <button
                type="button"
                onClick={onDateSort}
                aria-pressed={sortKey === "date"}
                aria-label={`${dateFieldFromStep === "updatedAt" ? "更新日" : "日付"}で並び替え`}
                className={`w-[5.5rem] shrink-0 flex items-center gap-1 py-1 transition-colors ${
                  sortKey === "date" ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                {dateFieldFromStep === "updatedAt" ? "更新日" : "日付"}
                <SortTriangles active={sortKey === "date"} dir={dateDirFromStep} />
              </button>
              <span className="flex-1 min-w-0">店名</span>
              <button
                type="button"
                onClick={onAmountSort}
                aria-pressed={sortKey === "amount"}
                aria-label="金額で並び替え"
                className={`shrink-0 flex items-center gap-1 py-1 transition-colors ${
                  sortKey === "amount" ? "text-foreground" : "hover:text-foreground"
                }`}
              >
                金額
                <SortTriangles active={sortKey === "amount"} dir={amountDir} />
              </button>
            </div>
          )}
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
                  sortField={sortField}
                  sortDir={sortDir}
                  rowDateField={dateFieldFromStep}
                />
              ))
            )}
          </div>
        </div>
    </main>
  );
}
