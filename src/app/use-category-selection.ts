"use client";

import { useEffect, useState } from "react";
import { OTHERS_CATEGORY_ID } from "@/lib/category-constants";
import { topCategoryId as pickTopCategoryId } from "@/lib/summary-view";
import type { MonthlySummary } from "@/types";

type ComposeContext = { year: number; month: number; categoryId: string | null };

// 選択中カテゴリの状態と、その同期・FAB既定値(compose context)の公開をまとめる。
// 「解除なし」設計: タップは選択を切替えるだけ。以前は SummaryPage に同居していた。
export function useCategorySelection(opts: {
  summary: MonthlySummary | null;
  year: number;
  month: number;
  mutationVersion: number;
  lastMutatedCategoryId: string | null;
  setComposeContext: (ctx: ComposeContext | null) => void;
}) {
  const { summary, year, month, mutationVersion, lastMutatedCategoryId, setComposeContext } =
    opts;
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);

  // 当月の最大カテゴリ（金額降順の先頭）。初期選択と FAB 既定値に使う。
  const topCategoryId = summary ? pickTopCategoryId(summary.categories) : null;

  // FAB の既定値に「表示中の月・表示中カテゴリ」を渡す。
  // 「その他」選択時は実カテゴリではないので最大カテゴリにフォールバック。
  const composeCategoryId =
    openCategoryId && openCategoryId !== OTHERS_CATEGORY_ID
      ? openCategoryId
      : topCategoryId;
  useEffect(() => {
    setComposeContext({ year, month, categoryId: composeCategoryId });
  }, [year, month, composeCategoryId, setComposeContext]);
  useEffect(() => () => setComposeContext(null), [setComposeContext]);

  // 初期選択: まだ何も選んでいない（null）ときだけ最大カテゴリを自動選択する。
  // 一度選んだ後は補正しない → 月跨ぎで選択を維持し、当月に無ければ「キロクナシ」表示。
  // ※ユーザー選択を跨いで保持する“状態”なのでレンダー中導出はできない。null のときだけ
  //   セットしループしないため set-state-in-effect は意図的に無効化する。
  useEffect(() => {
    if (openCategoryId !== null || topCategoryId === null) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpenCategoryId(topCategoryId);
  }, [topCategoryId, openCategoryId]);

  // 登録/更新の直後、確定したカテゴリを選択状態に同期（mutationVersion で1回ずつ）。
  // 削除では lastMutatedCategoryId が null なので選択は変えない。
  // ※外部イベント（CRUD）への反応であり、自身を deps に含めずループしない。
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (lastMutatedCategoryId) setOpenCategoryId(lastMutatedCategoryId);
  }, [mutationVersion, lastMutatedCategoryId]);

  // 「解除なし」設計: 再タップで null には戻さない。
  const toggleCategory = (categoryId: string) => setOpenCategoryId(categoryId);

  return { openCategoryId, toggleCategory };
}
