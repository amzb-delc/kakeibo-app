// @vitest-environment jsdom
import { renderHook, act } from "@testing-library/react";
import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { useStatementImport } from "./use-statement-import";

// フックは file.arrayBuffer() しか使わないので軽量なフェイクで足りる。
function fakeFile(): File {
  return {
    arrayBuffer: async () => new Uint8Array([1, 2, 3]).buffer,
  } as unknown as File;
}

const originalFetch = global.fetch;
afterEach(() => {
  global.fetch = originalFetch;
});
beforeEach(() => {
  global.fetch = vi.fn();
});

describe("useStatementImport", () => {
  it("初期は loading=false", () => {
    const { result } = renderHook(() => useStatementImport());
    expect(result.current.loading).toBe(false);
  });

  it("成功時: /api/statement へ pdfBase64 を POST し ok:true で結果を返す", async () => {
    const extract = { rows: [{ amount: 100, spentAt: "2026-05-03" }] };
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: true,
      json: async () => extract,
    });

    const { result } = renderHook(() => useStatementImport());
    let res: Awaited<ReturnType<typeof result.current.read>>;
    await act(async () => {
      res = await result.current.read(fakeFile());
    });

    expect(res!).toEqual({ ok: true, result: extract });
    expect(result.current.loading).toBe(false);

    const [url, opts] = (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0];
    expect(url).toBe("/api/statement");
    expect(opts.method).toBe("POST");
    expect(JSON.parse(opts.body)).toHaveProperty("pdfBase64");
  });

  it("エラー応答: ok:false でサーバの error メッセージを返す", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({ error: "PDFを読み取れませんでした" }),
    });

    const { result } = renderHook(() => useStatementImport());
    let res: Awaited<ReturnType<typeof result.current.read>>;
    await act(async () => {
      res = await result.current.read(fakeFile());
    });

    expect(res!).toEqual({ ok: false, message: "PDFを読み取れませんでした" });
    expect(result.current.loading).toBe(false);
  });

  it("エラー応答に error が無ければ既定メッセージ", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValue({
      ok: false,
      json: async () => ({}),
    });

    const { result } = renderHook(() => useStatementImport());
    let res: Awaited<ReturnType<typeof result.current.read>>;
    await act(async () => {
      res = await result.current.read(fakeFile());
    });

    expect(res!).toEqual({ ok: false, message: "読み取りに失敗しました" });
  });

  it("fetch が throw したら catch で ok:false（エラーメッセージ採用）", async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("network down")
    );

    const { result } = renderHook(() => useStatementImport());
    let res: Awaited<ReturnType<typeof result.current.read>>;
    await act(async () => {
      res = await result.current.read(fakeFile());
    });

    expect(res!).toEqual({ ok: false, message: "network down" });
    expect(result.current.loading).toBe(false);
  });
});
