"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useBottomSheet } from "@/components/bottom-sheet";
import { useExpenseModal } from "@/components/expense-modal";
import { useStatementImport } from "@/components/use-statement-import";
import { StatementPreviewSheet } from "@/components/statement-preview-sheet";
import type { StatementRow } from "@/types/api";

type ContextValue = {
  // PDF を読み取り、成功すればプレビューを開く。失敗・0件はトースト通知まで担う。
  importFile: (file: File) => Promise<void>;
  // PDF 抽出中かどうか（右ヘッダのキャラに「考え中」吹き出しを出すのに使う）。
  importing: boolean;
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
export function StatementImportProvider({
  children,
}: {
  children: React.ReactNode;
}) {
  const [rows, setRows] = useState<StatementRow[] | null>(null);
  const {
    mounted,
    open,
    close,
    panelStyle,
    backdropStyle,
    dragHandlers,
  } = useBottomSheet({ draggable: true, onClosed: () => setRows(null) });
  const { categories, notify, notifyBatch } = useExpenseModal();
  const { loading: importing, read } = useStatementImport();

  const openPreview = useCallback(
    (next: StatementRow[]) => {
      setRows(next);
      open();
    },
    [open]
  );

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
      openPreview(r.result.rows);
    },
    [read, notify, openPreview]
  );

  return (
    <StatementImportContext.Provider value={{ importFile, importing, notify }}>
      {children}

      {mounted && rows && (
        <StatementPreviewSheet
          rows={rows}
          categories={categories.filter((c) => c.enabled)}
          panelStyle={panelStyle}
          backdropStyle={backdropStyle}
          dragHandlers={dragHandlers}
          onClose={close}
          onDone={(count, month) => {
            close();
            notifyBatch(`${count}件を登録しました`, month);
          }}
        />
      )}
    </StatementImportContext.Provider>
  );
}
