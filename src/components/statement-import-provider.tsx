"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useBottomSheet } from "@/components/bottom-sheet";
import { useExpenseModal } from "@/components/expense-modal";
import { useStatementImport } from "@/components/use-statement-import";
import { StatementPreviewSheet } from "@/components/statement-preview-sheet";
import type { StatementRow } from "@/types/api";

// 取り込み済みデータを保持するセッション長（誤操作×からの再抽出を避ける）。
const SESSION_MS = 15 * 60 * 1000;

type ContextValue = {
  // PDF を読み取り、成功すればプレビューを開く。失敗・0件はトースト通知まで担う。
  importFile: (file: File) => Promise<void>;
  // PDF 抽出中かどうか（右ヘッダのキャラに「考え中」吹き出しを出すのに使う）。
  importing: boolean;
  // 保持中の明細件数（0 なら保持なし）。フォルダアイコンのバッジに使う。
  pendingCount: number;
  // 保持中のプレビューを再抽出なしで開き直す。
  reopen: () => void;
  // 読み取り失敗などのトースト（ExpenseModalProvider の Toast に表示）。
  notify: (message: string) => void;
};

const StatementImportContext = createContext<ContextValue | null>(null);

export function useStatementImportPreview(): ContextValue {
  const ctx = useContext(StatementImportContext);
  if (!ctx) {
    throw new Error(
      "useStatementImportPreview は StatementImportProvider の内側で使ってください"
    );
  }
  return ctx;
}

// クレカ明細プレビューシートの開閉状態を持つ Provider。
// ExpenseModalProvider の内側に置き、カテゴリ先読み・一括登録後の一覧再取得（notifyBatch）を借りる。
// 取り込んだ rows は ×（キャンセル）後も SESSION_MS の間メモリ保持し、フォルダアイコンから再開できる。
export function StatementImportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  // 取り込んだ PDF のファイル名（各支出の memo に入れる）。
  const [fileName, setFileName] = useState("");
  // 登録成功で閉じたか（onClosed で rows を破棄するか保持するかの分岐）。
  const consumedRef = useRef(false);
  // 15分セッションの破棄タイマー。
  const expiryRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const clearExpiry = useCallback(() => {
    if (expiryRef.current) {
      clearTimeout(expiryRef.current);
      expiryRef.current = null;
    }
  }, []);
  const startExpiry = useCallback(() => {
    clearExpiry();
    expiryRef.current = setTimeout(() => setRows(null), SESSION_MS);
  }, [clearExpiry]);

  const {
    mounted,
    open,
    close,
    panelStyle,
    backdropStyle,
    dragHandlers,
  } = useBottomSheet({
    draggable: true,
    // 閉じたとき: 登録済みなら破棄、キャンセルなら 15分タイマーで保持。
    onClosed: () => {
      if (consumedRef.current) {
        consumedRef.current = false;
        clearExpiry();
        setRows(null);
      } else if (rows) {
        startExpiry();
      }
    },
  });
  const { categories, notify, notifyBatch } = useExpenseModal();
  const { loading: importing, read } = useStatementImport();

  const openPreview = useCallback(
    (next: StatementRow[]) => {
      clearExpiry();
      setRows(next);
      open();
    },
    [open, clearExpiry]
  );

  // 保持中の rows をそのまま開き直す（再抽出しない）。
  const reopen = useCallback(() => {
    clearExpiry();
    open();
  }, [open, clearExpiry]);

  // PDF を読み取り → 失敗/0件はトースト、成功ならプレビューを開く。
  const importFile = useCallback(
    async (file: File) => {
      const r = await read(file);
      if (!r.ok) {
        notify(r.message);
        return;
      }
      if (r.result.rows.length === 0) {
        notify("明細を読み取れませんでした");
        return;
      }
      setFileName(file.name);
      openPreview(r.result.rows);
    },
    [read, notify, openPreview]
  );

  // アンマウント時にタイマー後始末。
  useEffect(() => () => clearExpiry(), [clearExpiry]);

  return (
    <StatementImportContext.Provider
      value={{
        importFile,
        importing,
        pendingCount: rows?.length ?? 0,
        reopen,
        notify,
      }}
    >
      {children}

      {mounted && rows && (
        <StatementPreviewSheet
          rows={rows}
          fileName={fileName}
          categories={categories.filter((c) => c.enabled)}
          panelStyle={panelStyle}
          backdropStyle={backdropStyle}
          dragHandlers={dragHandlers}
          onClose={close}
          onReimport={importFile}
          onDone={(count, month) => {
            consumedRef.current = true;
            close();
            notifyBatch(`${count}件を登録しました`, month);
          }}
        />
      )}
    </StatementImportContext.Provider>
  );
}
