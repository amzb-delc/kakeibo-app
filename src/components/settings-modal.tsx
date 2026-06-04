"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";

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
  const [open, setOpen] = useState(false); // マウント状態
  const [shown, setShown] = useState(false); // アニメーション用（true で前面/不透明）
  const teardownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const openSettings = useCallback(() => {
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    setOpen(true);
    setShown(false);
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }, []);

  const close = useCallback(() => {
    setShown(false);
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    teardownTimer.current = setTimeout(() => setOpen(false), ANIM_MS);
  }, []);

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
              {/* 合言葉セクション（解錠・ロックUIは PR2 で実装） */}
              <section className="bg-muted/30 rounded-2xl border border-border/50 p-4">
                <h3 className="text-sm font-semibold mb-1">合言葉</h3>
                <p className="text-xs text-muted-foreground leading-relaxed">
                  家計データのロックに使う合言葉。次のアップデートで、ここから解錠・ロックができるようになります。
                </p>
              </section>
            </div>
          </div>
        </div>
      )}
    </SettingsModalContext.Provider>
  );
}
