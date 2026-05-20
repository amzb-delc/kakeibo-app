"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import { MonthlySummaryView } from "@/components/monthly-summary";
import { PageHeader } from "@/components/page-header";
import type { MonthlySummary } from "@/types";

export default function SummaryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(false);
  const isInitial = useRef(true);

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

  useEffect(() => {
    fetchSummary();
  }, [fetchSummary]);

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
          <MonthlySummaryView summary={summary} />
        </div>
      ) : null}
    </div>
  );
}
