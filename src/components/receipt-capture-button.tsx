"use client";

import { useRef } from "react";
import { Camera, Loader2 } from "lucide-react";
import { useReceiptOcr } from "@/components/use-receipt-ocr";
import { cn } from "@/lib/utils";
import type { OcrResult } from "@/types/api";

type Props = {
  // 読み取れた抽出結果（少なくとも 1 項目は埋まっている）を返す。
  // フォームへの反映方法（カテゴリの妥当性・日付の月一致など）は呼び出し側の責務。
  onResult: (result: OcrResult) => void;
  // 読み取り失敗・抽出ゼロ時のメッセージ（トースト表示などに使う）。
  onError?: (message: string) => void;
  className?: string;
  // 既定アイコン（Camera）のサイズ等を上書きする（既定はモーダルヘッダー用の size-5）。
  // フッターなど大きめのタップ目標に置くとき size-10 等を渡す。読み取り中スピナーにも効く。
  iconClassName?: string;
  // 待機時のアイコンを丸ごと差し替える（例: 連続入力モードを表す“重ねカメラ”）。
  // 読み取り中は icon に関わらずスピナー（iconClassName でサイズ調整）。
  icon?: React.ReactNode;
  "aria-label"?: string;
};

// レシート撮影 → 縮小 → OCR → 結果コールバック、までを担う再利用可能なアイコンボタン。
// 支出モーダルのヘッダーと、将来のホーム動線で同じ部品を使い回す。
// 抽出結果をどこに反映するか（開いているフォーム / 新規作成で開く）は onResult 側で決める。
export function ReceiptCaptureButton({
  onResult,
  onError,
  className,
  iconClassName,
  icon,
  "aria-label": ariaLabel = "レシートを読み取る",
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { loading, read } = useReceiptOcr();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じ画像を連続選択できるようにリセット
    if (!file) return;
    const result = await read(file);
    if (!result) {
      onError?.("レシートの読み取りに失敗しました");
      return;
    }
    const { amount, storeName, spentAt, categoryId } = result;
    if (amount == null && !storeName && !spentAt && !categoryId) {
      onError?.("レシートから情報を読み取れませんでした");
      return;
    }
    onResult(result);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        aria-label={ariaLabel}
        disabled={loading}
        onClick={() => inputRef.current?.click()}
        className={cn(
          "w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-50 disabled:hover:bg-transparent",
          className
        )}
      >
        {loading ? (
          <Loader2 className={cn("size-5 animate-spin", iconClassName)} />
        ) : (
          icon ?? <Camera className={cn("size-5", iconClassName)} />
        )}
      </button>
    </>
  );
}
