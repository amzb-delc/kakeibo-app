"use client";

import { createContext, useCallback, useContext, useState } from "react";
import { useSession } from "@/components/session-provider";
import { CategoryManager } from "@/components/category-manager";
import { useBottomSheet, BottomSheet } from "@/components/bottom-sheet";
import { useImeComposition } from "@/components/use-ime-composition";

type ContextValue = {
  openSettings: () => void;
};

const SettingsModalContext = createContext<ContextValue | null>(null);

export function useSettingsModal(): ContextValue {
  const ctx = useContext(SettingsModalContext);
  if (!ctx) {
    throw new Error("useSettingsModal は SettingsModalProvider の内側で使ってください");
  }
  return ctx;
}

export function SettingsModalProvider({ children }: { children: React.ReactNode }) {
  const { unlocked, householdName, enteredBy, unlock, lock, setEnteredBy } =
    useSession();
  const { mounted, open, close, panelStyle, backdropStyle } = useBottomSheet();
  const [passphrase, setPassphrase] = useState("");
  const [authError, setAuthError] = useState(false);
  const [busy, setBusy] = useState(false);
  // 日本語IMEの変換中フラグ。変換確定の Enter でフォーム送信されるのを防ぐ。
  const { isComposing, bind: imeBind } = useImeComposition();

  const openSettings = useCallback(() => {
    setPassphrase("");
    setAuthError(false);
    open();
  }, [open]);

  const handleUnlock = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (isComposing()) return; // IME 変換確定の Enter では送信しない
      const value = passphrase.trim();
      if (!value || busy) return;
      setBusy(true);
      setAuthError(false);
      const ok = await unlock(value);
      setBusy(false);
      if (ok) {
        setPassphrase("");
        close(); // 保存できたら閉じて家計データを表示
      } else {
        setAuthError(true);
      }
    },
    [passphrase, busy, unlock, close, isComposing]
  );

  const handleLock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await lock();
    setBusy(false);
  }, [busy, lock]);

  return (
    <SettingsModalContext.Provider value={{ openSettings }}>
      {children}

      {mounted && (
        <BottomSheet
          ariaLabel="設定"
          title="設定"
          onClose={close}
          panelStyle={panelStyle}
          backdropStyle={backdropStyle}
        >
          <div
            className="px-4 py-4 space-y-4"
            style={{ paddingBottom: "calc(env(safe-area-inset-bottom) + 1rem)" }}
          >
            {/* 世帯コードセクション: 保存/クリア */}
            <section className="bg-muted/30 rounded-2xl border border-border/50 p-4">
              <h3 className="text-sm font-semibold mb-2 flex items-center gap-2">
                世帯コード
                {unlocked === false && (
                  <span className="inline-flex items-center rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">
                    未保存
                  </span>
                )}
              </h3>
              {unlocked ? (
                <div className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    保存済み{householdName ? `（${householdName}）` : ""}。この端末では世帯コードの再入力なしで表示されます。
                  </p>
                  <button
                    type="button"
                    onClick={handleLock}
                    disabled={busy}
                    className="inline-flex items-center justify-center h-11 px-5 rounded-xl border border-border text-sm font-medium hover:bg-muted active:scale-95 transition-all disabled:opacity-50"
                  >
                    {busy ? "処理中…" : "この端末からクリア"}
                  </button>
                </div>
              ) : (
                <form onSubmit={handleUnlock} className="space-y-3">
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    家計データを表示するには世帯コードを入力してください。
                  </p>
                  {/* 日本語の世帯コードを入力できるよう type="text"（IME を妨げない）。
                      入力中の確認のため伏せ字にはしない。 */}
                  <input
                    type="text"
                    value={passphrase}
                    onChange={(e) => {
                      setPassphrase(e.target.value);
                      setAuthError(false);
                    }}
                    {...imeBind}
                    placeholder="世帯コード"
                    autoComplete="off"
                    className={`w-full h-11 px-3 rounded-xl border bg-background text-base outline-none focus:ring-2 focus:ring-primary/30 ${
                      authError ? "border-destructive" : "border-border"
                    }`}
                  />
                  {authError && (
                    <p className="text-xs text-destructive">世帯コードが違います。</p>
                  )}
                  <button
                    type="submit"
                    disabled={busy || passphrase.trim().length === 0}
                    className="inline-flex items-center justify-center h-11 px-6 rounded-xl bg-blue-600 text-white text-sm font-semibold hover:bg-blue-500 active:scale-95 transition-all disabled:opacity-50"
                  >
                    {busy ? "確認中…" : "保存する"}
                  </button>
                </form>
              )}
            </section>

            {/* 入力者: 保存済みのときのみ。端末ごとに夫/妻を選び、新規登録に付与する。 */}
            {unlocked && (
              <section className="bg-muted/30 rounded-2xl border border-border/50 p-4">
                <h3 className="text-sm font-semibold mb-1 flex items-center gap-2">
                  入力者
                  {enteredBy == null && (
                    <span className="inline-flex items-center rounded-full bg-red-500 text-white text-[10px] font-bold px-2 py-0.5">
                      未選択
                    </span>
                  )}
                </h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  この端末で登録する人を選んでください。新しく登録する支出に自動で記録されます（登録前に必須）。
                </p>
                <div className="flex gap-3">
                  {(
                    [
                      { value: 1, symbol: "♂", label: "夫", active: "border-blue-500 bg-blue-50 text-blue-600", idle: "text-blue-500/70" },
                      { value: 2, symbol: "♀", label: "妻", active: "border-rose-500 bg-rose-50 text-rose-600", idle: "text-rose-500/70" },
                    ] as const
                  ).map((o) => {
                    const selected = enteredBy === o.value;
                    return (
                      <button
                        key={o.value}
                        type="button"
                        onClick={() => setEnteredBy(o.value)}
                        aria-pressed={selected}
                        aria-label={o.label}
                        className={`flex-1 flex items-center justify-center gap-2 h-14 rounded-xl border-2 text-base font-semibold transition-all active:scale-95 ${
                          selected
                            ? o.active
                            : `border-border bg-background ${o.idle} hover:bg-muted`
                        }`}
                      >
                        <span className="text-2xl leading-none" aria-hidden="true">
                          {o.symbol}
                        </span>
                        <span>{o.label}</span>
                      </button>
                    );
                  })}
                </div>
              </section>
            )}

            {/* カテゴリ管理: 保存済み（cookie あり）のときのみ。名前変更＋有効/無効。 */}
            {unlocked && (
              <section className="bg-muted/30 rounded-2xl border border-border/50 p-4">
                <h3 className="text-sm font-semibold mb-1">カテゴリ</h3>
                <p className="text-xs text-muted-foreground leading-relaxed mb-3">
                  名前の変更と、登録時の選択肢に出すかどうかを切り替えられます。無効にしても過去の支出や集計はそのまま残ります。
                </p>
                <CategoryManager />
              </section>
            )}
          </div>
        </BottomSheet>
      )}
    </SettingsModalContext.Provider>
  );
}
