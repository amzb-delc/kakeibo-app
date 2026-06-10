// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// 依存フック/子シートをモックし、Provider の context ロジックだけを検証する。
const h = vi.hoisted(() => ({
  open: vi.fn(),
  close: vi.fn(),
  notify: vi.fn(),
  notifyBatch: vi.fn(),
  read: vi.fn(),
  loading: false,
}));

vi.mock("./bottom-sheet", () => ({
  useBottomSheet: () => ({
    mounted: false, // プレビュー本体は描画しない（context だけ見る）
    open: h.open,
    close: h.close,
    panelStyle: {},
    backdropStyle: {},
    dragHandlers: {},
  }),
}));
vi.mock("./expense-modal", () => ({
  useExpenseModal: () => ({
    categories: [],
    notify: h.notify,
    notifyBatch: h.notifyBatch,
  }),
}));
vi.mock("./use-statement-import", () => ({
  useStatementImport: () => ({ loading: h.loading, read: h.read }),
}));
vi.mock("./statement-preview-sheet", () => ({
  StatementPreviewSheet: () => null,
}));

import {
  StatementImportProvider,
  useStatementImportPreview,
} from "./statement-import-provider";

function Consumer() {
  const { importFile, importing, pendingCount, reopen, notify } =
    useStatementImportPreview();
  return (
    <div>
      <span data-testid="count">{pendingCount}</span>
      <span data-testid="importing">{String(importing)}</span>
      <button onClick={() => importFile(new File(["x"], "明細.pdf"))}>
        import
      </button>
      <button onClick={reopen}>reopen</button>
      <button onClick={() => notify("直接通知")}>notify</button>
    </div>
  );
}

function renderProvider() {
  return render(
    <StatementImportProvider>
      <Consumer />
    </StatementImportProvider>
  );
}

beforeEach(() => {
  h.open.mockReset();
  h.close.mockReset();
  h.notify.mockReset();
  h.notifyBatch.mockReset();
  h.read.mockReset();
  h.loading = false;
});
afterEach(cleanup);

describe("StatementImportProvider", () => {
  it("初期は保持なし（pendingCount=0）", () => {
    renderProvider();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("読み取り成功: rows を保持してプレビューを開く（pendingCount が件数に）", async () => {
    h.read.mockResolvedValue({
      ok: true,
      result: {
        rows: [
          { amount: 100, spentAt: "2026-05-01", duplicateLikely: false },
          { amount: 200, spentAt: "2026-05-02", duplicateLikely: false },
        ],
      },
    });
    renderProvider();

    await act(async () => {
      fireEvent.click(screen.getByText("import"));
    });

    expect(h.open).toHaveBeenCalledTimes(1);
    expect(screen.getByTestId("count")).toHaveTextContent("2");
    expect(h.notify).not.toHaveBeenCalled();
  });

  it("読み取り失敗: メッセージをトースト通知し、保持しない", async () => {
    h.read.mockResolvedValue({ ok: false, message: "読み取れませんでした" });
    renderProvider();

    await act(async () => {
      fireEvent.click(screen.getByText("import"));
    });

    expect(h.notify).toHaveBeenCalledWith("読み取れませんでした");
    expect(h.open).not.toHaveBeenCalled();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("0件抽出: 専用メッセージを通知してプレビューは開かない", async () => {
    h.read.mockResolvedValue({ ok: true, result: { rows: [] } });
    renderProvider();

    await act(async () => {
      fireEvent.click(screen.getByText("import"));
    });

    expect(h.notify).toHaveBeenCalledWith("明細を読み取れませんでした");
    expect(h.open).not.toHaveBeenCalled();
    expect(screen.getByTestId("count")).toHaveTextContent("0");
  });

  it("importing は useStatementImport.loading を反映する", () => {
    h.loading = true;
    renderProvider();
    expect(screen.getByTestId("importing")).toHaveTextContent("true");
  });

  it("reopen は再抽出せずシートを開き直す", () => {
    renderProvider();
    fireEvent.click(screen.getByText("reopen"));
    expect(h.open).toHaveBeenCalledTimes(1);
    expect(h.read).not.toHaveBeenCalled();
  });

  it("notify は ExpenseModal の通知へ委譲する", () => {
    renderProvider();
    fireEvent.click(screen.getByText("notify"));
    expect(h.notify).toHaveBeenCalledWith("直接通知");
  });

  it("Provider の外で使うと例外を投げる", () => {
    const spy = vi.spyOn(console, "error").mockImplementation(() => {});
    expect(() => render(<Consumer />)).toThrow(
      /StatementImportProvider の内側/
    );
    spy.mockRestore();
  });
});
