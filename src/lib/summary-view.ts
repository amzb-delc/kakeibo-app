import { categoryColor, OTHERS_COLOR, type CategoryColor } from "@/lib/category-color";
import { OTHERS_CATEGORY_ID } from "@/lib/category-constants";
import type { CategorySummary } from "@/types";

// ホーム全体カードの「レジェンド/ドーナツ/選択解決/明細表示」を導出する純粋関数。
// 描画から切り離してユニットテスト可能にする（ホーム最大の分岐ロジック）。

// 表示ルール: 7件以下は全件個別表示、8件以上は上位 TOP_N 件＋「その他」(残り合算)。
// （残り1件だけを「その他」にするのは無駄なので OTHERS_THRESHOLD=7 を超えた時だけ集約）
export const TOP_N = 6;
export const OTHERS_THRESHOLD = 7;

export type LegendItem = {
  id: string;
  name: string;
  total: number;
  count: number; // 当月の支出件数（「その他」はバケツ内の合算）
  color: CategoryColor;
};

export type SummaryView = {
  legendItems: LegendItem[]; // ドーナツのセグメントと 1:1（同じ並び・色）
  selectedId: string | null; // 実カテゴリID / OTHERS_CATEGORY_ID / null
  highlightId: string | null; // ドーナツ強調対象（描画セグメントに無いidは null）
  visibleCategories: CategorySummary[]; // 明細に出すカテゴリ
  selectedLabel: { name: string; sortOrder: number } | null;
  selectedLabelColor: CategoryColor;
};

type CategoryNameLookup = { id: string; name: string; sortOrder: number };

// 金額降順の先頭カテゴリ（未選択時の初期選択・FAB 既定値に使う）。
export function topCategoryId(categories: CategorySummary[]): string | null {
  if (categories.length === 0) return null;
  return [...categories].sort((a, b) => b.total - a.total)[0].categoryId;
}

export function resolveSummaryView(
  categories: CategorySummary[],
  openCategoryId: string | null,
  allCategories: CategoryNameLookup[]
): SummaryView {
  const sortedByTotal = [...categories].sort((a, b) => b.total - a.total);
  const useOthers = sortedByTotal.length > OTHERS_THRESHOLD;
  const topCategories = useOthers ? sortedByTotal.slice(0, TOP_N) : sortedByTotal;
  const otherCategories = useOthers ? sortedByTotal.slice(TOP_N) : [];
  const othersTotal = otherCategories.reduce((sum, c) => sum + c.total, 0);
  const hasOthers = otherCategories.length > 0;

  const legendItems: LegendItem[] = topCategories.map((c) => ({
    id: c.categoryId,
    name: c.name,
    total: c.total,
    count: c.expenses.length,
    color: categoryColor(c.sortOrder),
  }));
  if (hasOthers) {
    legendItems.push({
      id: OTHERS_CATEGORY_ID,
      name: "その他",
      total: othersTotal,
      count: otherCategories.reduce((sum, c) => sum + c.expenses.length, 0),
      color: OTHERS_COLOR,
    });
  }

  // 選択解決（「解除なし」設計。未選択時のみ最大カテゴリにフォールバック）:
  //   - 「その他」明示 → その他（無ければ null）
  //   - 上位N件のid → その個別カテゴリ
  //   - 当月に支出はあるが圏外のid（その他バケツ内）→ 「その他」に集約
  //   - 当月に支出が無いid → 個別のまま維持（キロクナシ表示。月跨ぎで選択を保つ）
  const topIds = new Set(topCategories.map((c) => c.categoryId));
  const presentIds = new Set(categories.map((c) => c.categoryId));
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

  // 描画セグメントに無いid（キロクナシ等）は null 扱い＝全減光・ハイライト無しを防ぐ。
  const highlightId = legendItems.some((it) => it.id === selectedId)
    ? selectedId
    : null;

  // 明細: 「その他」はバケツ内の全カテゴリ、個別はその1件、未選択は空。
  const visibleCategories =
    selectedId === OTHERS_CATEGORY_ID
      ? otherCategories
      : selectedId
        ? categories.filter((c) => c.categoryId === selectedId)
        : [];

  // 明細見出し横のラベル。個別は当月明細→全カテゴリの順に名前/色を解決。
  let selectedLabel: { name: string; sortOrder: number } | null = null;
  let selectedLabelColor: CategoryColor = OTHERS_COLOR;
  if (selectedId === OTHERS_CATEGORY_ID) {
    selectedLabel = { name: "その他", sortOrder: -1 };
    selectedLabelColor = OTHERS_COLOR;
  } else if (selectedId) {
    const inSummary = categories.find((c) => c.categoryId === selectedId);
    const resolved = inSummary
      ? { name: inSummary.name, sortOrder: inSummary.sortOrder }
      : (() => {
          const c = allCategories.find((x) => x.id === selectedId);
          return c ? { name: c.name, sortOrder: c.sortOrder } : null;
        })();
    if (resolved) {
      selectedLabel = resolved;
      selectedLabelColor = categoryColor(resolved.sortOrder);
    }
  }

  return {
    legendItems,
    selectedId,
    highlightId,
    visibleCategories,
    selectedLabel,
    selectedLabelColor,
  };
}
