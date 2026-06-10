"use client";

import { useRef } from "react";
import { FolderInput, Loader2 } from "lucide-react";
import { useStatementImport } from "@/components/use-statement-import";
import { useStatementImportPreview } from "@/components/statement-import-provider";
import { useSession } from "@/components/session-provider";
import { useSettingsModal } from "@/components/settings-modal";
import { cn } from "@/lib/utils";

// ホームのヘッダ左に置く「フォルダ」アイコンボタン。
// タップで PDF ファイルピッカー → 抽出 → プレビューシートを開く。
// 未保存（unlocked でない）ときは呼び出し側（page.tsx）で非表示にする。
export function StatementImportButton({ className }: { className?: string }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const { loading, read } = useStatementImport();
  const { openPreview, notify } = useStatementImportPreview();
  const { enteredBy } = useSession();
  const { openSettings } = useSettingsModal();

  // 入力者が未設定なら取り込みに進ませず設定モーダルへ誘導（登録前に必須）。
  const handleClick = () => {
    if (enteredBy == null) {
      openSettings();
      return;
    }
    inputRef.current?.click();
  };

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
