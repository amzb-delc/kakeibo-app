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
import { useBottomSheet, BottomSheet } from "@/components/bottom-sheet";
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

export function ExpenseModalProvider({ children }: { children: React.ReactNode }) {
  const { unlocked } = useSession();
  const [active, setActive] = useState<ActiveState | null>(null);
  // シートの開閉アニメ・ドラッグ閉じ・Esc・スクロールロックは共通フックに委譲。
  // 退場アニメ完了時に active を破棄する。
  const { mounted, open: openSheet, close: closeSheet, panelStyle, backdropStyle, dragHandlers } =
    useBottomSheet({ draggable: true, onClosed: () => setActive(null) });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [categoriesVersion, setCategoriesVersion] = useState(0);
  const [mutationVersion, setMutationVersion] = useState(0);
  const [lastMutatedCategoryId, setLastMutatedCategoryId] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
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

  const open = useCallback(
    (next: ActiveState) => {
      setConfirmingDelete(false);
      setDeleting(false);
      setActive(next);
      openSheet();
    },
    [openSheet]
  );

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
    closeSheet();
  }, [closeSheet]);

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

  // アンマウント時に toast タイマーを後始末
  useEffect(
    () => () => {
      if (toastTimer.current) clearTimeout(toastTimer.current);
    },
    []
  );

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

      {mounted && active && initial && (
        <BottomSheet
          ariaLabel={title}
          title={title}
          onClose={close}
          panelStyle={panelStyle}
          backdropStyle={backdropStyle}
          draggable
          dragHandlers={dragHandlers}
          headerActions={
            <button
              type="button"
              aria-label="削除"
              disabled={!isEditMode}
              onClick={() => setConfirmingDelete(true)}
              className="w-9 h-9 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors disabled:opacity-30 disabled:hover:bg-transparent"
            >
              <Trash2 className="w-5 h-5" />
            </button>
          }
        >
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
        </BottomSheet>
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
