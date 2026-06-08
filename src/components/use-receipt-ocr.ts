"use client";

import { useCallback, useState } from "react";
import type { ApiError, OcrResult } from "@/types/api";

// 送信前に画像を縮小して JPEG base64 化する。長辺を 1568px に抑え、
// トークン量と通信量を削減する（Claude ビジョンの推奨上限に合わせる）。
// iOS 写真の EXIF 回転は createImageBitmap の imageOrientation で正す。
const OCR_MAX_EDGE = 1568;
async function fileToDownscaledJpeg(
  file: File
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, OCR_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像の処理に失敗しました");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg" };
}

// レシート画像の縮小→/api/ocr 送信→抽出結果の取得を担うフック。
// 抽出結果をフォーム項目へどう反映するかは呼び出し側（フォーム）の責務。
// 以前は ExpenseForm に同居していた処理を切り出したもの。
export function useReceiptOcr() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // 画像を読み取り抽出結果を返す。失敗時は null（error に理由をセット）。
  const read = useCallback(async (file: File): Promise<OcrResult | null> => {
    setError(null);
    setLoading(true);
    try {
      const { base64, mediaType } = await fileToDownscaledJpeg(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error((data as ApiError).error ?? "読み取りに失敗しました");
      }
      return data as OcrResult;
    } catch (err) {
      setError(err instanceof Error ? err.message : "読み取りに失敗しました");
      return null;
    } finally {
      setLoading(false);
    }
  }, []);

  return { loading, error, setError, read };
}
