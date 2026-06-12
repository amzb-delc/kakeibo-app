// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import type { MonthlySummary } from "@/types";
import { OTHERS_CATEGORY_ID } from "@/lib/category-constants";

// 依存（モーダル context / ドーナツ SVG）は対象外なので stub。
vi.mock("@/components/expense-modal", () => ({
  useExpenseModal: () => ({ categories: [], openEdit: vi.fn() }),
}));
vi.mock("@/components/donut-chart", () => ({
  DonutChart: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { MonthlySummaryView } from "./monthly-summary";

// 発生日と更新日が逆順になる2件（AAA=発生古い/更新新しい, BBB=発生新しい/更新古い）
const summary: MonthlySummary = {
  year: 2026,
  month: 6,
  total: 300,
  compareTotal: null,
  boxStats: null,
  categories: [
    {
      categoryId: "c1",
      name: "食費",
      sortOrder: 0,
      total: 300,
      compareTotal: null,
      boxStats: null,
      expenses: [
        { id: "a", amount: 100, spentAt: "2026-06-01T03:00:00.000Z", updatedAt: "2026-06-09T03:00:00.000Z", storeName: "AAA", memo: null, tags: [] },
        { id: "b", amount: 200, spentAt: "2026-06-08T03:00:00.000Z", updatedAt: "2026-06-02T03:00:00.000Z", storeName: "BBB", memo: null, tags: [] },
      ],
    },
  ],
};

afterEach(() => cleanup());

// 明細行（AAA/BBB を含む button）の並びを返す
function order(): string[] {
  return screen
    .getAllByRole("button")
    .map((b) => b.textContent || "")
    .filter((t) => /AAA|BBB/.test(t))
    .map((t) => (t.includes("AAA") ? "A" : "B"));
}

function view() {
  return render(
    <MonthlySummaryView summary={summary} openCategoryId="c1" onToggleCategory={vi.fn()} />
  );
}

describe("MonthlySummaryView 明細の並び替え（ヘッダ・日付ボタンは循環）", () => {
  it("既定は日付↓（発生日 降順・新しい発生が先頭）", () => {
    view();
    expect(order()).toEqual(["B", "A"]); // B=発生6/08
  });

  it("日付ボタン1回で日付↑（発生日 昇順）", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "日付で並び替え" }));
    expect(order()).toEqual(["A", "B"]); // A=発生6/01
  });

  it("日付ボタン2回で更新日↓（更新日 降順・ラベルも更新日に）", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "日付で並び替え" }));
    fireEvent.click(screen.getByRole("button", { name: "日付で並び替え" }));
    expect(
      screen.getByRole("button", { name: "更新日で並び替え" })
    ).toBeInTheDocument();
    expect(order()).toEqual(["A", "B"]); // A=更新6/09
  });

  it("金額ボタンで金額ソート（降順→再タップで昇順）", () => {
    view();
    fireEvent.click(screen.getByRole("button", { name: "金額で並び替え" }));
    expect(order()).toEqual(["B", "A"]); // B=¥200
    fireEvent.click(screen.getByRole("button", { name: "金額で並び替え" }));
    expect(order()).toEqual(["A", "B"]); // A=¥100
  });
});

describe("MonthlySummaryView 「その他」表示", () => {
  // 8カテゴリ → 上位6 + その他(k7,k8)。その他選択で複数カードが並ぶ。
  const big: MonthlySummary = {
    year: 2026,
    month: 6,
    total: 3600,
    compareTotal: null,
    boxStats: null,
    categories: Array.from({ length: 8 }, (_, i) => ({
      categoryId: `k${i + 1}`,
      name: `カテゴリ${i + 1}`,
      sortOrder: i,
      total: (8 - i) * 100, // k1 が最大
      compareTotal: null,
      boxStats: null,
      expenses: [
        { id: `k${i + 1}-e`, amount: (8 - i) * 100, spentAt: "2026-06-01T03:00:00.000Z", updatedAt: "2026-06-01T03:00:00.000Z", storeName: null, memo: null, tags: [] },
      ],
    })),
  };

  it("その他選択でカードは複数でも、ソートヘッダは1つだけ", () => {
    render(
      <MonthlySummaryView
        summary={big}
        openCategoryId={OTHERS_CATEGORY_ID}
        onToggleCategory={vi.fn()}
      />
    );
    // ソートヘッダ（日付ボタン）は全カード共通で1つ
    expect(screen.getAllByRole("button", { name: "日付で並び替え" })).toHaveLength(1);
    // その他バケツの2カテゴリがカードとして並ぶ
    expect(screen.getByText("カテゴリ7")).toBeInTheDocument();
    expect(screen.getByText("カテゴリ8")).toBeInTheDocument();
  });
});
