import { describe, it, expect } from "vitest";
import { resolveSummaryView, topCategoryId } from "./summary-view";
import { OTHERS_CATEGORY_ID } from "./category-constants";
import type { CategorySummary } from "@/types";

function cat(
  id: string,
  total: number,
  sortOrder = 0,
  name = id,
  count = 0
): CategorySummary {
  return {
    categoryId: id,
    name,
    sortOrder,
    total,
    compareTotal: null,
    boxStats: null,
    expenses: Array.from({ length: count }, (_, i) => ({
      id: `${id}-e${i}`,
      amount: 0,
      spentAt: "2026-06-01",
      updatedAt: "2026-06-01",
      storeName: null,
      memo: null,
      tags: [],
    })),
  };
}

// 金額降順で n 件（c1=最大 … cn=最小）
function manyCats(n: number): CategorySummary[] {
  return Array.from({ length: n }, (_, i) => cat(`c${i + 1}`, (n - i) * 10, i));
}

describe("topCategoryId", () => {
  it("空配列は null", () => {
    expect(topCategoryId([])).toBeNull();
  });
  it("金額最大のカテゴリIDを返す", () => {
    expect(topCategoryId([cat("a", 100), cat("b", 300), cat("c", 200)])).toBe("b");
  });
});

describe("resolveSummaryView: バケツ分け", () => {
  it("7件以下は全件個別表示（その他なし）", () => {
    const v = resolveSummaryView(manyCats(7), null, []);
    expect(v.legendItems).toHaveLength(7);
    expect(v.legendItems.some((it) => it.id === OTHERS_CATEGORY_ID)).toBe(false);
  });
  it("8件以上は上位6件＋その他", () => {
    const v = resolveSummaryView(manyCats(8), null, []);
    expect(v.legendItems).toHaveLength(7);
    const last = v.legendItems[6];
    expect(last.id).toBe(OTHERS_CATEGORY_ID);
    expect(last.total).toBe(10 + 20); // c7(20) + c8(10)
  });
});

describe("resolveSummaryView: 件数", () => {
  it("各レジェンドに当月件数を載せ、その他はバケツ内を合算", () => {
    const cats = [
      cat("c1", 100, 0, "c1", 3),
      cat("c2", 90, 1, "c2", 1),
      cat("c3", 80, 2, "c3", 2),
      cat("c4", 70, 3, "c4", 1),
      cat("c5", 60, 4, "c5", 1),
      cat("c6", 50, 5, "c6", 1),
      cat("c7", 40, 6, "c7", 2),
      cat("c8", 30, 7, "c8", 4),
    ]; // 8件 → 上位6件 + その他(c7,c8)
    const v = resolveSummaryView(cats, null, []);
    const countById = Object.fromEntries(
      v.legendItems.map((it) => [it.id, it.count])
    );
    expect(countById["c1"]).toBe(3);
    expect(countById["c3"]).toBe(2);
    expect(countById[OTHERS_CATEGORY_ID]).toBe(2 + 4); // c7 + c8
  });
});

describe("resolveSummaryView: 選択解決", () => {
  it("未選択(null)は最大カテゴリにフォールバック", () => {
    const v = resolveSummaryView(manyCats(8), null, []);
    expect(v.selectedId).toBe("c1"); // 最大
    expect(v.highlightId).toBe("c1");
    expect(v.visibleCategories.map((c) => c.categoryId)).toEqual(["c1"]);
  });

  it("上位件のidはその個別カテゴリ", () => {
    const v = resolveSummaryView(manyCats(8), "c3", []);
    expect(v.selectedId).toBe("c3");
    expect(v.highlightId).toBe("c3");
    expect(v.visibleCategories.map((c) => c.categoryId)).toEqual(["c3"]);
  });

  it("その他バケツ内のidは「その他」に集約、明細はバケツ全件", () => {
    const v = resolveSummaryView(manyCats(8), "c7", []); // c7,c8 が その他
    expect(v.selectedId).toBe(OTHERS_CATEGORY_ID);
    expect(v.highlightId).toBe(OTHERS_CATEGORY_ID);
    expect(v.visibleCategories.map((c) => c.categoryId)).toEqual(["c7", "c8"]);
    expect(v.selectedLabel?.name).toBe("その他");
  });

  it("「その他」明示: その他があれば選択、無ければ null", () => {
    expect(resolveSummaryView(manyCats(8), OTHERS_CATEGORY_ID, []).selectedId).toBe(
      OTHERS_CATEGORY_ID
    );
    expect(resolveSummaryView(manyCats(7), OTHERS_CATEGORY_ID, []).selectedId).toBeNull();
  });

  it("当月に支出が無いid（キロクナシ）は個別維持・ハイライト無し・ラベルは全カテゴリから解決", () => {
    const v = resolveSummaryView(manyCats(3), "ghost", [
      { id: "ghost", name: "ゴースト", sortOrder: 5 },
    ]);
    expect(v.selectedId).toBe("ghost");
    expect(v.highlightId).toBeNull();
    expect(v.visibleCategories).toHaveLength(0);
    expect(v.selectedLabel).toEqual({ name: "ゴースト", sortOrder: 5 });
  });
});
