"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Link from "next/link";
import { MonthlySummaryView } from "@/components/monthly-summary";
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
      // Fade in after data arrives
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

  if (!summary && loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-sm text-muted-foreground">
        読み込み中…
      </div>
    );
  }

  if (!summary) return null;

  return (
    <div className="min-h-screen bg-background">
      {/* 戻るリンク */}
      <div className="sticky top-0 z-20 bg-background px-4 pt-3">
        <Link
          href="/"
          className="text-muted-foreground hover:text-foreground text-sm min-h-[44px] inline-flex items-center"
        >
          ← 戻る
        </Link>
      </div>
      <div
        className="transition-opacity duration-150"
        style={{ opacity: fade ? 0 : 1 }}
      >
        <MonthlySummaryView
          summary={summary}
          onPrevMonth={handlePrevMonth}
          onNextMonth={handleNextMonth}
        />
      </div>
    </div>
  );
}
