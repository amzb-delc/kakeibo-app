// @vitest-environment jsdom
import { renderHook, act, cleanup } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useReceiptOcr } from "./use-receipt-ocr";
import type { OcrResult } from "@/types/api";

const OCR: OcrResult = {
  amount: 1280,
  storeName: "スーパー〇〇",
  spentAt: "2026-06-08",
  categoryId: "c1",
};

beforeEach(() => {
  // 画像縮小（createImageBitmap + canvas）は jsdom 非対応のためモックする。
  vi.stubGlobal(
    "createImageBitmap",
    vi.fn(async () => ({ width: 2000, height: 1000, close: vi.fn() }))
  );
  vi.spyOn(HTMLCanvasElement.prototype, "getContext").mockReturnValue({
    drawImage: vi.fn(),
  } as unknown as CanvasRenderingContext2D);
  vi.spyOn(HTMLCanvasElement.prototype, "toDataURL").mockReturnValue(
    "data:image/jpeg;base64,QUJD"
  );
});

afterEach(() => {
  cleanup();
  vi.unstubAllGlobals();
  vi.restoreAllMocks();
});

const file = () =>
  new File([new Uint8Array([1, 2, 3])], "receipt.jpg", { type: "image/jpeg" });

describe("useReceiptOcr", () => {
  it("成功時は抽出結果を返し、loading が戻り error は null", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({ ok: true, json: async () => OCR }))
    );
    const { result } = renderHook(() => useReceiptOcr());
    let out: OcrResult | null = null;
    await act(async () => {
      out = await result.current.read(file());
    });
    expect(out).toEqual(OCR);
    expect(result.current.loading).toBe(false);
    expect(result.current.error).toBeNull();
    expect(fetch).toHaveBeenCalledWith(
      "/api/ocr",
      expect.objectContaining({ method: "POST" })
    );
  });

  it("非OKレスポンスは null を返し、error にサーバーメッセージ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => ({
        ok: false,
        json: async () => ({ error: "画像が大きすぎます" }),
      }))
    );
    const { result } = renderHook(() => useReceiptOcr());
    let out: OcrResult | null = OCR;
    await act(async () => {
      out = await result.current.read(file());
    });
    expect(out).toBeNull();
    expect(result.current.error).toBe("画像が大きすぎます");
  });

  it("通信エラーは null を返し、フォールバックメッセージ", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async () => {
        throw new Error("network down");
      })
    );
    const { result } = renderHook(() => useReceiptOcr());
    let out: OcrResult | null = OCR;
    await act(async () => {
      out = await result.current.read(file());
    });
    expect(out).toBeNull();
    expect(result.current.error).toBe("network down");
  });
});
