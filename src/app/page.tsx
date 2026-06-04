"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MonthlySummaryView } from "@/components/monthly-summary";
import { PageHeader } from "@/components/page-header";
import { useExpenseModal } from "@/components/expense-modal";
import type { MonthlySummary } from "@/types";

export default function SummaryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(false);
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const isInitial = useRef(true);
  const { mutationVersion, setComposeContext } = useExpenseModal();

  // 当月の最大カテゴリ（金額降順の先頭）。未選択時の初期選択と FAB 既定値の両方に使う。
  const topCategoryId =
    summary && summary.categories.length > 0
      ? [...summary.categories].sort((a, b) => b.total - a.total)[0].categoryId
      : null;

  // 登録モーダル（FAB）の既定値に「表示中の月・表示中カテゴリ」を渡す。
  // openCategoryId が未確定（null）の初回フレームでも、view と同じ最大カテゴリを既定にする。
  useEffect(() => {
    setComposeContext({ year, month, categoryId: openCategoryId ?? topCategoryId });
  }, [year, month, openCategoryId, topCategoryId, setComposeContext]);
  useEffect(() => () => setComposeContext(null), [setComposeContext]);

  // 「解除なし」設計: タップは常に選択を切替えるだけで、再タップで null には戻さない。
  const toggleCategory = (categoryId: string) => setOpenCategoryId(categoryId);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    if (!isInitial.current) {
      setFade(true);
    }
    try {
      const res = await fetch(`/api/monthly-summary?year=${year}&month=${month}`);
      if (res.ok) setSummary(await res.json());
    } finally {
      setLoading(false);
      isInitial.current = false;
      requestAnimationFrame(() => setFade(false));
    }
  }, [year, month]);

  // year/month の変更時に加え、登録・編集・削除（mutationVersion）の後も再取得
  useEffect(() => {
    fetchSummary();
  }, [fetchSummary, mutationVersion]);

  // 「解除なし」設計の初期選択: まだ何も選んでいない（null）ときだけ最大カテゴリを自動選択する。
  // 一度ユーザーが選んだ後は補正しない → 月跨ぎで選択を維持し、当月に無ければ「キロクナシ」表示にする。
  useEffect(() => {
    if (openCategoryId !== null || topCategoryId === null) return;
    setOpenCategoryId(topCategoryId);
  }, [topCategoryId, openCategoryId]);

  const handlePrevMonth = () => {
    if (month === 1) {
      setYear((y) => y - 1);
      setMonth(12);
    } else {
      setMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (month === 12) {
      setYear((y) => y + 1);
      setMonth(1);
    } else {
      setMonth((m) => m + 1);
    }
  };

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  const monthSwitcher = (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={handlePrevMonth}
        disabled={loading}
        aria-label="前月"
        className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
      >
        ◀
      </button>
      <span className="text-base font-semibold tabular-nums">
        {year}年{month}月
      </span>
      <button
        type="button"
        onClick={handleNextMonth}
        disabled={isCurrentMonth || loading}
        aria-label={isCurrentMonth ? "翌月（未来は表示できません）" : "翌月"}
        className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
      >
        ▶
      </button>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      {/* PageHeader の title が JSX のため h1 が失われる。ランドマーク確保用に sr-only で補う。 */}
      <h1 className="sr-only">月次サマリー</h1>
      <PageHeader title={monthSwitcher} />
      {!summary && loading ? (
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          読み込み中…
        </div>
      ) : summary ? (
        <div
          className="transition-opacity duration-150"
          style={{ opacity: fade ? 0 : 1 }}
        >
          <MonthlySummaryView
            summary={summary}
            openCategoryId={openCategoryId}
            onToggleCategory={toggleCategory}
          />
        </div>
      ) : null}
    </div>
  );
}
