"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { todayJst } from "@/lib/date";
import type { Category, Expense } from "@/types";

type Props = {
  categories: Category[];
  expense?: Expense;
  // 編集モード時、保存・削除後の戻り先（ない場合はホームへ）
  backHref?: string;
};

type FormState = {
  amount: string;
  spentAt: string; // YYYY-MM-DD (JST)
  categoryId: string;
  storeName: string;
  memo: string;
};

type Pending = "idle" | "submitting" | "deleting" | "redirecting";

export function ExpenseForm({ categories, expense, backHref }: Props) {
  const router = useRouter();
  const isEdit = expense !== undefined;

  const [form, setForm] = useState<FormState>(() =>
    expense
      ? {
          amount: String(expense.amount),
          spentAt: expense.spentAt,
          categoryId: expense.categoryId,
          storeName: expense.storeName ?? "",
          memo: expense.memo ?? "",
        }
      : {
          amount: "",
          spentAt: todayJst(),
          categoryId: "",
          storeName: "",
          memo: "",
        }
  );
  const [pending, setPending] = useState<Pending>("idle");
  const [error, setError] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [toastFading, setToastFading] = useState(false);
  const [confirmingDelete, setConfirmingDelete] = useState(false);

  const isLocked = pending !== "idle";

  const finishWithToast = (message: string, redirect: string) => {
    setPending("redirecting");
    setToast(message);
    setToastFading(false);
    setTimeout(() => setToastFading(true), 1500);
    setTimeout(() => router.push(redirect), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (isLocked) return;
    setError(null);

    if (!form.amount || !form.spentAt || !form.categoryId) {
      setError("金額・支出日・カテゴリは必須です");
      return;
    }

    setPending("submitting");
    try {
      const url = expense ? `/api/expenses/${expense.id}` : "/api/expenses";
      const method = expense ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.amount),
          spentAt: form.spentAt,
          categoryId: form.categoryId,
          storeName: form.storeName || null,
          memo: form.memo || null,
        }),
      });

      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "保存に失敗しました");
      }

      const redirect = expense ? (backHref ?? "/") : "/";
      finishWithToast(expense ? "更新しました" : "保存しました", redirect);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setPending("idle");
    }
  };

  const handleDeleteConfirm = async () => {
    if (!expense || isLocked) return;
    setConfirmingDelete(false);
    setError(null);
    setPending("deleting");
    try {
      const res = await fetch(`/api/expenses/${expense.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "削除に失敗しました");
      }
      finishWithToast("削除しました", backHref ?? "/");
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setPending("idle");
    }
  };

  return (
    <>
      <form onSubmit={handleSubmit} className="space-y-5 px-4 py-6">
        <div>
          <Label htmlFor="amount">金額 *</Label>
          <div className="relative">
            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground text-lg">¥</span>
            <Input
              id="amount"
              type="text"
              inputMode="numeric"
              placeholder="0"
              className="pl-9 text-lg text-right"
              value={form.amount}
              disabled={isLocked}
              onChange={(e) => {
                const v = e.target.value.replace(/[^0-9]/g, "");
                setForm((prev) => ({ ...prev, amount: v }));
              }}
            />
          </div>
        </div>

        <div>
          <Label htmlFor="spentAt">日付 *</Label>
          <Input
            id="spentAt"
            type="date"
            value={form.spentAt}
            disabled={isLocked}
            onChange={(e) => setForm((prev) => ({ ...prev, spentAt: e.target.value }))}
          />
        </div>

        <div>
          <Label>カテゴリ *</Label>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-1" style={{ scrollSnapType: "x mandatory" }}>
            {categories.map((c) => (
              <button
                key={c.id}
                type="button"
                disabled={isLocked}
                style={{ scrollSnapAlign: "start" }}
                className={`shrink-0 px-4 h-10 rounded-full text-sm transition-colors ${
                  form.categoryId === c.id
                    ? "bg-primary text-white font-medium"
                    : "bg-gray-100 text-gray-700"
                } disabled:opacity-50`}
                onClick={() => setForm((prev) => ({ ...prev, categoryId: c.id }))}
              >
                {c.name}
              </button>
            ))}
          </div>
        </div>

        <div>
          <Label htmlFor="storeName">店名（任意）</Label>
          <Input
            id="storeName"
            placeholder="例: スーパー〇〇"
            value={form.storeName}
            disabled={isLocked}
            onChange={(e) => setForm((prev) => ({ ...prev, storeName: e.target.value }))}
          />
        </div>

        <div>
          <Label htmlFor="memo">メモ（任意）</Label>
          <Textarea
            id="memo"
            placeholder="メモ"
            rows={2}
            value={form.memo}
            disabled={isLocked}
            onChange={(e) => setForm((prev) => ({ ...prev, memo: e.target.value }))}
          />
        </div>

        {error && (
          <p className="text-sm text-destructive" role="alert">{error}</p>
        )}

        <Button type="submit" disabled={isLocked}>
          {pending === "submitting"
            ? "保存中…"
            : isEdit
              ? "更新する"
              : "保存する"}
        </Button>

        {isEdit && (
          <button
            type="button"
            onClick={() => setConfirmingDelete(true)}
            disabled={isLocked}
            className="w-full h-12 rounded-xl text-destructive border border-destructive/30 text-base font-medium hover:bg-destructive/5 transition-colors disabled:opacity-50"
          >
            {pending === "deleting" ? "削除中…" : "削除する"}
          </button>
        )}
      </form>

      {/* 削除確認ダイアログ */}
      {confirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
          className="fixed inset-0 z-30 flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => setConfirmingDelete(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-2xl p-5 m-0 sm:m-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-title" className="text-base font-semibold mb-2">
              この支出を削除しますか？
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 h-12 rounded-xl border border-border text-base font-medium hover:bg-muted transition-colors"
              >
                キャンセル
              </button>
              <button
                type="button"
                onClick={handleDeleteConfirm}
                className="flex-1 h-12 rounded-xl bg-destructive text-white text-base font-medium hover:bg-destructive/90 transition-colors"
              >
                削除する
              </button>
            </div>
          </div>
        </div>
      )}

      {/* トースト */}
      {toast && (
        <div
          role="status"
          aria-live="polite"
          className={`fixed bottom-6 left-4 right-4 bg-foreground text-background rounded-xl px-4 py-3 text-sm font-medium text-center transition-all duration-300 ${
            toastFading
              ? "opacity-0 translate-y-2"
              : "opacity-100 translate-y-0 animate-in slide-in-from-bottom"
          }`}
        >
          {toast}
        </div>
      )}
    </>
  );
}
