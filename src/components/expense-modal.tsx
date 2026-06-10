"use client";

import {
  createContext,
  useCallback,
  useContext,
  useRef,
  useState,
} from "react";
import { Lock, Trash2, Unlock } from "lucide-react";
import {
  ExpenseForm,
  type ExpenseFormValues,
  type ExpenseFormInitial,
} from "@/components/expense-form";
import { Switch } from "@/components/ui/switch";
import { ReceiptCaptureButton } from "@/components/receipt-capture-button";
import { formatYen } from "@/lib/format";
import { todayJst, lastDayOfMonth, parseReceiptDate, splitYmd } from "@/lib/date";
import { useBottomSheet, BottomSheet } from "@/components/bottom-sheet";
import { useToast, Toast } from "@/components/toast";
import { useCategoryCache } from "@/components/use-category-cache";
import { ConfirmDialog } from "@/components/confirm-dialog";
import type { Category } from "@/types";
import type { OcrResult } from "@/types/api";

// サマリー等から編集対象を渡すための型（フォームが必要とする項目のみ）
export type ExpenseEditTarget = ExpenseFormValues;

// 登録時の既定値の文脈（元ページの選択月・展開カテゴリ）
type ComposeContext = { year: number; month: number; categoryId: string | null };

type ActiveState =
  | { mode: "create"; year: number; month: number; day: number; categoryId: string }
  | { mode: "edit"; expense: ExpenseEditTarget };

