"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { shiftMonth } from "@/lib/date";
import type { MonthlySummary } from "@/types";

// 表示中の月・月次サマリーの取得・月送りのスライドアニメを一体で扱うフック。
// 「月切り替え」と「アニメ付きのデータ差し替え」は1つの機能なので束ねる
// （アニメ方向 pendingNavDir を内部に閉じ込められる）。以前は SummaryPage に同居していた。
const SLIDE_OFFSET = 48; // 月送りスライド量(px)。不透明0の間にデータを差し替え反対側から入れる。

export function useMonthlySummary(opts: {
  unlocked: boolean | null;
  mutationVersion: number;
  categoriesVersion: number;
}) {
  const { unlocked, mutationVersion, categoriesVersion } = opts;
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  // 夫婦タグフィルタ（null=全体 / "spouse:1" / "spouse:2"）。月送りしても維持する。
  const [tag, setTag] = useState<string | null>(null);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(false);
  const [slideX, setSlideX] = useState(0);
  const [instant, setInstant] = useState(false); // 反対側への瞬間移動中はトランジション無効
  const isInitial = useRef(true);
  const pendingNavDir = useRef(0); // 月送りなら ±1、支出/カテゴリ起因の取得なら 0

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const dir = pendingNavDir.current;
    if (!isInitial.current) {
      setFade(true);
      if (dir !== 0) {
        // 退場: 進行方向と逆へスライドアウト（次=左へ, 前=右へ）
        setInstant(false);
        setSlideX(-dir * SLIDE_OFFSET);
      }
    }
    try {
      const params = new URLSearchParams({ year: String(year), month: String(month) });
      if (tag) params.set("tag", tag);
      const res = await fetch(`/api/monthly-summary?${params.toString()}`);
      if (res.ok) setSummary(await res.json());
    } finally {
      setLoading(false);
      isInitial.current = false;
      if (dir !== 0) {
        // 不透明0のうちに反対側へ瞬間移動 → 次フレームで 0 へスライドイン＋フェードイン
        setInstant(true);
        setSlideX(dir * SLIDE_OFFSET);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            setInstant(false);
            setSlideX(0);
            setFade(false);
          })
        );
      } else {
        requestAnimationFrame(() => setFade(false));
      }
      pendingNavDir.current = 0;
    }
  }, [year, month, tag]);

  // 保存済みのときだけ取得。year/month・mutationVersion（支出CRUD）・
  // categoriesVersion（カテゴリ名変更等）の変化に加え、保存された瞬間にも取得する。
  useEffect(() => {
    if (unlocked) fetchSummary();
  }, [fetchSummary, mutationVersion, categoriesVersion, unlocked]);

  const goPrev = useCallback(() => {
    pendingNavDir.current = -1;
    const prev = shiftMonth(year, month, -1);
    setYear(prev.year);
    setMonth(prev.month);
  }, [year, month]);

  const goNext = useCallback(() => {
    pendingNavDir.current = 1;
    const next = shiftMonth(year, month, 1);
    setYear(next.year);
    setMonth(next.month);
  }, [year, month]);

  // 指定の年月へ直接移動する（月送りのスライドはせずフェードのみ）。
  // ホームの表示月を OCR でレシートの月に同期するときに使う。
  // 明示ガードは持たず無条件に setState するが、同じ年月なら React の同値 bail-out で
  // 再レンダされない（＝実質 no-op）。
  const goToMonth = useCallback((y: number, m: number) => {
    pendingNavDir.current = 0;
    setYear(y);
    setMonth(m);
  }, []);

  // 当月へ移動する（キャラクタータップ用）。当月表示中なら同値 bail-out で実質 no-op。
  const goToCurrentMonth = useCallback(() => {
    const d = new Date();
    goToMonth(d.getFullYear(), d.getMonth() + 1);
  }, [goToMonth]);

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  // キャラクタータップ用。当月表示中なら同じ月をその場で再取得する
  // （PWA だとページ更新が気軽に使えないため、手動リフレッシュの導線にする）。
  // 当月以外なら当月へ移動する（その月送りで通常どおり取得が走るので別処理は不要）。
  const goToCurrentMonthOrRefresh = useCallback(() => {
    if (isCurrentMonth) {
      pendingNavDir.current = 0;
      fetchSummary();
    } else {
      goToCurrentMonth();
    }
  }, [isCurrentMonth, fetchSummary, goToCurrentMonth]);

  // 月送りスライド＋フェードの style。view 側のラッパに spread する。
  const transitionStyle: React.CSSProperties = {
    opacity: fade ? 0 : 1,
    transform: `translateX(${slideX}px)`,
    transition: instant
      ? "none"
      : "opacity 200ms ease, transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
  };

  return {
    year,
    month,
    tag,
    setTag,
    summary,
    loading,
    isCurrentMonth,
    goPrev,
    goNext,
    goToMonth,
    goToCurrentMonth,
    goToCurrentMonthOrRefresh,
    transitionStyle,
  };
}
