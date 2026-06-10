"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useBottomSheet } from "@/components/bottom-sheet";
import { useExpenseModal } from "@/components/expense-modal";
import { StatementPreviewSheet } from "@/components/statement-preview-sheet";
import type { StatementRow } from "@/types/api";

type ContextValue = {
  // 抽出した明細行でプレビューシートを開く。
  openPreview: (rows: StatementRow[]) => void;
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

  const openPreview = useCallback(
    (next: StatementRow[]) => {
      setRows(next);
      open();
    },
    [open]
  );

  return (
    <StatementImportContext.Provider value={{ openPreview, notify }}>
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
