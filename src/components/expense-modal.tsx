"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { Trash2 } from "lucide-react";
import {
  ExpenseForm,
  type ExpenseFormValues,
  type ExpenseFormInitial,
} from "@/components/expense-form";
import { todayJst, lastDayOfMonth } from "@/lib/date";
import { useSession } from "@/components/session-provider";
import type { Category } from "@/types";

// サマリー等から編集対象を渡すための型（フォームが必要とする項目のみ）
export type ExpenseEditTarget = ExpenseFormValues;

// 登録時の既定値の文脈（元ページの選択月・展開カテゴリ）
type ComposeContext = { year: number; month: number; categoryId: string | null };

type ActiveState =
  | { mode: "create"; year: number; month: number; day: number; categoryId: string }
  | { mode: "edit"; expense: ExpenseEditTarget };

type ContextValue = {
  openCreate: () => void;
  openEdit: (expense: ExpenseEditTarget) => void;
  /** 元ページが選択月・展開カテゴリを publish する。openCreate の既定値に使う */
  setComposeContext: (ctx: ComposeContext | null) => void;
  /** 登録・更新・削除のたびに増える。一覧側はこれを購読して再取得する。 */
  mutationVersion: number;
  /** 直近の登録/更新で確定した支出のカテゴリID（削除時は null）。
   *  ホームが mutationVersion とあわせて購読し、そのカテゴリを選択状態に同期する。 */
  lastMutatedCategoryId: string | null;
  /** 先読みした全カテゴリ（無効含む）。名前解決やフォームの選択肢生成に使う */
  categories: Category[];
  /** カテゴリ管理で名前変更/有効無効を変えた後に呼ぶ。先読み一覧を再取得する。 */
  refreshCategories: () => void;
  /** カテゴリ編集のたびに増える。サマリー等はこれを購読して再取得する（名前の即時反映）。 */
  categoriesVersion: number;
};

const ExpenseModalContext = createContext<ContextValue | null>(null);

export function useExpenseModal(): ContextValue {
  const ctx = useContext(ExpenseModalContext);
  if (!ctx) {
    throw new Error("useExpenseModal は ExpenseModalProvider の内側で使ってください");
  }
  return ctx;
}

const ANIM_MS = 320;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"; // iOS シート風のイージング
const CLOSE_THRESHOLD = 110; // この px 超のドラッグで閉じる
const FLICK_VELOCITY = 0.5; // px/ms。速い下フリックでも閉じる

