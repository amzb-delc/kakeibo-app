// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 本テストの対象外（別コンポーネント）の子は stub 化して送信/バリデーションに集中する。
vi.mock("@/components/day-wheel", () => ({ DayWheel: () => null }));
vi.mock("@/components/ui/select", () => ({
  Select: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectTrigger: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectValue: () => null,
  SelectContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  SelectItem: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
}));

import { ExpenseForm } from "./expense-form";

const categories = [
  { id: "cat-1", name: "食費", sortOrder: 0, enabled: true },
];
const initialCreate = {
  year: 2026,
  month: 6,
  day: 8,
  categoryId: "cat-1",
  amount: "",
  storeName: "",
  memo: "",
};

beforeEach(() => {
  vi.stubGlobal("fetch", vi.fn(async () => ({ ok: true, json: async () => ({}) })));
});
afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

describe("ExpenseForm", () => {
  it("必須(金額)が空なら保存ボタンは disabled", () => {
    render(
      <ExpenseForm categories={categories} initial={initialCreate} onSuccess={vi.fn()} />
    );
    expect(screen.getByRole("button", { name: "保存する" })).toBeDisabled();
  });

  it("金額入力後に POST し、onSuccess(保存しました, categoryId) を呼ぶ", async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <ExpenseForm categories={categories} initial={initialCreate} onSuccess={onSuccess} />
    );
    fireEvent.change(container.querySelector("#amount")!, { target: { value: "1200" } });
    const save = screen.getByRole("button", { name: "保存する" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("保存しました", "cat-1")
    );
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/expenses");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toMatchObject({
      amount: 1200,
      spentAt: "2026-06-08",
      categoryId: "cat-1",
    });
  });

  it("編集モードは PATCH /api/expenses/:id し onSuccess(更新しました)", async () => {
    const onSuccess = vi.fn();
    const initialEdit = { ...initialCreate, id: "e1", amount: "500" };
    render(
      <ExpenseForm categories={categories} initial={initialEdit} onSuccess={onSuccess} />
    );
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("更新しました", "cat-1")
    );
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/expenses/e1");
    expect(opts.method).toBe("PATCH");
  });

  it("サーバーエラー時はエラー表示し onSuccess を呼ばない", async () => {
    const onSuccess = vi.fn();
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: false, json: async () => ({ error: "保存できません" }) }))
    );
    render(
      <ExpenseForm
        categories={categories}
        initial={{ ...initialCreate, amount: "300" }}
        onSuccess={onSuccess}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() =>
      expect(screen.getByText("保存できません")).toBeInTheDocument()
    );
    expect(onSuccess).not.toHaveBeenCalled();
  });
});
