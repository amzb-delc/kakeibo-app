"use client";

import { useId } from "react";

// 確認ダイアログ（下端 anchor / sm 以上は中央）。背面のシート等より前面（z-[70]）に重ねる。
// 削除確認などの自前実装を汎用化したもの。BottomSheet とは別物（グラバー/✕を持たず、
// 2択ボタンで完結する alert dialog）。
type ConfirmDialogProps = {
  title: string;
  description?: string;
  confirmLabel: string;
  /** busy 中に confirm ボタンへ出す文言（省略時は confirmLabel のまま） */
  busyLabel?: string;
  cancelLabel?: string;
  /** 処理中。両ボタンを無効化し、背面クリックでも閉じない */
  busy?: boolean;
  /** confirm を破壊的アクション色（赤）にする */
  destructive?: boolean;
  onConfirm: () => void;
  onCancel: () => void;
};

export function ConfirmDialog({
  title,
  description,
  confirmLabel,
  busyLabel,
  cancelLabel = "キャンセル",
  busy = false,
  destructive = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId();
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby={titleId}
      className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40"
      onClick={() => !busy && onCancel()}
    >
      <div
        className="w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-2xl p-5 m-0 sm:m-4 shadow-lg"
        onClick={(e) => e.stopPropagation()}
      >
        <h2 id={titleId} className="text-base font-semibold mb-2">
          {title}
        </h2>
        {description && (
          <p className="text-sm text-muted-foreground mb-5">{description}</p>
        )}
        <div className="flex gap-3">
          <button
            type="button"
            disabled={busy}
            onClick={onCancel}
            className="flex-1 h-12 rounded-xl border border-border text-base font-medium hover:bg-muted transition-colors disabled:opacity-50"
          >
            {cancelLabel}
          </button>
          <button
            type="button"
            disabled={busy}
            onClick={onConfirm}
            className={`flex-1 h-12 rounded-xl text-white text-base font-medium transition-colors disabled:opacity-50 ${
              destructive
                ? "bg-destructive hover:bg-destructive/90"
                : "bg-blue-600 hover:bg-blue-500"
            }`}
          >
            {busy ? busyLabel ?? confirmLabel : confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
