// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, cleanup } from "@testing-library/react";
import { describe, it, expect, afterEach } from "vitest";
import { DeleteConfirmDetail } from "./expense-modal-parts";
import type { Category } from "@/types";

afterEach(() => cleanup());

const categories = [
  { id: "c1", name: "食費", sortOrder: 0, enabled: true },
  { id: "c2", name: "日用品", sortOrder: 1, enabled: true },
] as Category[];

const baseExpense = {
  id: "e1",
  amount: 1280,
  spentAt: "2026-06-03",
  categoryId: "c1",
  storeName: "スーパー",
  memo: null,
};

describe("DeleteConfirmDetail", () => {
  it("日付・カテゴリ・金額・店名を整形して表示する", () => {
    render(<DeleteConfirmDetail expense={baseExpense} categories={categories} />);
    expect(
      screen.getByText("6月3日・食費・¥1,280（スーパー）")
    ).toBeInTheDocument();
  });

  it("店名が無ければ括弧を付けない", () => {
    render(
      <DeleteConfirmDetail
        expense={{ ...baseExpense, storeName: null }}
        categories={categories}
      />
    );
    expect(screen.getByText("6月3日・食費・¥1,280")).toBeInTheDocument();
  });

  it("カテゴリが見つからなければ未分類と表示する", () => {
    render(
      <DeleteConfirmDetail
        expense={{ ...baseExpense, categoryId: "missing", storeName: null }}
        categories={categories}
      />
    );
    expect(screen.getByText("6月3日・未分類・¥1,280")).toBeInTheDocument();
  });
});