type ContextValue = {
  /** 新規登録シートを開く。
   *  - opts.ocr: レシート OCR の抽出結果で初期値を埋める。日付が有効ならその年月日で開く
   *    （= レシートの月でシートを開く。ホームの表示月も createMonth 経由で同期される）。
   *  - opts.keepOpen: 連続入力モード ON で開く（ホームのカメラ＝まとめ入力動線で使う）。 */
  openCreate: (opts?: { ocr?: OcrResult | null; keepOpen?: boolean }) => void;
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
  /** プロバイダ内のトーストを表示する。モーダル外（フッターの OCR エラー等）から使う。 */
  notify: (message: string) => void;
  /** 新規登録シートを開いた月。ホームがこれを購読して表示月を同期する
   *  （OCR でレシートの月のシートを開いたとき、ホームもその月へ移動して違和感をなくす）。
   *  openCreate のたびに新しい参照で更新される。 */
  createMonth: { year: number; month: number } | null;
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
  const [active, setActive] = useState<ActiveState | null>(null);
  // シートの開閉アニメ・ドラッグ閉じ・Esc・スクロールロックは共通フックに委譲。
  // 退場アニメ完了時に active を破棄する。
  const { mounted, open: openSheet, close: closeSheet, panelStyle, backdropStyle, dragHandlers } =
    useBottomSheet({ draggable: true, onClosed: () => setActive(null) });
  const [confirmingDelete, setConfirmingDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  // 連続入力（ロック）トグル: ON のとき保存してもシートを閉じず続けて入力する。
  // トグル UI はヘッダー（新規時のみ）に置き、状態はここで保持する。連続入力中は
  // シートを開いたままにするので保存をまたいで保たれ、シートを開き直すと OFF に戻す。
  const [keepOpen, setKeepOpen] = useState(false);
  // レシート OCR の抽出結果。ヘッダーのカメラ（ReceiptCaptureButton）で撮影すると
  // セットされ、開いているフォームに反映される。キャプチャごとに新しい参照で渡る。
  // シートを開き直すと null に戻す（古い結果を別の支出に持ち込まないため）。
  const [ocrResult, setOcrResult] = useState<OcrResult | null>(null);
  // 新規シートを開いた月。ホームが購読して表示月を同期する（openCreate ごとに新参照）。
  const [createMonth, setCreateMonth] = useState<{ year: number; month: number } | null>(
    null
  );
  const [mutationVersion, setMutationVersion] = useState(0);
  const [lastMutatedCategoryId, setLastMutatedCategoryId] = useState<string | null>(null);
  const composeRef = useRef<ComposeContext | null>(null);

  // 全カテゴリの先読みキャッシュとトーストは専用フックに委譲。
  // categories は無効含む全件で、フォームの選択肢生成や名前解決に使う。
  const {
    categories,
    loaded: categoriesLoaded,
    version: categoriesVersion,
    refresh: refreshCategories,
  } = useCategoryCache();
  const { message: toastMessage, show: showToast } = useToast();

  const open = useCallback(
    (next: ActiveState) => {
      setConfirmingDelete(false);
      setDeleting(false);
      setKeepOpen(false);
      setOcrResult(null);
      setActive(next);
      openSheet();
    },
    [openSheet]
  );

  const setComposeContext = useCallback((ctx: ComposeContext | null) => {
    composeRef.current = ctx;
  }, []);

  const openCreate = useCallback(
    (opts?: { ocr?: OcrResult | null; keepOpen?: boolean }) => {
      const [ty, tm, td] = splitYmd(todayJst());
      const ctx = composeRef.current;
      let year = ctx?.year ?? ty;
      let month = ctx?.month ?? tm;
      let day = Math.min(td, lastDayOfMonth(year, month));
      // OCR の日付が有効なら、レシートの年月日でシートを開く（表示月＝レシートの月）。
      const rd = parseReceiptDate(opts?.ocr?.spentAt);
      if (rd) {
        year = rd.year;
        month = rd.month;
        day = rd.day;
      }
      open({ mode: "create", year, month, day, categoryId: ctx?.categoryId ?? "" });
      // open() でリセットした後に OCR シード・連続入力を入れる（後勝ちで反映される）。
      if (opts?.ocr) setOcrResult(opts.ocr);
      if (opts?.keepOpen) setKeepOpen(true);
      // ホームが表示月を同期できるよう、開いた月を新参照で発信する。
      setCreateMonth({ year, month });
    },
    [open]
  );

  const openEdit = useCallback(
    (expense: ExpenseEditTarget) => open({ mode: "edit", expense }),
    [open]
  );

  // モーダル内ヘッダーのカメラで読み取ったときのハンドラ。フォームへ反映するため
  // ocrResult を更新しつつ、日付が有効ならフォームの月が変わるのでホームの表示月も
  // createMonth 経由で同期する（フッター動線の openCreate と挙動を揃える）。
  const applyHeaderOcr = useCallback((result: OcrResult) => {
    setOcrResult(result);
    const rd = parseReceiptDate(result.spentAt);
    if (rd) setCreateMonth({ year: rd.year, month: rd.month });
  }, []);

  const close = useCallback(() => {
    setConfirmingDelete(false);
    closeSheet();
  }, [closeSheet]);

  const handleSuccess = useCallback(
    // categoryId は登録/更新で確定したカテゴリ。削除では渡さない（= 選択を変えない）。
    // keepOpen=true（連続入力トグルON）のときはシートを閉じない。フォーム側で
    // 自身のフィールドをリセットし、続けて次の支出を入力できる。
    // year/month を渡すと、ホームの表示月をその月へ同期する（年月を別月に変えて保存した時）。
    (
      message: string,
      categoryId?: string | null,
      opts?: { keepOpen?: boolean; year?: number; month?: number }
    ) => {
      if (!opts?.keepOpen) close();
      setLastMutatedCategoryId(categoryId ?? null);
      setMutationVersion((v) => v + 1);
      if (opts?.year && opts?.month) {
        setCreateMonth({ year: opts.year, month: opts.month });
      }
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

  const isEditMode = active?.mode === "edit";
  const title = isEditMode ? "支出を編集" : "支出を登録";

  let initial: ExpenseFormInitial | null = null;
  if (active?.mode === "edit") {
    const [y, m, d] = splitYmd(active.expense.spentAt);
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
        notify: showToast,
        createMonth,
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
            isEditMode ? (
              <button
                type="button"
                aria-label="削除"
                onClick={() => setConfirmingDelete(true)}
                className="w-10 h-10 rounded-full flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
              >
                <Trash2 className="w-5 h-5" />
              </button>
            ) : (
              // 新規時: レシート撮影（カメラ）＋ 連続入力（ロック）トグル。
              // 錠アイコンはスイッチのトラック内・サムの反対側の余白に描く
              // （OFF=右に開錠 Unlock / ON=左に閉錠 Lock）。
              <div className="flex items-center gap-0.5">
                <ReceiptCaptureButton
                  onResult={applyHeaderOcr}
                  onError={showToast}
                />
                <Switch
                  checked={keepOpen}
                  onCheckedChange={setKeepOpen}
                  aria-label="連続入力（保存後も続けて入力）"
                >
                  <Lock
                    className="pointer-events-none absolute left-1.5 top-1/2 size-4 -translate-y-1/2 text-white group-data-[unchecked]:hidden"
                    aria-hidden="true"
                  />
                  <Unlock
                    className="pointer-events-none absolute right-1.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground group-data-[checked]:hidden"
                    aria-hidden="true"
                  />
                </Switch>
              </div>
            )
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
                keepOpen={keepOpen}
                ocrResult={ocrResult}
                onSuccess={handleSuccess}
              />
            )}
          </div>
        </BottomSheet>
      )}

      {/* 削除確認ダイアログ（シートより前面）。対象の具体情報（日付・カテゴリ・金額・店名）を掲出。 */}
      {active?.mode === "edit" && confirmingDelete && (
        <ConfirmDialog
          detail={(() => {
            const e = active.expense;
            const [, m, d] = e.spentAt.split("-").map(Number);
            const catName =
              categories.find((c) => c.id === e.categoryId)?.name ?? "未分類";
            return (
              <span className="font-medium">
                {m}月{d}日・{catName}・{formatYen(e.amount)}
                {e.storeName ? `（${e.storeName}）` : ""}
              </span>
            );
          })()}
          title="この支出を削除しますか？"
          description="削除すると元に戻せません。"
          confirmLabel="削除する"
          busyLabel="削除中…"
          busy={deleting}
          destructive
          onConfirm={handleDelete}
          onCancel={() => setConfirmingDelete(false)}
        />
      )}

      <Toast message={toastMessage} />
    </ExpenseModalContext.Provider>
  );
}
