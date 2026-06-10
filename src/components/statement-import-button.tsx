"use client";

import { useRef } from "react";
import { FolderInput } from "lucide-react";
import { useStatementImportPreview } from "@/components/statement-import-provider";
import { cn } from "@/lib/utils";

// フォルダタップ → 先に案内トーストを出し、少し間を置いてからピッカーを開く。
// 注意: iOS では input.click() をタップと同じ実行コンテキスト外（setTimeout 内）で
// 呼ぶとブロックされる場合がある。実機での動作確認が必須。
const PICKER_DELAY_MS = 700;

// ホームのヘッダ左に置く「フォルダ」アイコンボタン。
// タップで PDF ファイルピッカー → 抽出 → プレビューシートを開く。
// 抽出中の「考え中」表示は右ヘッダのキャラ（HeaderCharacter）側で出す。
// 未保存（unlocked でない）ときは呼び出し側（page.tsx）で非表示にする。
export function StatementImportButton({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFile, importing, notify } = useStatementImportPreview();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じPDFを連続選択できるようにリセット
    if (!file) return;
    await importFile(file);
  };

  const handleClick = () => {
    notify("PDFヲエランデクダサイ");
    // トーストを一瞬見せてからピッカーを開く（iOS では開かない可能性あり・要実機確認）
    setTimeout(() => inputRef.current?.click(), PICKER_DELAY_MS);
  };

  return (
    <>
      <input
        ref={inputRef}
        type="file"
        accept="application/pdf"
        className="hidden"
        onChange={handleFile}
      />
      <button
        type="button"
        aria-label="クレジットカード明細を取り込む"
        disabled={importing}
        onClick={handleClick}
        className={cn(
          "w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50",
          className
        )}
      >
        <FolderInput className="size-6" aria-hidden="true" />
      </button>
    </>
  );
}