export function ExpenseModalProvider({ children }: { children: React.ReactNode }) {
  const { unlocked } = useSession();
  const [active, setActive] = useState<ActiveState | null>(null);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null); // null = ドラッグ中でない
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoriesVersion, setCategoriesVersion] = useState(0);
  const [mutationVersion, setMutationVersion] = useState(0);
  const [lastMutatedCategoryId, setLastMutatedCategoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teardownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  const composeRef = useRef<ComposeContext | null>(null);

  // カテゴリは軽量なので保存後に先読みしておく。無効も含めた全件（scope=all）を持ち、
  // フォームの選択肢生成（編集時は無効でも現カテゴリを残す）や名前解決に使う。
  // 未保存のときは /api/categories が 401 になるため取得しない（保存で再取得）。
  // categoriesVersion はカテゴリ管理での編集後の再取得トリガ。
  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    fetch("/api/categories?scope=all")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Category[]) => {
        if (alive) {
          setCategories(data);
          setCategoriesLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [unlocked, categoriesVersion]);

  const refreshCategories = useCallback(
    () => setCategoriesVersion((v) => v + 1),
    []
  );

  const showToast = useCallback((message: string) => {
    setToast(message);
    if (toastTimer.current) clearTimeout(toastTimer.current);
    toastTimer.current = setTimeout(() => setToast(null), 2200);
  }, []);

  const open = useCallback((next: ActiveState) => {
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    setConfirmingDelete(false);
    setDeleting(false);
    setActive(next);
    setDragY(null);
    setShown(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }, []);

  const setComposeContext = useCallback((ctx: ComposeContext | null) => {
    composeRef.current = ctx;
  }, []);

  const openCreate = useCallback(() => {
    const [ty, tm, td] = todayJst().split("-").map(Number);
    const ctx = composeRef.current;
    const year = ctx?.year ?? ty;
    const month = ctx?.month ?? tm;
    const lastDay = lastDayOfMonth(year, month);
    const day = Math.min(td, lastDay);
    open({ mode: "create", year, month, day, categoryId: ctx?.categoryId ?? "" });
  }, [open]);

  const openEdit = useCallback(
    (expense: ExpenseEditTarget) => open({ mode: "edit", expense }),
    [open]
  );

  const close = useCallback(() => {
    setConfirmingDelete(false);
    setShown(false);
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    teardownTimer.current = setTimeout(() => {
      setActive(null);
      setDragY(null);
    }, ANIM_MS);
  }, []);

  const handleSuccess = useCallback(
    // categoryId は登録/更新で確定したカテゴリ。削除では渡さない（= 選択を変えない）。
    (message: string, categoryId?: string | null) => {
      close();
      setLastMutatedCategoryId(categoryId ?? null);
      setMutationVersion((v) => v + 1);
      showToast(message);
    },
    [close, showToast]
  );

  const handleDelete = useCallback(async () => {
    if (active?.mode !== "edit") return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/expenses/${active.expense.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      setConfirmingDelete(false);
      setDeleting(false);
      handleSuccess("削除しました");
    } catch {
      setDeleting(false);
      setConfirmingDelete(false);
      showToast("削除に失敗しました");
    }
  }, [active, handleSuccess, showToast]);

  // アンマウント時にタイマーを後始末
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
      if (teardownTimer.current) clearTimeout(teardownTimer.current);
    },
    []
  );

  const isMounted = active !== null;

  // 開いている間は背面スクロールをロック
  useEffect(() => {
    if (!isMounted) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isMounted]);

  // Esc で閉じる
  useEffect(() => {
    if (!isMounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isMounted, close]);

  // --- ドラッグで閉じる（ヘッダ起点） ---
  const onDragPointerDown = (e: React.PointerEvent) => {
    if ((e.target as HTMLElement).closest("button")) return; // ゴミ箱/✕上では発火しない
    dragStart.current = { y: e.clientY, t: performance.now() };
    setDragY(0);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    setDragY(dy > 0 ? dy : dy * 0.2);
  };
  const onDragPointerEnd = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    const dt = performance.now() - dragStart.current.t;
    const v = dy / Math.max(dt, 1);
    dragStart.current = null;
    if (dy > CLOSE_THRESHOLD || (dy > 24 && v > FLICK_VELOCITY)) {
      setDragY(null);
      close();
    } else {
      setDragY(null);
    }
  };
  const onDragPointerCancel = () => {
    dragStart.current = null;
    setDragY(null);
  };

  const dragging = dragY !== null;
  const panelStyle: React.CSSProperties = {
    transform: dragging
      ? `translateY(${Math.max(0, dragY ?? 0)}px)`
      : shown
        ? "translateY(0)"
        : "translateY(100%)",
    transition: dragging ? "none" : `transform ${ANIM_MS}ms ${EASE}`,
  };

  const isEditMode = active?.mode === "edit";
  const title = isEditMode ? "支出を編集" : "支出を登録";

  let initial: ExpenseFormInitial | null = null;
  if (active?.mode === "edit") {
    const [y, m, d] = active.expense.spentAt.split("-").map(Number);
    initial = {
      id: active.expense.id,
      year: y,
      month: m,
      day: d,
      categoryId: active.expense.categoryId,
      amount: String(active.expense.amount),
      storeName: active.expense.storeName ?? "",
      memo: active.expense.memo ?? "",
    };
  } else if (active?.mode === "create") {
    initial = {
      year: active.year,
      month: active.month,
      day: active.day,
      categoryId: active.categoryId,
      amount: "",
      storeName: "",
      memo: "",
    };
  }

  // フォームの選択肢: 新規は有効カテゴリのみ。編集は現カテゴリが無効化済みでも
  // 選択肢に残す（過去の支出を編集してもカテゴリが消えない＝表示を変えないため）。
  const enabledCategories = categories.filter((c) => c.enabled);
  let formCategories = enabledCategories;
  if (active?.mode === "edit") {
    const current = categories.find((c) => c.id === active.expense.categoryId);
    if (current && !current.enabled) {
      formCategories = [...enabledCategories, current].sort(
        (a, b) => a.sortOrder - b.sortOrder
      );
    }
  }

  return (
    <ExpenseModalContext.Provider
      value={{
        openCreate,
        openEdit,
        setComposeContext,
        mutationVersion,
        lastMutatedCategoryId,
        categories,
        refreshCategories,
        categoriesVersion,
      }}
    >
      {children}

      {active && initial && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-end justify-center"
          onClick={close}
        >
          {/* バックドロップ（パネルとは別レイヤー） */}
          <div
            aria-hidden="true"
            className="absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out"
            style={{ opacity: shown ? 1 : 0 }}
          />

          {/* パネル */}
          <div
            className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl sm:mb-4 shadow-xl"
            style={panelStyle}
            onClick={(e) => e.stopPropagation()}
          >
            {/* グラバー + ヘッダ（ドラッグハンドル兼用、上部に固定） */}
            <div
              className="sticky top-0 z-10 bg-card pt-2.5 px-4 pb-3 border-b border-border/50 touch-none select-none cursor-grab active:cursor-grabbing"
              onPointerDown={onDragPointerDown}
              onPointerMove={onDragPointerMove}
              onPointerUp={onDragPointerEnd}
              onPointerCancel={onDragPointerCancel}
            >
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">{title}</h2>
                <div className="flex items-center gap-0.5">
                  <button
                    type="button"
                    aria-label="削除"
                    disabled={!isEditMode}
                    onClick={() => setConfirmingDelete(true)}
                    className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                  <button
                    type="button"
                    onClick={close}
                    aria-label="閉じる"
                    className="w-9 h-9 -mr-1 rounded-full flex items-center justify-center text-lg text-muted-foreground hover:bg-muted transition-colors"
                  >
                    ✕
                  </button>
                </div>
              </div>
            </div>

            <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {!categoriesLoaded ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  読み込み中…
                </div>
              ) : (
                <ExpenseForm
                  key={active.mode === "edit" ? active.expense.id : "create"}
                  categories={formCategories}
                  initial={initial}
                  onSuccess={handleSuccess}
                />
              )}
            </div>
          </div>
        </div>
      )}

      {/* 削除確認ダイアログ（シートより前面） */}
      {active && confirmingDelete && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-delete-title"
          className="fixed inset-0 z-[70] flex items-end sm:items-center justify-center bg-black/40"
          onClick={() => !deleting && setConfirmingDelete(false)}
        >
          <div
            className="w-full sm:max-w-sm bg-card rounded-t-2xl sm:rounded-2xl p-5 m-0 sm:m-4 shadow-lg"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 id="confirm-delete-title" className="text-base font-semibold mb-2">
              この支出を削除しますか？
            </h2>
            <p className="text-sm text-muted-foreground mb-5">
              この操作は取り消せません。
            </p>
            <div className="flex gap-3">
              <button
                type="button"
                disabled={deleting}
                onClick={() => setConfirmingDelete(false)}
                className="flex-1 h-12 rounded-xl border border-border text-base font-medium hover:bg-muted transition-colors disabled:opacity-50"
              >
                キャンセル
              </button>
              <button
                type="button"
                disabled={deleting}
                onClick={handleDelete}
                className="flex-1 h-12 rounded-xl bg-destructive text-white text-base font-medium hover:bg-destructive/90 transition-colors disabled:opacity-50"
              >
                {deleting ? "削除中…" : "削除する"}
              </button>
            </div>
          </div>
        </div>
      )}

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-6 left-4 right-4 z-[60] bg-foreground text-background rounded-xl px-4 py-3 text-sm font-medium text-center shadow-lg animate-in slide-in-from-bottom"
        >
          {toast}
        </div>
      )}
    </ExpenseModalContext.Provider>
  );
}
