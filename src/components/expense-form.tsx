"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
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
import { categoryColor } from "@/lib/category-color";
import type { Category, Expense } from "@/types";

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
  // 保存の成功後に呼ばれる（モーダルを閉じる・トースト・再取得は親が担当）。
  // categoryId は確定した支出のカテゴリ（ホームが選択状態に同期するのに使う）。
  onSuccess: (message: string, categoryId: string) => void;
};

const pad2 = (n: number) => String(n).padStart(2, "0");

// 送信前に画像を縮小して JPEG base64 化する。長辺を 1568px に抑え、
// トークン量と通信量を削減する（Claude ビジョンの推奨上限に合わせる）。
// iOS 写真の EXIF 回転は createImageBitmap の imageOrientation で正す。
const OCR_MAX_EDGE = 1568;
async function fileToDownscaledJpeg(
  file: File
): Promise<{ base64: string; mediaType: "image/jpeg" }> {
  const bitmap = await createImageBitmap(file, {
    imageOrientation: "from-image",
  });
  const scale = Math.min(1, OCR_MAX_EDGE / Math.max(bitmap.width, bitmap.height));
  const w = Math.max(1, Math.round(bitmap.width * scale));
  const h = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("画像の処理に失敗しました");
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();
  const dataUrl = canvas.toDataURL("image/jpeg", 0.85);
  return { base64: dataUrl.split(",")[1] ?? "", mediaType: "image/jpeg" };
}

export function ExpenseForm({ categories, initial, onSuccess }: Props) {
  const isEdit = initial.id !== undefined;

  const [form, setForm] = useState({
    day: initial.day,
    categoryId: initial.categoryId,
    amount: initial.amount,
    storeName: initial.storeName,
    memo: initial.memo,
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ocrLoading, setOcrLoading] = useState(false);
  const [ocrError, setOcrError] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // レシート画像を読み取り、取得できた項目をフォームに反映する。
  const handleReceiptFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 同じファイルを連続選択できるようにリセット
    if (!file) return;
    setOcrError(null);
    setOcrLoading(true);
    try {
      const { base64, mediaType } = await fileToDownscaledJpeg(file);
      const res = await fetch("/api/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageBase64: base64, mediaType }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.error ?? "読み取りに失敗しました");
      }
      const { amount, storeName, spentAt, categoryId } = data as {
        amount: number | null;
        storeName: string | null;
        spentAt: string | null;
        categoryId: string | null;
      };

      setForm((p) => {
        const next = { ...p };
        if (typeof amount === "number" && amount >= 0) {
          next.amount = String(Math.trunc(amount)).slice(0, AMOUNT_MAX_DIGITS);
        }
        if (storeName) next.storeName = storeName.slice(0, STORE_MAX);
        if (categoryId && categories.some((c) => c.id === categoryId)) {
          next.categoryId = categoryId;
        }
        // 日付は年月がフォームの表示月と一致するときだけ「日」を反映する
        // （年月は固定表示のため）。
        if (spentAt && /^\d{4}-\d{2}-\d{2}$/.test(spentAt)) {
          const [y, m, d] = spentAt.split("-").map(Number);
          const lastDay = new Date(Date.UTC(initial.year, initial.month, 0)).getUTCDate();
          if (y === initial.year && m === initial.month && d >= 1 && d <= lastDay) {
            next.day = d;
          }
        }
        return next;
      });

      if (amount == null && !storeName && !spentAt && !categoryId) {
        setOcrError("レシートから情報を読み取れませんでした");
      }
    } catch (err) {
      setOcrError(err instanceof Error ? err.message : "読み取りに失敗しました");
    } finally {
      setOcrLoading(false);
    }
  };

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
      const spentAt = `${initial.year}-${pad2(initial.month)}-${pad2(form.day)}`;
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
      onSuccess(isEdit ? "更新しました" : "保存しました", form.categoryId);
    } catch (err) {
      setError(err instanceof Error ? err.message : "エラーが発生しました");
      setSubmitting(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-5 px-4 py-5">
      {/* レシート読み取り（カメラ起動 → 縮小 → OCR → 各項目に自動入力） */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleReceiptFile}
      />
      <Button
        type="button"
        variant="outline"
        className="w-full gap-2"
        disabled={submitting || ocrLoading}
        onClick={() => fileInputRef.current?.click()}
      >
        {ocrLoading ? (
          <Loader2 className="size-4 animate-spin" />
        ) : (
          <Camera className="size-4" />
        )}
        {ocrLoading ? "読み取り中…" : "レシートを読み取る"}
      </Button>
      {ocrError && (
        <p className="-mt-2 text-sm text-destructive" role="alert">
          {ocrError}
        </p>
      )}

      {/* 日付（年月固定。日は縦ホイールを「YYYY年M月 d 日」の d に埋め込む） */}
      <div className="flex items-center justify-center gap-1.5 text-xl font-bold">
        <span>
          {initial.year}年{initial.month}月
        </span>
        <DayWheel
          year={initial.year}
          month={initial.month}
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
                return (
                  <span
                    className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-medium ${categoryColor(c.sortOrder).tag}`}
                  >
                    {c.name}
                  </span>
                );
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {categories.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                <span
                  className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-medium ${categoryColor(c.sortOrder).tag}`}
                >
                  {c.name}
                </span>
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

      {/* 保存（半分幅・必須が空ならグレー） */}
      <div className="flex justify-center pt-1">
        <Button type="submit" disabled={submitting || !isValid} className="w-1/2">
          {submitting ? "保存中…" : isEdit ? "更新する" : "保存する"}
        </Button>
      </div>
    </form>
  );
}
