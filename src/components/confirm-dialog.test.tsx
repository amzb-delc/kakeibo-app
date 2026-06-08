// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, screen, fireEvent, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";
import { ConfirmDialog } from "./confirm-dialog";

afterEach(() => {
  cleanup();
});

const base = {
  title: "この支出を削除しますか？",
  confirmLabel: "削除する",
  onConfirm: () => {},
  onCancel: () => {},
};

describe("ConfirmDialog", () => {
  it("タイトル・説明・2ボタンを表示", () => {
    render(<ConfirmDialog {...base} description="この操作は取り消せません。" />);
    expect(screen.getByText("この支出を削除しますか？")).toBeInTheDocument();
    expect(screen.getByText("この操作は取り消せません。")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "削除する" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "キャンセル" })).toBeInTheDocument();
  });

  it("confirm / cancel ボタンで各コールバックを呼ぶ", () => {
    const onConfirm = vi.fn();
    const onCancel = vi.fn();
    render(<ConfirmDialog {...base} onConfirm={onConfirm} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("button", { name: "削除する" }));
    fireEvent.click(screen.getByRole("button", { name: "キャンセル" }));
    expect(onConfirm).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledTimes(1);
  });

  it("busy 中はボタンを無効化し busyLabel を出す", () => {
    const onConfirm = vi.fn();
    render(
      <ConfirmDialog {...base} busy busyLabel="削除中…" onConfirm={onConfirm} />
    );
    const confirm = screen.getByRole("button", { name: "削除中…" });
    expect(confirm).toBeDisabled();
    fireEvent.click(confirm);
    expect(onConfirm).not.toHaveBeenCalled();
  });

  it("背面クリックで onCancel（busy 中は無視）", () => {
    const onCancel = vi.fn();
    const { rerender } = render(<ConfirmDialog {...base} onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onCancel).toHaveBeenCalledTimes(1);

    onCancel.mockClear();
    rerender(<ConfirmDialog {...base} busy onCancel={onCancel} />);
    fireEvent.click(screen.getByRole("dialog"));
    expect(onCancel).not.toHaveBeenCalled();
  });
});
