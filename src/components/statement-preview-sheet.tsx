"use client";

import { useState } from "react";
import { BottomSheet } from "@/components/bottom-sheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CategoryTag } from "@/components/category-tag";
import { lastDayOfMonth } from "@/lib/date";
import type { Category } from "@/types";
import type { StatementRow, BatchExpenseResult } from "@/types/api";

const AMOUNT_MAX_DIGITS = 9;
const STORE_MAX = 32;

type EditRow = {
  include: boolean;
  amount: string; // 数字のみ（負の符号は持たない）
  spentAt: string; // YYYY-MM-DD
  categoryId: string;
  storeName: string;
  duplicateLikely: boolean;
  isRefund: boolean; // 抽出時の金額が負（返金）。既定は取込OFF。
};

function isValidYmd(s: string): boolean {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return false;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  const d = Number(m[3]);
  return mo >= 1 && mo <= 12 && d >= 1 && d <= lastDayOfMonth(y, mo);
}

type Props = {
  rows: StatementRow[];
  categories: Category[]; // 有効カテゴリのみ
  panelStyle: React.CSSProperties;
  backdropStyle: React.CSSProperties;
  dragHandlers: React.ComponentProps<typeof BottomSheet>["dragHandlers"];
  onClose: () => void;
  // 一括登録の成功後に呼ぶ（count = 登録件数、month = 同期したいホーム表示月）。
  onDone: (count: number, month?: { year: number; month: number }) => void;
};

// クレカ明細の取り込みプレビュー。全行を読み込み、登録する行を行トグルで選ぶ。
// 各行は日付・金額・カテゴリ・店名をインライン編集できる。重複候補/返金はバッジで明示。
export function StatementPreviewSheet({
  rows,
  categories,
  panelStyle,
  backdropStyle,
  dragHandlers,
  onClose,
  onDone,
}: Props) {
  const [items, setItems] = useState<EditRow[]>(() =>
    rows.map((r) => {
      const isRefund = typeof r.amount === "number" && r.amount < 0;
      return {
        // 返金（負）・金額なしは既定 OFF。それ以外は ON。
        include: typeof r.amount === "number" && r.amount >= 0,
        amount: r.amount == null ? "" : String(Math.abs(r.amount)),
        spentAt: r.spentAt ?? "",
        categoryId: r.categoryId ?? "",
        storeName: r.storeName ?? "",
        duplicateLikely: r.duplicateLikely,
        isRefund,
      };
    })
  );
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const update = (i: number, patch: Partial<EditRow>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const rowComplete = (it: EditRow) =>
    it.amount !== "" && isValidYmd(it.spentAt) && it.categoryId !== "";

  const included = items.filter((it) => it.include);
  const includedCount = included.length;
  const canSubmit =
    includedCount > 0 && included.every(rowComplete) && !submitting;

  const submit = async () => {
    if (!canSubmit) return;
    setSubmitting(true);
    setError(null);
    const payload = items
      .filter((it) => it.include)
      .map((it) => ({
        amount: Number(it.amount),
        spentAt: it.spentAt,
        categoryId: it.categoryId,
        storeName: it.storeName || null,
      }));
    try {
      const res = await fetch("/api/expenses/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload }),
      });
      const data = (await res.json().catch(() => ({}))) as Partial<
        BatchExpenseResult
      > & { error?: string };
      if (!res.ok) {
        throw new Error(
          data.error ?? data.errors?.[0]?.message ?? "登録に失敗しました"
        );
      }
      // 同期するホーム表示月: 登録した行の最新 spentAt の年月。
      const latest = payload.map((p) => p.spentAt).sort().at(-1);
      let month: { year: number; month: number } | undefined;
      if (latest) {
        const [y, m] = latest.split("-").map(Number);
        month = { year: y, month: m };
      }
      onDone(payload.length, month);
    } catch (err) {
      setError(err instanceof Error ? err.message : "登録に失敗しました");
      setSubmitting(false);
    }
  };

  return (
    <BottomSheet
      ariaLabel="クレジットカード明細の取り込み"
      title="明細を取り込む"
      onClose={onClose}
      panelStyle={panelStyle}
      backdropStyle={backdropStyle}
      draggable
      dragHandlers={dragHandlers}
    >
      <div
        className="px-4 py-4 space-y-3"
        style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
      >
        <p className="text-xs text-muted-foreground">
          {items.length}件を読み取りました。登録する行を選んでください。
        </p>

        {items.map((it, i) => (
          <div
            key={i}
            className={`rounded-xl border p-3 space-y-2 ${
              it.include ? "border-border" : "border-border/40 opacity-60"
            }`}
          >
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={it.include}
                onChange={(e) => update(i, { include: e.target.checked })}
                className="size-4 shrink-0 accent-primary"
                aria-label="この行を登録する"
              />
              <input
                type="date"
                value={it.spentAt}
                onChange={(e) => update(i, { spentAt: e.target.value })}
                className="h-9 rounded-lg border border-border bg-background px-2 text-sm"
              />
              <div className="relative flex-1">
                <span className="absolute left-2 top-1/2 -translate-y-1/2 text-sm text-muted-foreground">
                  ¥
                </span>
                <Input
                  value={it.amount}
                  inputMode="numeric"
                  placeholder="0"
                  className="h-9 pl-6 text-right text-sm"
                  onChange={(e) =>
                    update(i, {
                      amount: e.target.value
                        .replace(/[^0-9]/g, "")
                        .slice(0, AMOUNT_MAX_DIGITS),
                    })
                  }
                />
              </div>
            </div>

            <div className="flex items-center gap-2">
              <Select
                value={it.categoryId || null}
                onValueChange={(v) =>
                  update(i, { categoryId: (v as string) ?? "" })
                }
              >
                <SelectTrigger className="h-9 flex-1 rounded-lg text-sm data-[size=default]:h-9">
                  <SelectValue>
                    {(value) => {
                      const c = categories.find((x) => x.id === value);
                      if (!c) {
                        return (
                          <span className="text-muted-foreground/60">
                            カテゴリ
                          </span>
                        );
                      }
                      return (
                        <CategoryTag
                          name={c.name}
                          sortOrder={c.sortOrder}
                          truncate
                        />
                      );
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
              <Input
                value={it.storeName}
                placeholder="店名"
                maxLength={STORE_MAX}
                className="h-9 flex-1 text-sm"
                onChange={(e) =>
                  update(i, { storeName: e.target.value.slice(0, STORE_MAX) })
                }
              />
            </div>

            {(it.duplicateLikely ||
              it.isRefund ||
              (it.include && !rowComplete(it))) && (
              <div className="flex flex-wrap gap-1.5 text-[11px]">
                {it.duplicateLikely && (
                  <span className="rounded-full bg-amber-100 px-2 py-0.5 text-amber-800">
                    重複かも
                  </span>
                )}
                {it.isRefund && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-muted-foreground">
                    返金（既定OFF）
                  </span>
                )}
                {it.include && !rowComplete(it) && (
                  <span className="rounded-full bg-destructive/10 px-2 py-0.5 text-destructive">
                    未入力あり
                  </span>
                )}
              </div>
            )}
          </div>
        ))}

        {error && (
          <p className="text-sm text-destructive" role="alert">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-4 bg-card px-4 pt-2 pb-1">
          <Button onClick={submit} disabled={!canSubmit} className="w-full">
            {submitting ? "登録中…" : `${includedCount}件を登録する`}
          </Button>
        </div>
      </div>
    </BottomSheet>
  );
}
