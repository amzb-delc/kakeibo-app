"use client";

import { Camera, Plus, Settings } from "lucide-react";
import { useExpenseModal } from "@/components/expense-modal";
import { useSettingsModal } from "@/components/settings-modal";
import { useSession } from "@/components/session-provider";
import { ReceiptCaptureButton } from "@/components/receipt-capture-button";

export function FooterNav() {
  const { openCreate, notify } = useExpenseModal();
  const { openSettings } = useSettingsModal();
  const { unlocked, enteredBy } = useSession();

  // 入力者が未設定なら登録に進ませず設定モーダルへ誘導（登録前に必須）。
  const startCreate = (opts?: Parameters<typeof openCreate>[0]) => {
    if (enteredBy == null) {
      openSettings();
      return;
    }
    openCreate(opts);
  };

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border/50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative flex items-stretch h-24">
        {/* 左: 設定（ホームは唯一のページなのでサマリータブは廃止） */}
        <button
          type="button"
          onClick={openSettings}
          aria-label={unlocked === false ? "設定（世帯コード未保存）" : "設定"}
          className="flex-1 flex items-center justify-center h-full min-h-[72px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="relative">
            <Settings size={40} strokeWidth={2} aria-hidden="true" />
            {/* 未保存（世帯コード未入力）はバッジで気づけるようにする */}
            {unlocked === false && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-card" />
            )}
          </span>
        </button>

        {/* 中央: FAB 用スペーサー */}
        <div className="w-32 shrink-0" aria-hidden="true" />

        {/* 右: レシート撮影でOCR → 抽出結果入り・連続入力ONで登録モーダルを開く
            （まとめ入力動線）。未保存（cookie 無し）は OCR API も 401 なので出さない。
            アイコンは“重ねカメラ”で連続入力モードを表す。 */}
        {unlocked && enteredBy != null ? (
          <ReceiptCaptureButton
            onResult={(r) => openCreate({ ocr: r, keepOpen: true })}
            onError={notify}
            aria-label="レシートで続けて支出を登録（連続入力）"
            className="flex-1 w-auto h-full min-h-[72px] rounded-none text-muted-foreground hover:bg-transparent hover:text-foreground"
            iconClassName="size-10"
            icon={
              <span className="relative inline-block size-11" aria-hidden="true">
                {/* 背面カメラ（右斜め上・薄め）＝重ねて連続入力モードを示す。
                    2枚を中央寄せ＋わずかにずらして大きく重ねる。 */}
                <Camera className="absolute inset-0 m-auto size-9 opacity-50 translate-x-[3px] -translate-y-[3px]" />
                {/* 前面カメラ（左下）。内側を card 色で塗り、背面の透けを隠す。 */}
                <Camera className="absolute inset-0 m-auto size-9 fill-card -translate-x-[3px] translate-y-[3px]" />
              </span>
            }
          />
        ) : unlocked ? (
          // 保存済みだが入力者が未設定: 撮影前に設定モーダルへ誘導する。
          <button
            type="button"
            onClick={openSettings}
            aria-label="レシートで支出を登録（先に入力者の設定が必要）"
            className="flex-1 flex items-center justify-center h-full min-h-[72px] text-muted-foreground hover:text-foreground transition-colors"
          >
            <span className="relative inline-block size-11" aria-hidden="true">
              <Camera className="absolute inset-0 m-auto size-9 opacity-50 translate-x-[3px] -translate-y-[3px]" />
              <Camera className="absolute inset-0 m-auto size-9 fill-card -translate-x-[3px] translate-y-[3px]" />
            </span>
          </button>
        ) : (
          <div className="flex-1" aria-hidden="true" />
        )}

        {/* 登録 FAB は未保存のときは出さない（未保存では登録できないため） */}
        {unlocked && (
          <button
            type="button"
            onClick={() => startCreate()}
            aria-label="支出を登録"
            className="absolute left-1/2 -translate-x-1/2 -top-11 w-[88px] h-[88px] rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-primary-foreground ring-8 ring-card shadow-[0_12px_28px_-6px_rgba(37,99,235,0.55),0_4px_8px_-2px_rgba(37,99,235,0.35)] flex items-center justify-center transition-all duration-200 ease-out active:scale-90 active:duration-75 active:shadow-[0_4px_10px_-2px_rgba(37,99,235,0.5)] active:translate-y-0.5 hover:from-blue-400 hover:to-blue-700 will-change-transform"
          >
            <Plus
              size={40}
              strokeWidth={3}
              strokeLinecap="round"
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </nav>
  );
}
