// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, within } from "@testing-library/react";
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
  sixMonths: [],
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
    <MonthlySummaryView
      summary={summary}
      openCategoryId="c1"
      onToggleCategory={vi.fn()}
      tag={null}
      onTagChange={vi.fn()}
    />
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
    sixMonths: [],
  };

  it("その他選択でカードは複数でも、ソートヘッダは1つだけ", () => {
    render(
      <MonthlySummaryView
        summary={big}
        openCategoryId={OTHERS_CATEGORY_ID}
        onToggleCategory={vi.fn()}
        tag={null}
        onTagChange={vi.fn()}
      />
    );
    // ソートヘッダ（日付ボタン）は全カード共通で1つ
    expect(screen.getAllByRole("button", { name: "日付で並び替え" })).toHaveLength(1);
    // その他バケツの2カテゴリがカードとして並ぶ。
    // 6ヶ月ペインのカテゴリ選択ボタンにも同名が出るため、明細セクションに限定して確認する。
    const detail = within(screen.getByRole("heading", { name: "明細" }).parentElement!.parentElement!);
    expect(detail.getByText("カテゴリ7")).toBeInTheDocument();
    expect(detail.getByText("カテゴリ8")).toBeInTheDocument();
  });
});

describe("MonthlySummaryView 6ヶ月ペインの切替（スモーク）", () => {
  // sixMonths を持つサマリー。チャート自体の描画検証はせず、切替UIの存在だけ確認する。
  const withSix: MonthlySummary = {
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
        expenses: [],
      },
    ],
    sixMonths: [
      { ym: "2026-01", total: 0, byCategory: [] },
      { ym: "2026-02", total: 0, byCategory: [] },
      { ym: "2026-03", total: 0, byCategory: [] },
      { ym: "2026-04", total: 0, byCategory: [] },
      { ym: "2026-05", total: 0, byCategory: [] },
      { ym: "2026-06", total: 300, byCategory: [{ categoryId: "c1", name: "食費", sortOrder: 0, total: 300 }] },
    ],
  };

  function viewWithSix() {
    return render(
      <MonthlySummaryView
        summary={withSix}
        openCategoryId="c1"
        onToggleCategory={vi.fn()}
        tag={null}
        onTagChange={vi.fn()}
      />
    );
  }

  it("既定（単月）では単月トグルがアクティブで、6ヶ月グラフは非表示", () => {
    viewWithSix();
    // トグルは常時両方DOMにあり、アクティブ側が aria-pressed=true
    expect(screen.getByRole("button", { name: "単月の内訳" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "6ヶ月の比較" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
    // 6ヶ月ペインは aria-hidden のためグラフは a11y 木に出ない
    expect(
      screen.queryByRole("img", { name: "過去6ヶ月の支出比較グラフ" })
    ).toBeNull();
  });

  it("6ヶ月トグル押下で 6ヶ月ペインに切り替わり、棒グラフ（SVG）が現れる", () => {
    viewWithSix();
    fireEvent.click(screen.getByRole("button", { name: "6ヶ月の比較" }));
    expect(
      screen.getByRole("img", { name: "過去6ヶ月の支出比較グラフ" })
    ).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "6ヶ月の比較" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    expect(screen.getByRole("button", { name: "単月の内訳" })).toHaveAttribute(
      "aria-pressed",
      "false"
    );
  });

  it("単月トグルで単月ペインへ戻れる（往復しても落ちない）", () => {
    viewWithSix();
    fireEvent.click(screen.getByRole("button", { name: "6ヶ月の比較" }));
    fireEvent.click(screen.getByRole("button", { name: "単月の内訳" }));
    expect(screen.getByRole("button", { name: "単月の内訳" })).toHaveAttribute(
      "aria-pressed",
      "true"
    );
    // 単月へ戻ると 6ヶ月ペインは再び aria-hidden になりグラフは a11y 木から消える
    expect(
      screen.queryByRole("img", { name: "過去6ヶ月の支出比較グラフ" })
    ).toBeNull();
  });
});
