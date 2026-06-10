"use client";

import { useRef } from "react";
import { FolderInput, Loader2 } from "lucide-react";
import { useStatementImport } from "@/components/use-statement-import";
import { useStatementImportPreview } from "@/components/statement-import-provider";
import { cn } from "@/lib/utils";

// フォルダタップ → 先に案内トーストを出し、少し間を置いてからピッカーを開く。
// 注意: iOS では input.click() をタップと同じ実行コンテキスト外（setTimeout 内）で
// 呼ぶとブロックされる場合がある。実機での動作確認が必須。
const PICKER_DELAY_MS = 700;

// ホームのヘッダ左に置く「フォルダ」アイコンボタン。
// タップで PDF ファイルピッカー → 抽出 → プレビューシートを開く。
// 未保存（unlocked でない）ときは呼び出し側（page.tsx）で非表示にする。
export function StatementImportButton({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { loading, read } = useStatementImport();
  const { openPreview, notify } = useStatementImportPreview();

  const handleFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じPDFを連続選択できるようにリセット
    if (!file) return;
    const r = await read(file);
    if (!r.ok) {
      notify(r.message);
      return;
    }
    if (r.result.rows.length === 0) {
      notify("明細を読み取れませんでした");
      return;
    }
    openPreview(r.result.rows);
  };

  const handleClick = () => {
    notify("[PDF取込]クレカ明細を選んで下さい");
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
        disabled={loading}
        onClick={handleClick}
        className={cn(
          "w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors disabled:opacity-50",
          className
        )}
      >
        {loading ? (
          <Loader2 className="size-6 animate-spin" />
        ) : (
          <FolderInput className="size-6" aria-hidden="true" />
        )}
      </button>
    </>
  );
}
