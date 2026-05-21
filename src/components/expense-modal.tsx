"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { ExpenseForm, type ExpenseFormValues } from "@/components/expense-form";
import type { Category } from "@/types";

// サマリー等から編集対象を渡すための型（フォームが必要とする項目のみ）
export type ExpenseEditTarget = ExpenseFormValues;

type ActiveState =
  | { mode: "create" }
  | { mode: "edit"; expense: ExpenseEditTarget };

type ContextValue = {
  openCreate: () => void;
  openEdit: (expense: ExpenseEditTarget) => void;
  /** 登録・更新・削除のたびに増える。一覧側はこれを購読して再取得する。 */
  mutationVersion: number;
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
  // active = 中身（null で完全クローズ＝unmount）、shown = 表示状態（開閉アニメの駆動）
  const [active, setActive] = useState<ActiveState | null>(null);
  const [shown, setShown] = useState(false);
  const [dragY, setDragY] = useState<number | null>(null); // null = ドラッグ中でない
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [mutationVersion, setMutationVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const teardownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart = useRef<{ y: number; t: number } | null>(null);

  // カテゴリは滅多に変わらず軽量なので、起動時に先読みしておく
  useEffect(() => {
    let alive = true;
    fetch("/api/categories")
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
  }, []);

  const open = useCallback((next: ActiveState) => {
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    setActive(next);
    setDragY(null);
    setShown(false); // いったん画面外/透明に置いてから…
    // 2フレーム後に表示状態へ。CSS transition を確実に発火させる
    requestAnimationFrame(() =>
      requestAnimationFrame(() => setShown(true))
    );
  }, []);

  const openCreate = useCallback(() => open({ mode: "create" }), [open]);
  const openEdit = useCallback(
    (expense: ExpenseEditTarget) => open({ mode: "edit", expense }),
    [open]
  );

  const close = useCallback(() => {
    setShown(false); // バックドロップ fade-out + パネル slide-down
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    teardownTimer.current = setTimeout(() => {
      setActive(null);
      setDragY(null);
    }, ANIM_MS);
  }, []);

  const handleSuccess = useCallback(
    (message: string) => {
      close();
      setMutationVersion((v) => v + 1);
      setToast(message);
      if (toastTimer.current) clearTimeout(toastTimer.current);
      toastTimer.current = setTimeout(() => setToast(null), 2200);
    },
    [close]
  );

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
    // ✕ などのボタン上ではドラッグを開始しない
    if ((e.target as HTMLElement).closest("button")) return;
    dragStart.current = { y: e.clientY, t: performance.now() };
    setDragY(0);
    e.currentTarget.setPointerCapture?.(e.pointerId);
  };
  const onDragPointerMove = (e: React.PointerEvent) => {
    if (!dragStart.current) return;
    const dy = e.clientY - dragStart.current.y;
    // 下方向は追従、上方向は弱い抵抗
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
      close(); // 現在位置から画面外へ滑らせて閉じる
    } else {
      setDragY(null); // しきい値未満：0 へスナップバック
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
  const title = active?.mode === "edit" ? "支出を編集" : "支出を登録";

  return (
    <ExpenseModalContext.Provider value={{ openCreate, openEdit, mutationVersion }}>
      {children}

      {active && (
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

            <div style={{ paddingBottom: "env(safe-area-inset-bottom)" }}>
              {!categoriesLoaded ? (
                <div className="px-4 py-10 text-center text-sm text-muted-foreground">
                  読み込み中…
                </div>
              ) : (
                <ExpenseForm
                  key={active.mode === "edit" ? active.expense.id : "create"}
                  categories={categories}
                  expense={active.mode === "edit" ? active.expense : undefined}
                  onSuccess={handleSuccess}
                />
              )}
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
