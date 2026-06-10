// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import {
  render,
  screen,
  fireEvent,
  cleanup,
  act,
  within,
} from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { StatementPreviewSheet } from "./statement-preview-sheet";
import type { Category } from "@/types";
import type { StatementRow } from "@/types/api";

const CATEGORIES: Category[] = [
  { id: "c1", name: "食費", sortOrder: 0, enabled: true },
  { id: "c2", name: "日用品", sortOrder: 1, enabled: true },
];

// 通常 / 重複候補 / 返金（負） / 金額なし の4種を揃えた明細。
const ROWS: StatementRow[] = [
  {
    amount: 1000,
    spentAt: "2026-05-03",
    storeName: "スーパーA",
    categoryId: "c1",
    duplicateLikely: false,
  },
  {
    amount: 2000,
    spentAt: "2026-05-10",
    storeName: "店B",
    categoryId: "c1",
    duplicateLikely: true,
  },
  {
    amount: -500,
    spentAt: "2026-05-12",
    storeName: "返金C",
    categoryId: "c2",
    duplicateLikely: false,
  },
  {
    amount: null,
    spentAt: "2026-05-15",
    storeName: "店D",
    categoryId: "c1",
    duplicateLikely: false,
  },
];

function renderSheet(
  override: Partial<React.ComponentProps<typeof StatementPreviewSheet>> = {}
) {
  const props = {
    rows: ROWS,
    fileName: "5月明細.pdf",
    categories: CATEGORIES,
    panelStyle: {},
    backdropStyle: {},
    dragHandlers: {},
    onClose: vi.fn(),
    onReimport: vi.fn(),
    onDone: vi.fn(),
    ...override,
  };
  return { props, ...render(<StatementPreviewSheet {...props} />) };
}

const originalFetch = global.fetch;
beforeEach(() => {
  global.fetch = vi.fn();
});
afterEach(() => {
  cleanup();
  global.fetch = originalFetch;
});

describe("StatementPreviewSheet", () => {
  it("件数と読み取り期間（年補完・同年は to の年を省く）を表示する", () => {
    renderSheet();
    expect(
      screen.getByText("4件を読み取りました（2026/5/3〜5/15）")
    ).toBeInTheDocument();
  });

  it("既定の include: 通常=ON / 重複・返金・金額なし=OFF（=1件のみ登録対象）", () => {
    renderSheet();
    const checks = screen.getAllByRole("checkbox", {
      name: "この行を登録する",
    }) as HTMLInputElement[];
    expect(checks.map((c) => c.checked)).toEqual([true, false, false, false]);
    // 登録ボタンの件数も included と一致
    expect(
      screen.getByRole("button", { name: "1件を登録する" })
    ).toBeInTheDocument();
  });

  it("金額は絶対値（返金は符号を落とす）・金額なしは空欄で表示する", () => {
    renderSheet();
    const amounts = screen.getAllByPlaceholderText("0") as HTMLInputElement[];
    expect(amounts.map((a) => a.value)).toEqual(["1000", "2000", "500", ""]);
  });

  it("金額入力は数字のみ・6桁（¥999,999）までに制限する", () => {
    renderSheet();
    const amount = screen.getAllByPlaceholderText("0")[0] as HTMLInputElement;
    fireEvent.change(amount, { target: { value: "12ab34567" } });
    expect(amount.value).toBe("123456");
  });

  it("「選択行のみ表示」フィルタは aria-pressed でトグルする", () => {
    renderSheet();
    const filter = screen.getByRole("button", { name: "選択行のみ表示" });
    expect(filter).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(filter);
    expect(filter).toHaveAttribute("aria-pressed", "true");
  });

  it("一括選択メニューの「すべて」で全行を選択でき、登録件数が増える", () => {
    renderSheet();
    expect(
      screen.getByRole("button", { name: "1件を登録する" })
    ).toBeInTheDocument();

    fireEvent.click(screen.getByRole("button", { name: /一括選択/ }));
    fireEvent.click(screen.getByRole("button", { name: "すべて" }));

    expect(
      screen.getByRole("button", { name: "4件を登録する" })
    ).toBeInTheDocument();
    const checks = screen.getAllByRole("checkbox", {
      name: "この行を登録する",
    }) as HTMLInputElement[];
    expect(checks.every((c) => c.checked)).toBe(true);
  });

  it("登録: /api/expenses/batch へ選択行のみ送り（memo=ファイル名）、onDone に件数と最新月を渡す", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => ({ created: 1, errors: [] }),
    });
    const { props } = renderSheet();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1件を登録する" }));
    });

    expect(global.fetch).toHaveBeenCalledTimes(1);
    const [url, init] = (global.fetch as ReturnType<typeof vi.fn>).mock
      .calls[0];
    expect(url).toBe("/api/expenses/batch");
    expect(init.method).toBe("POST");
    const body = JSON.parse(init.body);
    // 既定で included なのは通常の1行だけ
    expect(body.rows).toEqual([
      {
        amount: 1000,
        spentAt: "2026-05-03",
        categoryId: "c1",
        storeName: "スーパーA",
        memo: "5月明細.pdf",
      },
    ]);
    // 登録した行の最新 spentAt の年月をホーム同期用に渡す
    expect(props.onDone).toHaveBeenCalledWith(1, { year: 2026, month: 5 });
  });

  it("登録失敗時はエラーメッセージを表示し onDone を呼ばない", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "登録に失敗しました" }),
    });
    const { props } = renderSheet();

    await act(async () => {
      fireEvent.click(screen.getByRole("button", { name: "1件を登録する" }));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("登録に失敗しました");
    expect(props.onDone).not.toHaveBeenCalled();
  });

  it("選択行が未入力（カテゴリ欠落）なら登録ボタンを無効化する", () => {
    renderSheet({
      rows: [
        {
          amount: 1000,
          spentAt: "2026-05-03",
          storeName: "店X",
          categoryId: null, // 未入力 → include は ON だが rowComplete=false
          duplicateLikely: false,
        },
      ],
    });
    const submit = screen.getByRole("button", { name: "1件を登録する" });
    expect(submit).toBeDisabled();
  });

  it("選択が0件なら登録ボタンを無効化する", () => {
    renderSheet();
    // 既定で唯一 ON の行を外す
    const firstCheck = screen.getAllByRole("checkbox", {
      name: "この行を登録する",
    })[0];
    fireEvent.click(firstCheck);
    expect(
      screen.getByRole("button", { name: "0件を登録する" })
    ).toBeDisabled();
  });

  it("「別のPDFを選び直す」で onReimport にファイルを渡す", () => {
    const { props, container } = renderSheet();
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["pdf"], "別.pdf", { type: "application/pdf" });
    fireEvent.change(input, { target: { files: [file] } });
    expect(props.onReimport).toHaveBeenCalledWith(file);
  });

  it("一括選択メニューには明細に登場するカテゴリだけを出す", () => {
    // 全行 c1 のみ → メニューに c2(日用品) は出ない
    renderSheet({
      rows: ROWS.map((r) => ({ ...r, categoryId: "c1" })),
    });
    fireEvent.click(screen.getByRole("button", { name: /一括選択/ }));
    const menu = screen.getByText("タップで行を一括選択/解除").parentElement!;
    expect(within(menu).getByText("食費")).toBeInTheDocument();
    expect(within(menu).queryByText("日用品")).toBeNull();
  });
});
