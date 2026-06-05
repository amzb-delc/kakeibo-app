"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useSession } from "@/components/session-provider";

// 支出モーダル（expense-modal.tsx）と同じボトムシートの流儀に揃える。
const ANIM_MS = 320;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"; // iOS シート風のイージング

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
  const { unlocked, householdName, unlock, lock } = useSession();
  const [open, setOpen] = useState(false); // マウント状態
  const [shown, setShown] = useState(false); // アニメーション用（true で前面/不透明）
  const [passphrase, setPassphrase] = useState("");
  const [authError, setAuthError] = useState(false);
  const [busy, setBusy] = useState(false);
  const teardownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 日本語IMEの変換中フラグ。変換確定の Enter でフォーム送信されるのを防ぐ。
  const composingRef = useRef(false);

  const openSettings = useCallback(() => {
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    setPassphrase("");
    setAuthError(false);
    setOpen(true);
    setShown(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }, []);

  const close = useCallback(() => {
    setShown(false);
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    teardownTimer.current = setTimeout(() => setOpen(false), ANIM_MS);
  }, []);

  const handleUnlock = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (composingRef.current) return; // IME 変換確定の Enter では送信しない
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
    [passphrase, busy, unlock, close]
  );

  const handleLock = useCallback(async () => {
    if (busy) return;
    setBusy(true);
    await lock();
    setBusy(false);
  }, [busy, lock]);

  // 開いている間は Esc で閉じ、背面スクロールをロック
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, close]);

  // アンマウント時にタイマーを後始末
  useEffect(
    () => () => {
      if (teardownTimer.current) clearTimeout(teardownTimer.current);
    },
    []
  );

  const panelStyle: React.CSSProperties = {
    transform: shown ? "translateY(0)" : "translateY(100%)",
    transition: `transform ${ANIM_MS}ms ${EASE}`,
  };

  return (
    <SettingsModalContext.Provider value={{ openSettings }}>
      {children}

      {open && (
        <div
          role="dialog"
          aria-modal="true"
          aria-label="設定"
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
            {/* グラバー + ヘッダ（上部に固定） */}
            <div className="sticky top-0 z-10 bg-card pt-2.5 px-4 pb-3 border-b border-border/50">
              <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
              <div className="flex items-center justify-between">
                <h2 className="text-base font-semibold">設定</h2>
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
                      onCompositionStart={() => {
                        composingRef.current = true;
                      }}
                      onCompositionEnd={() => {
                        composingRef.current = false;
                      }}
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
            </div>
          </div>
        </div>
      )}
    </SettingsModalContext.Provider>
  );
}
