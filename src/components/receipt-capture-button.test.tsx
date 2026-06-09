// @vitest-environment jsdom
import "@testing-library/jest-dom/vitest";
import { render, fireEvent, waitFor, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, afterEach } from "vitest";

// 画像縮小・/api/ocr 送信はフックの責務。ここではフックを差し替え、ボタンの
// 「結果の振り分け（onResult / onError）」に集中する。
const read = vi.fn();
vi.mock("@/components/use-receipt-ocr", () => ({
  useReceiptOcr: () => ({ loading: false, error: null, setError: vi.fn(), read }),
}));

import { ReceiptCaptureButton } from "./receipt-capture-button";

afterEach(() => {
  cleanup();
  vi.clearAllMocks();
});

const file = new File(["x"], "receipt.jpg", { type: "image/jpeg" });
const fileInput = (c: HTMLElement) =>
  c.querySelector('input[type="file"]') as HTMLInputElement;

describe("ReceiptCaptureButton", () => {
  it("抽出できたら onResult を呼ぶ（onError は呼ばない）", async () => {
    const result = { amount: 980, storeName: "店", spentAt: null, categoryId: null };
    read.mockResolvedValue(result);
    const onResult = vi.fn();
    const onError = vi.fn();
    const { container } = render(
      <ReceiptCaptureButton onResult={onResult} onError={onError} />
    );
    fireEvent.change(fileInput(container), { target: { files: [file] } });
    await waitFor(() => expect(onResult).toHaveBeenCalledWith(result));
    expect(onError).not.toHaveBeenCalled();
  });

  it("読み取り失敗（null）は onError、onResult は呼ばない", async () => {
    read.mockResolvedValue(null);
    const onResult = vi.fn();
    const onError = vi.fn();
    const { container } = render(
      <ReceiptCaptureButton onResult={onResult} onError={onError} />
    );
    fireEvent.change(fileInput(container), { target: { files: [file] } });
    await waitFor(() => expect(onError).toHaveBeenCalled());
    expect(onResult).not.toHaveBeenCalled();
  });

  it("抽出ゼロ（全項目空）は専用メッセージで onError", async () => {
    read.mockResolvedValue({
      amount: null,
      storeName: null,
      spentAt: null,
      categoryId: null,
    });
    const onResult = vi.fn();
    const onError = vi.fn();
    const { container } = render(
      <ReceiptCaptureButton onResult={onResult} onError={onError} />
    );
    fireEvent.change(fileInput(container), { target: { files: [file] } });
    await waitFor(() =>
      expect(onError).toHaveBeenCalledWith("レシートから情報を読み取れませんでした")
    );
    expect(onResult).not.toHaveBeenCalled();
  });
});
