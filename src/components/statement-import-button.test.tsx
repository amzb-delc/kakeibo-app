// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";

// provider のコンテキストフックをモックして、ボタン単体の挙動だけを検証する。
const ctx = {
  importFile: vi.fn(),
  importing: false,
  pendingCount: 0,
  reopen: vi.fn(),
  notify: vi.fn(),
};
vi.mock("./statement-import-provider", () => ({
  useStatementImportPreview: () => ctx,
}));

import { StatementImportButton } from "./statement-import-button";

beforeEach(() => {
  vi.useFakeTimers();
  ctx.importFile.mockReset();
  ctx.reopen.mockReset();
  ctx.notify.mockReset();
  ctx.pendingCount = 0;
});
afterEach(() => {
  cleanup();
  vi.useRealTimers();
});

describe("StatementImportButton", () => {
  it("保持データなし: 取り込み用ラベルで描画し、バッジは出ない", () => {
    const { container } = render(<StatementImportButton />);
    expect(
      screen.getByRole("button", { name: "クレジットカード明細を取り込む" })
    ).toBeInTheDocument();
    // バッジ（pendingCount 表示）は無い
    expect(container.textContent).not.toMatch(/\d/);
  });

  it("保持データなしでタップ: 案内トースト → 遅延後にピッカーを開く", () => {
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<StatementImportButton />);

    fireEvent.click(
      screen.getByRole("button", { name: "クレジットカード明細を取り込む" })
    );

    expect(ctx.notify).toHaveBeenCalledWith("PDFヲエランデクダサイ");
    // トーストを見せる間はまだ開かない
    expect(clickSpy).not.toHaveBeenCalled();
    act(() => {
      vi.advanceTimersByTime(700);
    });
    expect(clickSpy).toHaveBeenCalledTimes(1);
    expect(ctx.reopen).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("保持データあり: 件数バッジと専用ラベルを出し、タップで再抽出せず開き直す", () => {
    ctx.pendingCount = 3;
    const clickSpy = vi.spyOn(HTMLInputElement.prototype, "click");
    render(<StatementImportButton />);

    const btn = screen.getByRole("button", {
      name: "取り込み中の明細を開く（3件）",
    });
    expect(btn).toBeInTheDocument();
    expect(screen.getByText("3")).toBeInTheDocument();

    fireEvent.click(btn);
    expect(ctx.reopen).toHaveBeenCalledTimes(1);
    expect(ctx.notify).not.toHaveBeenCalled();
    expect(clickSpy).not.toHaveBeenCalled();
    clickSpy.mockRestore();
  });

  it("ファイル選択で importFile に渡し、input は連続選択用にリセットされる", () => {
    const { container } = render(<StatementImportButton />);
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;
    const file = new File(["pdf"], "5月明細.pdf", { type: "application/pdf" });

    fireEvent.change(input, { target: { files: [file] } });

    expect(ctx.importFile).toHaveBeenCalledTimes(1);
    expect(ctx.importFile).toHaveBeenCalledWith(file);
    // 同じPDFを再選択できるよう value はクリアされる
    expect(input.value).toBe("");
  });

  it("ファイル未選択（キャンセル）では importFile を呼ばない", () => {
    const { container } = render(<StatementImportButton />);
    const input = container.querySelector(
      'input[type="file"]'
    ) as HTMLInputElement;

    fireEvent.change(input, { target: { files: [] } });
    expect(ctx.importFile).not.toHaveBeenCalled();
  });
});
