"use client";

import { useCallback, useEffect, useRef } from "react";
import Image from "next/image";
import { MonthlySummaryView } from "@/components/monthly-summary";
import { PageHeader } from "@/components/page-header";
import { HeaderCharacter } from "@/components/header-character";
import { StatementImportButton } from "@/components/statement-import-button";
import { useStatementImportPreview } from "@/components/statement-import-provider";
import { useExpenseModal } from "@/components/expense-modal";
import { useSettingsModal } from "@/components/settings-modal";
import { useSession } from "@/components/session-provider";
import { useMonthlySummary } from "@/app/use-monthly-summary";
import { useCategorySelection } from "@/app/use-category-selection";
import { useSwipeNavigation } from "@/app/use-swipe-navigation";

export default function SummaryPage() {
  const {
    mutationVersion,
    lastMutatedCategoryId,
    categoriesVersion,
    setComposeContext,
    createMonth,
  } = useExpenseModal();
  const { openSettings } = useSettingsModal();
  const { unlocked } = useSession();
  const { importing } = useStatementImportPreview();
  const swipeRef = useRef<HTMLDivElement>(null);

  const {
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
    transitionStyle,
  } = useMonthlySummary({ unlocked, mutationVersion, categoriesVersion });

  // OCR でレシートの月のシートを開いたら、ホームの表示月もその月へ同期する。
  // createMonth は openCreate ごとに新参照。手入力（同月）なら goToMonth は no-op。
  const syncedCreateMonthRef = useRef<typeof createMonth>(null);
  useEffect(() => {
    if (createMonth && syncedCreateMonthRef.current !== createMonth) {
      syncedCreateMonthRef.current = createMonth;
      goToMonth(createMonth.year, createMonth.month);
    }
  }, [createMonth, goToMonth]);

  const { openCategoryId, toggleCategory } = useCategorySelection({
    summary,
    year,
    month,
    mutationVersion,
    lastMutatedCategoryId,
    setComposeContext,
  });

  // 左スワイプ＝翌月（未来は不可）, 右スワイプ＝前月。ロード中は無効。
  const onSwipeLeft = useCallback(() => {
    if (!isCurrentMonth) goNext();
  }, [isCurrentMonth, goNext]);
  useSwipeNavigation(swipeRef, {
    onSwipeRight: goPrev,
    onSwipeLeft,
    enabled: !loading,
  });

  // 支出の追加/編集/削除のあとはトップへスクロールし、全体カードが見える位置に戻す。
  // モーダルが閉じて背面スクロールロックが解けてから実行するため少し遅延させる。
  useEffect(() => {
    if (mutationVersion === 0) return; // 初回マウントでは何もしない
    const id = setTimeout(
      () => window.scrollTo({ top: 0, behavior: "smooth" }),
      360
    );
    return () => clearTimeout(id);
  }, [mutationVersion]);

  const monthSwitcher = (
    <div className="flex items-center justify-center gap-2">
      <button
        type="button"
        onClick={goPrev}
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
        onClick={goNext}
        disabled={isCurrentMonth || loading}
        aria-label={isCurrentMonth ? "翌月（未来は表示できません）" : "翌月"}
        className="w-11 h-11 rounded-full flex items-center justify-center text-base font-bold text-muted-foreground hover:text-foreground hover:bg-muted transition-colors disabled:opacity-30"
      >
        ▶
      </button>
    </div>
  );

  // 保存状態の判定待ち（null）の間は中立のローディング。
  // サマリーのシェルも未保存画面も出さず、ちらつきを防ぐ。
  if (unlocked === null) {
    return (
      <div className="min-h-screen bg-background">
        <h1 className="sr-only">読み込み中</h1>
        <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
          読み込み中…
        </div>
      </div>
    );
  }

  // 未保存: 世帯コードを入力するまで家計データは出さない（API も 401）。
  // 保存は設定モーダルで行う。
  if (unlocked === false) {
    return (
      <div className="min-h-screen bg-background">
        <h1 className="sr-only">未保存</h1>
        <PageHeader title="未保存" />
        <main className="px-4 py-12 flex flex-col items-center text-center">
          <Image
            src="/character.png"
            alt=""
            width={128}
            height={128}
            sizes="128px"
            className="w-32 h-32 mb-4 opacity-90"
          />
          <h2 className="text-base font-semibold mb-1">世帯コードが未保存です</h2>
          <p className="text-sm text-muted-foreground mb-6 leading-relaxed">
            世帯コードを入力すると
            <br />
            家計データが表示されます。
          </p>
          <button
            type="button"
            onClick={openSettings}
            className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:scale-95 transition-all"
          >
            設定を開く
          </button>
        </main>
      </div>
    );
  }

  return (
    // スワイプ検知は画面全体（min-h-screen）に張る。コンテンツが短い月でも
    // 明細下の余白までスワイプが効くようにするため、内側ではなく外枠に ref を置く。
    <div ref={swipeRef} className="min-h-screen bg-background">
      {/* PageHeader の title が JSX のため h1 が失われる。ランドマーク確保用に sr-only で補う。 */}
      <h1 className="sr-only">月次サマリー</h1>
      <PageHeader
        title={monthSwitcher}
        left={unlocked ? <StatementImportButton /> : null}
        right={
          <HeaderCharacter onPress={goToCurrentMonth} thinking={importing} />
        }
      />
      <div>
        {!summary && loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            読み込み中…
          </div>
        ) : summary ? (
          <div style={transitionStyle}>
            <MonthlySummaryView
              summary={summary}
              openCategoryId={openCategoryId}
              onToggleCategory={toggleCategory}
              tag={tag}
              onTagChange={setTag}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
