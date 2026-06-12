"use client";

import { useRef, useState } from "react";
import { Check, ChevronDown, Filter, Minus, Tags } from "lucide-react";
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
import { cn } from "@/lib/utils";
import type { Category } from "@/types";
import type { StatementRow, BatchExpenseResult } from "@/types/api";

const AMOUNT_MAX_DIGITS = 6; // 6桁まで（最大 ¥999,999）

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

// 行表示用に年を落として M/D だけにする（スペース節約）。
function monthDay(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "日付";
  return `${Number(m[2])}/${Number(m[3])}`;
}

// 期間表記用に Y/M/D（行内では年を省いているので、ここで補完する）。
function ymd(s: string): string {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  if (!m) return "";
  return `${Number(m[1])}/${Number(m[2])}/${Number(m[3])}`;
}

type Props = {
  rows: StatementRow[];
  // 取り込んだ PDF のファイル名。各支出の memo に自動入力する。
  fileName: string;
  // 抽出したカード名（1PDF=1カード）。ヘッダに表示し、batch payload に同梱して card タグ化する。
  cardName: string | null;
  categories: Category[]; // 有効カテゴリのみ
  panelStyle: React.CSSProperties;
  backdropStyle: React.CSSProperties;
  dragHandlers: React.ComponentProps<typeof BottomSheet>["dragHandlers"];
  onClose: () => void;
  // 別のPDFを選び直す（provider の importFile を渡す）。
  onReimport: (file: File) => void;
  // 一括登録の成功後に呼ぶ（count = 登録件数、month = 同期したいホーム表示月）。
  onDone: (count: number, month?: { year: number; month: number }) => void;
};

