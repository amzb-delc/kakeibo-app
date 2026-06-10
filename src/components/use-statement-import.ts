"use client";

import { useCallback, useState } from "react";
import type { ApiError, StatementExtractResult } from "@/types/api";

// PDF を base64 化する（画像と違い縮小はしない。そのまま Claude の document ブロックへ渡す）。
async function fileToBase64(file: File): Promise<string> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  let binary = "";
  const CHUNK = 0x8000;
  for (let i = 0; i < bytes.length; i += CHUNK) {
    binary += String.fromCharCode(...bytes.subarray(i, i + CHUNK));
  }
  return btoa(binary);
}

type ReadResult =
  | { ok: true; result: StatementExtractResult }
  | { ok: false; message: string };

// クレカ明細PDFの base64 化 →/api/statement 送信 → 抽出結果の取得を担うフック。
// 抽出結果（行配列）をどう扱うか（プレビュー表示・編集）は呼び出し側の責務。
export function useStatementImport() {
  const [loading, setLoading] = useState(false);

  const read = useCallback(async (file: File): Promise<ReadResult> => {
    setLoading(true);
    try {
      const pdfBase64 = await fileToBase64(file);
      const res = await fetch("/api/statement", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ pdfBase64 }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        return {
          ok: false,
          message: (data as ApiError).error ?? "読み取りに失敗しました",
        };
      }
      return { ok: true, result: data as StatementExtractResult };
    } catch (err) {
      return {
        ok: false,
        message: err instanceof Error ? err.message : "読み取りに失敗しました",
      };
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, read };
}
