"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import Image from "next/image";
import { MonthlySummaryView } from "@/components/monthly-summary";
import { PageHeader } from "@/components/page-header";
import { HeaderCharacter } from "@/components/header-character";
import { useExpenseModal } from "@/components/expense-modal";
import { useSettingsModal } from "@/components/settings-modal";
import { useSession } from "@/components/session-provider";
import { OTHERS_CATEGORY_ID } from "@/lib/category-constants";
import { topCategoryId as pickTopCategoryId } from "@/lib/summary-view";
import type { MonthlySummary } from "@/types";

// 左右スワイプで月送りするしきい値（px）。これ未満／縦移動が優位なときは無視。
// PWA運用想定で感度を上げ気味にする。
const SWIPE_MIN = 36;
// 月送り時のスライド量（px）。不透明0の間にデータを差し替え、反対側からスライドインさせる。
const SLIDE_OFFSET = 48;

export default function SummaryPage() {
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [summary, setSummary] = useState<MonthlySummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [fade, setFade] = useState(false);
  const [slideX, setSlideX] = useState(0); // 月送りスライドの現在オフセット(px)
  const [instant, setInstant] = useState(false); // 反対側への瞬間移動中はトランジション無効
  const [openCategoryId, setOpenCategoryId] = useState<string | null>(null);
  const isInitial = useRef(true);
  const swipeRef = useRef<HTMLDivElement>(null);
  const pendingNavDir = useRef(0); // 次の取得が月送りなら ±1、支出/カテゴリ起因の取得なら 0
  const { mutationVersion, lastMutatedCategoryId, categoriesVersion, setComposeContext } =
    useExpenseModal();
  const { openSettings } = useSettingsModal();
  const { unlocked } = useSession();

  // 当月の最大カテゴリ（金額降順の先頭）。未選択時の初期選択と FAB 既定値の両方に使う。
  const topCategoryId = summary ? pickTopCategoryId(summary.categories) : null;

  // 登録モーダル（FAB）の既定値に「表示中の月・表示中カテゴリ」を渡す。
  // openCategoryId が未確定（null）の初回フレームでも、view と同じ最大カテゴリを既定にする。
  // 「その他」選択時は実カテゴリではないのでフォーム既定値には使わず最大カテゴリにフォールバック。
  const composeCategoryId =
    openCategoryId && openCategoryId !== OTHERS_CATEGORY_ID ? openCategoryId : topCategoryId;
  useEffect(() => {
    setComposeContext({ year, month, categoryId: composeCategoryId });
  }, [year, month, composeCategoryId, setComposeContext]);
  useEffect(() => () => setComposeContext(null), [setComposeContext]);

  // 「解除なし」設計: タップは常に選択を切替えるだけで、再タップで null には戻さない。
  const toggleCategory = (categoryId: string) => setOpenCategoryId(categoryId);

  const fetchSummary = useCallback(async () => {
    setLoading(true);
    const dir = pendingNavDir.current; // 0=支出/カテゴリ起因（フェードのみ）, ±1=月送り（スライド）
    if (!isInitial.current) {
      setFade(true);
      if (dir !== 0) {
        // 退場: 進行方向と逆へスライドアウト（次=左へ, 前=右へ）
        setInstant(false);
        setSlideX(-dir * SLIDE_OFFSET);
      }
    }
    try {
      const res = await fetch(`/api/monthly-summary?year=${year}&month=${month}`);
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
  }, [year, month]);

  // 保存済みのときだけ取得。year/month・mutationVersion（支出CRUD）・
  // categoriesVersion（カテゴリ名変更等）の変化に加え、保存された瞬間（unlocked→true）にも取得する。
  useEffect(() => {
    if (unlocked) fetchSummary();
  }, [fetchSummary, mutationVersion, categoriesVersion, unlocked]);

  // 「解除なし」設計の初期選択: まだ何も選んでいない（null）ときだけ最大カテゴリを自動選択する。
  // 一度ユーザーが選んだ後は補正しない → 月跨ぎで選択を維持し、当月に無ければ「キロクナシ」表示にする。
  useEffect(() => {
    if (openCategoryId !== null || topCategoryId === null) return;
    setOpenCategoryId(topCategoryId);
  }, [topCategoryId, openCategoryId]);

  // 登録/更新の直後、確定したカテゴリを選択状態に同期する（mutationVersion で 1 回ずつ発火）。
  // 削除では lastMutatedCategoryId が null になるため選択は変えない（空になった場合は
  // 選択中カテゴリが解決できず、view 側でドーナツ全体が薄くなる＝「選択なし」表示になる）。
  // 「その他」に含まれる圏外カテゴリでも、view 側の解決で自動的に「その他」に集約表示される。
  useEffect(() => {
    if (lastMutatedCategoryId) setOpenCategoryId(lastMutatedCategoryId);
  }, [mutationVersion, lastMutatedCategoryId]);

  // 支出の追加/編集/削除のあとはトップへスクロールし、全体カードが見える位置に戻す。
  // モーダルが閉じて背面スクロールロック(overflow:hidden)が解けてから実行するため少し遅延させる。
  useEffect(() => {
    if (mutationVersion === 0) return; // 初回マウントでは何もしない
    const id = setTimeout(
      () => window.scrollTo({ top: 0, behavior: "smooth" }),
      360
    );
    return () => clearTimeout(id);
  }, [mutationVersion]);

  const handlePrevMonth = useCallback(() => {
    pendingNavDir.current = -1;
    setYear((y) => (month === 1 ? y - 1 : y));
    setMonth((m) => (m === 1 ? 12 : m - 1));
  }, [month]);

  const handleNextMonth = useCallback(() => {
    pendingNavDir.current = 1;
    setYear((y) => (month === 12 ? y + 1 : y));
    setMonth((m) => (m === 12 ? 1 : m + 1));
  }, [month]);

  const isCurrentMonth =
    year === now.getFullYear() && month === now.getMonth() + 1;

  // 左右スワイプで前月/翌月へ。横移動が縦より優位なときだけ月送りし、確定後は
  // preventDefault でスクロールと合成クリック（カテゴリ/明細の誤タップ）を抑止する。
  // ロード中・翌月が未来のときはガード。passive 制御のため native リスナーで張る。
  useEffect(() => {
    const el = swipeRef.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let horizontal = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      horizontal = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!horizontal && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
      }
      if (horizontal) e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
      if (loading) return;
      if (dx < 0) {
        if (!isCurrentMonth) handleNextMonth(); // 左スワイプ＝翌月（未来は不可）
      } else {
        handlePrevMonth(); // 右スワイプ＝前月
      }
    };
    const onCancel = () => {
      tracking = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [loading, isCurrentMonth, handlePrevMonth, handleNextMonth]);

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
        right={isCurrentMonth ? <HeaderCharacter /> : undefined}
      />
      <div>
        {!summary && loading ? (
          <div className="flex items-center justify-center py-20 text-sm text-muted-foreground">
            読み込み中…
          </div>
        ) : summary ? (
          <div
            style={{
              opacity: fade ? 0 : 1,
              transform: `translateX(${slideX}px)`,
              transition: instant
                ? "none"
                : "opacity 200ms ease, transform 240ms cubic-bezier(0.32, 0.72, 0, 1)",
            }}
          >
            <MonthlySummaryView
              summary={summary}
              openCategoryId={openCategoryId}
              onToggleCategory={toggleCategory}
            />
          </div>
        ) : null}
      </div>
    </div>
  );
}