// クレカ明細の取り込みプレビュー。全行を読み込み、登録する行を行トグルで選ぶ。
// 各明細は1行（行頭ドット・チェック・日付(M/D)・金額・カテゴリ・店名）。店名は表示のみ。
// 行頭ドットの色で状態を示す（未入力=赤 / 重複=amber / 返金=gray、上の凡例参照）。
// フィルタメニューで「選択行のみ」「カテゴリ別」の絞り込みができる。
export function StatementPreviewSheet({
  rows,
  fileName,
  cardName,
  categories,
  panelStyle,
  backdropStyle,
  dragHandlers,
  onClose,
  onReimport,
  onDone,
}: Props) {
  const [items, setItems] = useState<EditRow[]>(() =>
    rows.map((r) => {
      const isRefund = typeof r.amount === "number" && r.amount < 0;
      return {
        // 返金（負）・金額なし・重複候補は既定 OFF。それ以外は ON。
        include:
          typeof r.amount === "number" && r.amount >= 0 && !r.duplicateLikely,
        amount: r.amount == null ? "" : String(Math.abs(r.amount)),
        spentAt: r.spentAt ?? "",
        categoryId: r.categoryId ?? "",
        storeName: r.storeName ?? "",
        duplicateLikely: r.duplicateLikely,
        isRefund,
      };
    })
  );
  const [showSelectedOnly, setShowSelectedOnly] = useState(false);
  const [catMenuOpen, setCatMenuOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const reimportRef = useRef<HTMLInputElement>(null);

  const update = (i: number, patch: Partial<EditRow>) =>
    setItems((prev) => prev.map((it, idx) => (idx === i ? { ...it, ...patch } : it)));

  const rowComplete = (it: EditRow) =>
    it.amount !== "" && isValidYmd(it.spentAt) && it.categoryId !== "";

  const included = items.filter((it) => it.include);
  const includedCount = included.length;
  const allIncluded = items.length > 0 && items.every((it) => it.include);
  const canSubmit =
    includedCount > 0 && included.every(rowComplete) && !submitting;

  // カテゴリ一括メニューに出すカテゴリ（明細に登場するものだけ、sortOrder 順）。
  const presentCats = categories
    .filter((c) => items.some((it) => it.categoryId === c.id))
    .sort((a, b) => a.sortOrder - b.sortOrder);

  // 読み取った期間（元データの妥当な日付の最小〜最大）。
  const readDates = rows
    .map((r) => r.spentAt ?? "")
    .filter(isValidYmd)
    .sort();
  // 年を補完して表示。from/to が同年なら to の年は省く。
  const period = (() => {
    if (readDates.length === 0) return "";
    const first = readDates[0];
    const last = readDates[readDates.length - 1];
    if (first === last) return `（${ymd(first)}）`;
    const sameYear = first.slice(0, 4) === last.slice(0, 4);
    return `（${ymd(first)}〜${sameYear ? monthDay(last) : ymd(last)}）`;
  })();

  const someIncluded = includedCount > 0;
  const setAll = (next: boolean) =>
    setItems((prev) => prev.map((it) => ({ ...it, include: next })));

  // そのカテゴリの全行の include を一括トグル（全ONなら全OFF、それ以外は全ON）。
  const bulkToggleCat = (id: string) => {
    const rowsOfCat = items.filter((it) => it.categoryId === id);
    const allOn =
      rowsOfCat.length > 0 && rowsOfCat.every((it) => it.include);
    setItems((prev) =>
      prev.map((it) =>
        it.categoryId === id ? { ...it, include: !allOn } : it
      )
    );
  };

  const handleReimport = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = "";
    if (file) onReimport(file);
  };

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
        // 取り込み元の PDF 名をメモに自動入力。
        memo: fileName || null,
      }));
    try {
      const res = await fetch("/api/expenses/batch", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows: payload, cardName }),
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
        <input
          ref={reimportRef}
          type="file"
          accept="application/pdf"
          className="hidden"
          onChange={handleReimport}
        />

        {cardName && (
          <p className="text-sm font-medium">
            カード: <span className="text-muted-foreground">{cardName}</span>
          </p>
        )}

        <div className="flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground">
            {items.length}件を読み取りました{period}
          </p>
          <button
            type="button"
            onClick={() => reimportRef.current?.click()}
            className="text-xs text-primary underline-offset-2 hover:underline"
          >
            別のPDFを選び直す
          </button>
        </div>

        {/* 左: フィルタ / 中: 凡例 / 右: カテゴリ一括・全選択 */}
        <div className="flex items-center gap-2">
          {/* フィルタ＝選択行のみ表示のトグル（青地白抜き=ON） */}
          <button
            type="button"
            onClick={() => setShowSelectedOnly((v) => !v)}
            aria-pressed={showSelectedOnly}
            aria-label="選択行のみ表示"
            className={cn(
              "size-8 shrink-0 flex items-center justify-center rounded-md border transition-colors",
              showSelectedOnly
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border text-muted-foreground hover:bg-muted"
            )}
          >
            <Filter className="size-4" aria-hidden="true" />
          </button>

          <div className="flex min-w-0 flex-1 flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-destructive" />
              未入力
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-amber-400" />
              重複
            </span>
            <span className="inline-flex items-center gap-1">
              <span className="size-2 rounded-full bg-muted-foreground/50" />
              返金
            </span>
          </div>

          {/* カテゴリ一括（タップでそのカテゴリの行のチェックを一括ON/OFF） */}
          <div className="relative shrink-0">
            <button
              type="button"
              onClick={() => setCatMenuOpen((o) => !o)}
              aria-expanded={catMenuOpen}
              className="flex h-8 items-center gap-1 rounded-md border border-border px-2 text-xs font-medium text-muted-foreground hover:bg-muted"
            >
              <Tags className="size-4" aria-hidden="true" />
              一括選択
              <ChevronDown className="size-3" aria-hidden="true" />
            </button>

            {catMenuOpen && (
              <>
                {/* クリックアウェイで閉じる透明バックドロップ */}
                <button
                  type="button"
                  aria-hidden="true"
                  tabIndex={-1}
                  onClick={() => setCatMenuOpen(false)}
                  className="fixed inset-0 z-40 cursor-default"
                />
                <div className="absolute right-0 top-full z-50 mt-1 w-52 rounded-xl border border-border bg-card p-2 shadow-lg">
                  <p className="px-2 pb-1.5 text-[11px] text-muted-foreground">
                    タップで行を一括選択/解除
                  </p>

                  {/* すべて（全行の一括選択/解除） */}
                  <button
                    type="button"
                    onClick={() => setAll(!allIncluded)}
                    className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
                  >
                    <span className="text-xs font-medium">すべて</span>
                    {allIncluded ? (
                      <Check
                        className="size-4 shrink-0 text-primary"
                        aria-hidden="true"
                      />
                    ) : someIncluded ? (
                      <Minus
                        className="size-4 shrink-0 text-muted-foreground"
                        aria-hidden="true"
                      />
                    ) : (
                      <span className="size-4 shrink-0" />
                    )}
                  </button>

                  {presentCats.length > 0 && (
                    <div className="my-1 h-px bg-border" />
                  )}

                  {presentCats.length === 0 ? (
                    <p className="px-2 py-1.5 text-xs text-muted-foreground/60">
                      カテゴリ未設定
                    </p>
                  ) : (
                    <div className="flex max-h-60 flex-col gap-0.5 overflow-y-auto">
                      {presentCats.map((c) => {
                        const rowsOfCat = items.filter(
                          (it) => it.categoryId === c.id
                        );
                        const allOn = rowsOfCat.every((it) => it.include);
                        const someOn = rowsOfCat.some((it) => it.include);
                        return (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => bulkToggleCat(c.id)}
                            className="flex w-full items-center justify-between gap-2 rounded-lg px-2 py-1.5 hover:bg-muted"
                          >
                            <CategoryTag
                              name={c.name}
                              sortOrder={c.sortOrder}
                              truncate
                            />
                            {allOn ? (
                              <Check
                                className="size-4 shrink-0 text-primary"
                                aria-hidden="true"
                              />
                            ) : someOn ? (
                              <Minus
                                className="size-4 shrink-0 text-muted-foreground"
                                aria-hidden="true"
                              />
                            ) : (
                              <span className="size-4 shrink-0" />
                            )}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </>
            )}
          </div>
        </div>

        {/* 件数が少なくてもモーダル高さを一定に保つ */}
        <div className="min-h-[56vh]">
          {items.map((it, i) => {
            const hidden = showSelectedOnly && !it.include;
            // 行頭ドットの色（優先度: 未入力 > 重複 > 返金、該当なしは透明）。
            const dot =
              it.include && !rowComplete(it)
                ? "bg-destructive"
                : it.duplicateLikely
                  ? "bg-amber-400"
                  : it.isRefund
                    ? "bg-muted-foreground/50"
                    : "bg-transparent";
            return (
              <div
                key={i}
                className={cn(
                  "overflow-hidden transition-all duration-300 ease-in-out",
                  hidden
                    ? "max-h-0 opacity-0 pointer-events-none"
                    : "max-h-24 opacity-100 mt-2"
                )}
              >
                <div
                  className={cn(
                    "flex items-center gap-1.5 rounded-lg border px-2 py-1.5",
                    it.include
                      ? "border-border"
                      : "border-border/40 opacity-60"
                  )}
                >
                  <span
                    className={cn("size-2 shrink-0 rounded-full", dot)}
                    aria-hidden="true"
                  />
                  {/* 日付は M/D 表示。タップでネイティブ日付ピッカー（透明な input）。 */}
                  <label className="relative h-8 w-14 shrink-0 flex items-center justify-center rounded-md border border-border bg-background text-xs">
                    <span
                      className={cn(
                        isValidYmd(it.spentAt) ? "" : "text-muted-foreground/60"
                      )}
                    >
                      {monthDay(it.spentAt)}
                    </span>
                    <input
                      type="date"
                      value={it.spentAt}
                      onChange={(e) => update(i, { spentAt: e.target.value })}
                      className="absolute inset-0 w-full opacity-0"
                      aria-label="日付"
                    />
                  </label>
                  <div className="relative w-[4.75rem] shrink-0">
                    <span className="absolute left-1.5 top-1/2 -translate-y-1/2 text-xs text-muted-foreground">
                      ¥
                    </span>
                    <Input
                      value={it.amount}
                      inputMode="numeric"
                      placeholder="0"
                      className="h-8 pl-4 pr-1 text-right text-xs"
                      onChange={(e) =>
                        update(i, {
                          amount: e.target.value
                            .replace(/[^0-9]/g, "")
                            .slice(0, AMOUNT_MAX_DIGITS),
                        })
                      }
                    />
                  </div>
                  <Select
                    value={it.categoryId || null}
                    onValueChange={(v) =>
                      update(i, { categoryId: (v as string) ?? "" })
                    }
                  >
                    <SelectTrigger className="h-8 min-w-0 flex-1 rounded-md text-xs data-[size=default]:h-8">
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
                    <SelectContent className="min-w-[13rem]">
                      {categories.map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          <CategoryTag
                            name={c.name}
                            sortOrder={c.sortOrder}
                            truncate
                            className="max-w-[10.5rem]"
                          />
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <span
                    className="min-w-0 flex-1 truncate text-xs text-muted-foreground"
                    title={it.storeName}
                  >
                    {it.storeName || "—"}
                  </span>
                  <input
                    type="checkbox"
                    checked={it.include}
                    onChange={(e) => update(i, { include: e.target.checked })}
                    className="size-5 shrink-0 accent-primary"
                    aria-label="この行を登録する"
                  />
                </div>
              </div>
            );
          })}
        </div>

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
