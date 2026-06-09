// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 本テストの対象外（別コンポーネント）の子は stub 化して送信/バリデーションに集中する。
vi.mock("@/components/wheel", () => ({ Wheel: () => null }));
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
      <ExpenseForm
        categories={categories}
        initial={initialCreate}
        keepOpen={false}
        onSuccess={vi.fn()}
      />
    );
    expect(screen.getByRole("button", { name: "保存する" })).toBeDisabled();
  });

  it("金額入力後に POST し、onSuccess(保存しました, categoryId) を呼ぶ", async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <ExpenseForm
        categories={categories}
        initial={initialCreate}
        keepOpen={false}
        onSuccess={onSuccess}
      />
    );
    fireEvent.change(container.querySelector("#amount")!, { target: { value: "1200" } });
    const save = screen.getByRole("button", { name: "保存する" });
    expect(save).toBeEnabled();
    fireEvent.click(save);
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("保存しました", "cat-1", {
        year: 2026,
        month: 6,
      })
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
      <ExpenseForm
        categories={categories}
        initial={initialEdit}
        keepOpen={false}
        onSuccess={onSuccess}
      />
    );
    fireEvent.click(screen.getByRole("button", { name: "更新する" }));
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("更新しました", "cat-1", {
        year: 2026,
        month: 6,
      })
    );
    const [url, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/expenses/e1");
    expect(opts.method).toBe("PATCH");
  });

  it("連続入力(keepOpen=true): onSuccess を {keepOpen:true} で呼び、金額をクリアして次へ", async () => {
    const onSuccess = vi.fn();
    const { container } = render(
      <ExpenseForm
        categories={categories}
        initial={initialCreate}
        keepOpen={true}
        onSuccess={onSuccess}
      />
    );
    const amount = container.querySelector("#amount") as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "1200" } });
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() =>
      expect(onSuccess).toHaveBeenCalledWith("保存しました", "cat-1", {
        keepOpen: true,
        year: 2026,
        month: 6,
      })
    );
    // 金額はクリアされ、続けて入力できる状態に戻る
    await waitFor(() => expect(amount.value).toBe(""));
  });

  it("ocrResult が渡るとフォーム各項目に反映され、保存時に送信される", async () => {
    const onSuccess = vi.fn();
    const ocr = {
      amount: 1500,
      storeName: "スーパー",
      spentAt: "2026-06-10",
      categoryId: "cat-1",
    };
    const { container } = render(
      <ExpenseForm
        categories={categories}
        initial={{ ...initialCreate, categoryId: "", amount: "" }}
        keepOpen={false}
        ocrResult={ocr}
        onSuccess={onSuccess}
      />
    );
    const amount = container.querySelector("#amount") as HTMLInputElement;
    const store = container.querySelector("#storeName") as HTMLInputElement;
    await waitFor(() => expect(amount.value).toBe("1500"));
    expect(store.value).toBe("スーパー");
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const [, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(JSON.parse(opts.body)).toMatchObject({
      amount: 1500,
      categoryId: "cat-1",
      spentAt: "2026-06-10",
      storeName: "スーパー",
    });
  });

  it("OCRの日付が別月でも年月日を丸ごと反映し、その月で送信する", async () => {
    const onSuccess = vi.fn();
    const ocr = {
      amount: 800,
      storeName: null,
      spentAt: "2026-03-15",
      categoryId: "cat-1",
    };
    const { container } = render(
      <ExpenseForm
        categories={categories}
        initial={{ ...initialCreate, categoryId: "" }}
        keepOpen={false}
        ocrResult={ocr}
        onSuccess={onSuccess}
      />
    );
    // OCR 反映を待つ（金額が入る）。年月日は Wheel(stub) のため送信内容で検証する。
    const amount = container.querySelector("#amount") as HTMLInputElement;
    await waitFor(() => expect(amount.value).toBe("800"));
    fireEvent.click(screen.getByRole("button", { name: "保存する" }));
    await waitFor(() => expect(onSuccess).toHaveBeenCalled());
    const [, opts] = (fetch as unknown as ReturnType<typeof vi.fn>).mock.calls[0];
    // 別月（初期6月→レシート3月）でも年月日を丸ごと反映して送信する
    expect(JSON.parse(opts.body)).toMatchObject({
      amount: 800,
      spentAt: "2026-03-15",
      categoryId: "cat-1",
    });
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
        keepOpen={false}
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
