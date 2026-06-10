"use client";

import { Lock, Unlock } from "lucide-react";
import { Switch } from "@/components/ui/switch";
import { ReceiptCaptureButton } from "@/components/receipt-capture-button";
import type { ExpenseFormValues } from "@/components/expense-form";
import { formatYen } from "@/lib/format";
import type { Category } from "@/types";
import type { OcrResult } from "@/types/api";

// expense-modal のヘッダー/削除確認まわりの表示部品。Provider 本体を状態＋ハンドラに
// 絞るため、JSX が重い部分をここへ分離する（ロジックは持たない純粋な表示）。

// 新規登録シートのヘッダー右に置くアクション（レシート撮影＋連続入力トグル）。
// 錠アイコンはスイッチのトラック内・サムの反対側の余白に描く（OFF=右に開錠 / ON=左に閉錠）。
export function CreateHeaderActions({
  keepOpen,
  onKeepOpenChange,
  onOcrResult,
  onError,
}: {
  keepOpen: boolean;
  onKeepOpenChange: (next: boolean) => void;
  onOcrResult: (result: OcrResult) => void;
  onError: (message: string) => void;
}) {
  return (
    <div className="flex items-center gap-0.5">
      <ReceiptCaptureButton onResult={onOcrResult} onError={onError} />
      <Switch
        checked={keepOpen}
        onCheckedChange={onKeepOpenChange}
        aria-label="連続入力（保存後も続けて入力）"
      >
        <Lock
          className="pointer-events-none absolute left-1.5 top-1/2 size-4 -translate-y-1/2 text-white group-data-[unchecked]:hidden"
          aria-hidden="true"
        />
        <Unlock
          className="pointer-events-none absolute right-1.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground group-data-[checked]:hidden"
          aria-hidden="true"
        />
      </Switch>
    </div>
  );
}

// 削除確認ダイアログに掲出する対象の説明（日付・カテゴリ・金額・店名）。
export function DeleteConfirmDetail({
  expense,
  categories,
}: {
  expense: ExpenseFormValues;
  categories: Category[];
}) {
  const [, m, d] = expense.spentAt.split("-").map(Number);
  const catName =
    categories.find((c) => c.id === expense.categoryId)?.name ?? "未分類";
  return (
    <span className="font-medium">
      {m}月{d}日・{catName}・{formatYen(expense.amount)}
      {expense.storeName ? `（${expense.storeName}）` : ""}
    </span>
  );
}
