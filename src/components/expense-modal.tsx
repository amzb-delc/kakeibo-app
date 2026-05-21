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

type ModalState =
  | { mode: "closed" }
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

export function ExpenseModalProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<ModalState>({ mode: "closed" });
  const [categories, setCategories] = useState<Category[]>([]);
  const [categoriesLoaded, setCategoriesLoaded] = useState(false);
  const [mutationVersion, setMutationVersion] = useState(0);
  const [toast, setToast] = useState<string | null>(null);
  const toastTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const isOpen = state.mode !== "closed";

  // カテゴリは滅多に変わらず軽量なので、起動時に先読みしておく
  useEffect(() => {
    let active = true;
    fetch("/api/categories")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Category[]) => {
        if (active) {
          setCategories(data);
          setCategoriesLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      active = false;
    };
  }, []);

  const close = useCallback(() => setState({ mode: "closed" }), []);
  const openCreate = useCallback(() => setState({ mode: "create" }), []);
  const openEdit = useCallback(
    (expense: ExpenseEditTarget) => setState({ mode: "edit", expense }),
    []
  );

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

  // 開いている間は背面スクロールをロック
  useEffect(() => {
    if (!isOpen) return;
    const prev = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = prev;
    };
  }, [isOpen]);

  // Esc で閉じる
  useEffect(() => {
    if (!isOpen) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [isOpen, close]);

  const title = state.mode === "edit" ? "支出を編集" : "支出を登録";

  return (
    <ExpenseModalContext.Provider value={{ openCreate, openEdit, mutationVersion }}>
      {children}

      {isOpen && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label={title}
          className="fixed inset-0 z-50 flex items-end justify-center bg-black/40 animate-in fade-in duration-200"
          onClick={close}
        >
          <div
            className="w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl sm:mb-4 shadow-xl animate-in slide-in-from-bottom duration-300"
            onClick={(e) => e.stopPropagation()}
          >
            {/* グラバー + ヘッダ（スクロールしても上部に固定） */}
            <div className="sticky top-0 z-10 bg-card pt-2.5 px-4 pb-3 border-b border-border/50">
              <div className="mx-auto mb-2 h-1 w-10 rounded-full bg-border" />
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
                  key={state.mode === "edit" ? state.expense.id : "create"}
                  categories={categories}
                  expense={state.mode === "edit" ? state.expense : undefined}
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
