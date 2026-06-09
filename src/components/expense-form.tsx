"use client";

import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { DayWheel } from "@/components/day-wheel";
import { CategoryTag } from "@/components/category-tag";
import { pad2, lastDayOfMonth } from "@/lib/date";
import type { Category, Expense } from "@/types";
import type { OcrResult } from "@/types/api";

// サマリー等から編集対象を渡すための型（フォームが必要とする項目のみ）
export type ExpenseFormValues = Pick<
  Expense,
  "id" | "amount" | "spentAt" | "categoryId" | "storeName" | "memo"
>;

// 入力欄がフォーム幅に収まる文字数の上限（入力時にハードキャップ）
const STORE_MAX = 32;
const MEMO_MAX = 140;
const AMOUNT_MAX_DIGITS = 9; // 100,000,000 まで

export type ExpenseFormInitial = {
  id?: string; // 編集時のみ
  year: number;
  month: number; // 1-12（固定表示）
  day: number;
  categoryId: string; // "" = 未選択
  amount: string; // "" = 未入力
  storeName: string;
  memo: string;
};

type Props = {
  categories: Category[];
  initial: ExpenseFormInitial;
  // 連続入力（ロック）トグルの状態。ON のとき保存してもシートを閉じず、続けて入力する。
  // トグル UI 自体はヘッダー（シート側）にあり、状態は親が保持する。
  keepOpen: boolean;
  // レシート OCR の抽出結果。撮影・読み取りはヘッダーの ReceiptCaptureButton が担当し、
  // 結果だけがここに渡る。キャプチャごとに新しい参照で渡り、フォームに反映する。
  ocrResult?: OcrResult | null;
  // 保存の成功後に呼ばれる（モーダルを閉じる・トースト・再取得は親が担当）。
  // categoryId は確定した支出のカテゴリ（ホームが選択状態に同期するのに使う）。
  // opts.keepOpen=true（連続入力）のとき、親はシートを閉じない。
  onSuccess: (
    message: string,
    categoryId: string,
    opts?: { keepOpen?: boolean }
  ) => void;
};

