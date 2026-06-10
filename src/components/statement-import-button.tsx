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
// 保持中の取り込みデータがある（pendingCount > 0）ときは再抽出せずプレビューを開き直し、
// 件数バッジを表示する。抽出中の「考え中」表示は右ヘッダのキャラ側で出す。
// 未保存（unlocked でない）ときは呼び出し側（page.tsx）で非表示にする。
export function StatementImportButton({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { importFile, pendingCount, reopen, notify } =
    useStatementImportPreview();
  const hasPending = pendingCount > 0;

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じPDFを連続選択できるようにリセット
    if (!file) return;
    await importFile(file);
  };

  const handleClick = () => {
    // 保持データがあれば再抽出せず開き直す（誤操作×からの復帰）。
    if (hasPending) {
      reopen();
      return;
    }
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
      <span className="relative inline-flex">
        <button
          type="button"
          aria-label={
            hasPending
              ? `取り込み中の明細を開く（${pendingCount}件）`
              : "クレジットカード明細を取り込む"
          }
          onClick={handleClick}
          className={cn(
            "w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors",
            className
          )}
        >
          <FolderInput className="size-6" aria-hidden="true" />
        </button>
        {hasPending && (
          <span
            aria-hidden="true"
            className="pointer-events-none absolute top-0.5 right-0.5 min-w-[1.05rem] h-[1.05rem] px-1 flex items-center justify-center rounded-full bg-primary text-primary-foreground text-[10px] font-bold leading-none tabular-nums"
          >
            {pendingCount}
          </span>
        )}
      </span>
    </>
  );
}