export function ExpenseForm({
  categories,
  initial,
  keepOpen,
  ocrResult,
  onSuccess,
}: Props) {
  const isEdit = initial.id !== undefined;

  // 年月は固定表示だが OCR で別月のレシートを読み取ったときに丸ごと差し替えられるよう
  // state に持つ（手動で月を変える UI は無い。日は DayWheel、年月は OCR のみが変える）。
  const [form, setForm] = useState({
    year: initial.year,
    month: initial.month,
    day: initial.day,
    categoryId: initial.categoryId,
    amount: initial.amount,
    storeName: initial.storeName,
    memo: initial.memo,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // OCR 結果が来たらフォームに反映する（撮影・読み取りはヘッダーの
  // ReceiptCaptureButton が担当し、結果だけが ocrResult として渡る）。
  // カテゴリの妥当性・日付の月一致といった反映ルールはフォーム側の責務。
  // ocrResult はキャプチャごとに新しい参照で渡るので、参照が変わったときだけ適用する
  // （categories の遅延ロード等で再適用してユーザー入力を上書きしないよう deps は絞る）。
  useEffect(() => {
    if (!ocrResult) return;
    const { amount, storeName, spentAt, categoryId } = ocrResult;
    setForm((p) => {
      const next = { ...p };
      if (typeof amount === "number" && amount >= 0) {
        next.amount = String(Math.trunc(amount)).slice(0, AMOUNT_MAX_DIGITS);
      }
      if (storeName) next.storeName = storeName.slice(0, STORE_MAX);
      if (categoryId && categories.some((c) => c.id === categoryId)) {
        next.categoryId = categoryId;
      }
      // 日付が有効なら年月日を丸ごと反映する（表示月もレシートの月になる）。
      if (spentAt && /^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
        const [y, m, d] = spentAt.split("-").map(Number);
        if (m >= 1 && m <= 12 && d >= 1 && d <= lastDayOfMonth(y, m)) {
          next.year = y;
          next.month = m;
          next.day = d;
        }
      }
      return next;
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ocrResult]);

  const amountEmpty = form.amount === "";
  const categoryEmpty = form.categoryId === "";
  // 金額は 0 も許可（未入力のみ不可）。カテゴリは選択必須。
  const isValid = !amountEmpty && !categoryEmpty;

  // 必須項目が空のときに枠を強調する
  const emphasizeEmpty = "border-primary/70 ring-1 ring-primary/25";
  const placeholderTone = "placeholder:text-muted-foreground/60";

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (submitting || !isValid) return;
    setError(null);
    setSubmitting(true);
    try {
      const spentAt = `${form.year}-${pad2(form.month)}-${pad2(form.day)}`;
      const url = isEdit ? `/api/expenses/${initial.id}` : "/api/expenses";
      const method = isEdit ? "PATCH" : "POST";
      const res = await fetch(url, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          amount: Number(form.amount),
          spentAt,
          categoryId: form.categoryId,
          storeName: form.storeName || null,
          memo: form.memo || null,
        }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data.error ?? "保存に失敗しました");
      }
      if (isEdit) {
        onSuccess("更新しました", form.categoryId);
      } else if (keepOpen) {
        // 連続入力: シートは開いたまま。日付＋カテゴリは残し、金額・店名・メモを
        // クリアして次の支出へ。金額に再フォーカスしてすぐ入力できるようにする。
        onSuccess("保存しました", form.categoryId, { keepOpen: true });
        setForm((p) => ({
          year: p.year,
          month: p.month,
          day: p.day,
          categoryId: p.categoryId,
          amount: "",
          storeName: "",
          memo: "",
        }));
        setError(null);
        setSubmitting(false);
        document.getElementById("amount")?.focus();
      } else {
        onSuccess("保存しました", form.categoryId);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5">
      {/* レシート読み取りはヘッダーの ReceiptCaptureButton に移動（結果は ocrResult で反映）。 */}

      {/* 日付（年月は手動では変えず OCR が差し替える。日は縦ホイールを
          「YYYY年M月 d 日」の d に埋め込む） */}
      <div className="flex items-center justify-center gap-1.5 text-xl font-bold">
        <span>
          {form.year}年{form.month}月
        </span>
        <DayWheel
          year={form.year}
          month={form.month}
          value={form.day}
          onChange={(d) => setForm((p) => ({ ...p, day: d }))}
          disabled={submitting}
        />
        <span>日</span>
      </div>

      {/* カテゴリ + 金額（横並び・ラベルなし） */}
      <div className="grid grid-cols-2 gap-3">
        <Select
          value={form.categoryId || null}
          onValueChange={(v) =>
            setForm((p) => ({ ...p, categoryId: (v as string) ?? "" }))
          }
          disabled={submitting}
        >
          <SelectTrigger
            className={`h-12 w-full rounded-xl px-3 text-base data-[size=default]:h-12 ${
              categoryEmpty ? emphasizeEmpty : ""
            }`}
          >
            <SelectValue>
              {(value) => {
                const c = categories.find((x) => x.id === value);
                if (!c) {
                  return <span className="text-muted-foreground/60">カテゴリ</span>;
                }
                return <CategoryTag name={c.name} sortOrder={c.sortOrder} />;
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <CategoryTag name={c.name} sortOrder={c.sortOrder} />
              </SelectItem>
            ))}
          </SelectContent>
        </Select>

        <div className="relative">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">
            ¥
          </span>
          <Input
            id="amount"
            type="text"
            inputMode="numeric"
            placeholder="0"
            className={`h-12 pl-7 text-right text-lg ${placeholderTone} ${
              amountEmpty ? emphasizeEmpty : ""
            }`}
            value={form.amount}
            disabled={submitting}
            onChange={(e) =>
              setForm((p) => ({
                ...p,
                amount: e.target.value
                  .replace(/[^0-9]/g, "")
                  .slice(0, AMOUNT_MAX_DIGITS),
              }))
            }
          />
        </div>
      </div>

      {/* 店名（ラベルなし） */}
      <Input
        id="storeName"
        placeholder="店名"
        maxLength={STORE_MAX}
        className={placeholderTone}
        value={form.storeName}
        disabled={submitting}
        onChange={(e) =>
          setForm((p) => ({ ...p, storeName: e.target.value.slice(0, STORE_MAX) }))
        }
      />

      {/* メモ（ラベルなし） */}
      <Textarea
        id="memo"
        placeholder="メモ"
        rows={3}
        maxLength={MEMO_MAX}
        className={`resize-none ${placeholderTone}`}
        value={form.memo}
        disabled={submitting}
        onChange={(e) =>
          setForm((p) => ({ ...p, memo: e.target.value.slice(0, MEMO_MAX) }))
        }
      />

      {error && (
        <p className="text-sm text-destructive" role="alert">
          {error}
        </p>
      )}

      {/* 保存（半分幅・必須が空ならグレー）。連続入力トグル（ON で保存後もシートを
          閉じず続けて入力）はヘッダー側にある。 */}
      <div className="flex flex-col items-center gap-3 pt-1">
        <Button type="submit" disabled={submitting || !isValid} className="w-1/2">
          {submitting ? "保存中…" : isEdit ? "更新する" : "保存する"}
        </Button>
      </div>
    </form>
  );
}
