"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ボトムシート（下端 anchor のモーダル）の共通基盤。
// expense-modal / settings-modal で重複していた開閉アニメ・Esc・スクロールロック・
// translateY 駆動・バックドロップ・グラバーヘッダを一本化する。

const ANIM_MS = 320;
const EASE = "cubic-bezier(0.32, 0.72, 0, 1)"; // iOS シート風のイージング
const CLOSE_THRESHOLD = 110; // この px 超のドラッグで閉じる
const FLICK_VELOCITY = 0.5; // px/ms。速い下フリックでも閉じる

type DragHandlers = Pick<
  React.DOMAttributes<HTMLElement>,
  "onPointerDown" | "onPointerMove" | "onPointerUp" | "onPointerCancel"
>;

export type BottomSheetController = {
  mounted: boolean; // true の間だけシートを描画する
  open: () => void;
  close: () => void;
  panelStyle: React.CSSProperties;
  backdropStyle: React.CSSProperties;
  dragHandlers: DragHandlers; // draggable=false なら空（グラバーに spread する）
};

// シートの開閉状態とアニメ・操作を司るフック。
// onClosed: 退場アニメ完了（アンマウント）時に呼ばれる。元ページの選択データの破棄などに使う。
export function useBottomSheet(opts?: {
  draggable?: boolean;
  onClosed?: () => void;
}): BottomSheetController {
  const draggable = opts?.draggable ?? false;
  const [mounted, setMounted] = useState(false);
  const [shown, setShown] = useState(false); // true で前面・不透明・translateY(0)
  const [dragY, setDragY] = useState<number | null>(null); // null = ドラッグ中でない
  const teardownTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragStart = useRef<{ y: number; t: number } | null>(null);
  // 最新の onClosed を保持（close を安定させるため ref 経由で呼ぶ）。
  const onClosedRef = useRef(opts?.onClosed);
  useEffect(() => {
    onClosedRef.current = opts?.onClosed;
  });

  const open = useCallback(() => {
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    setMounted(true);
    setDragY(null);
    setShown(false);
    // 2フレーム後に表示状態へ切替えて transition を発火させる
    requestAnimationFrame(() => requestAnimationFrame(() => setShown(true)));
  }, []);

  const close = useCallback(() => {
    setShown(false);
    if (teardownTimer.current) clearTimeout(teardownTimer.current);
    teardownTimer.current = setTimeout(() => {
      setMounted(false);
      setDragY(null);
      onClosedRef.current?.();
    }, ANIM_MS);
  }, []);

  // Esc で閉じる + 背面スクロールロック（mounted の間）。
  // iOS では overflow:hidden だけだと入力フォーカス時に背面（ホーム）がスクロールして
  // しまうため、body を position:fixed で現在位置に固定し、閉じたら元の位置へ戻す。
  useEffect(() => {
    if (!mounted) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    const body = document.body;
    const scrollY = window.scrollY;
    const prev = {
      position: body.style.position,
      top: body.style.top,
      left: body.style.left,
      right: body.style.right,
      width: body.style.width,
      overflow: body.style.overflow,
    };
    body.style.position = "fixed";
    body.style.top = `-${scrollY}px`;
    body.style.left = "0";
    body.style.right = "0";
    body.style.width = "100%";
    body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      Object.assign(body.style, prev);
      window.scrollTo(0, scrollY);
    };
  }, [mounted, close]);

  // アンマウント時にタイマー後始末
  useEffect(
    () => () => {
      if (teardownTimer.current) clearTimeout(teardownTimer.current);
    },
    []
  );

  // --- ドラッグで閉じる（グラバー起点） ---
  const dragHandlers: DragHandlers = draggable
    ? {
        onPointerDown: (e) => {
          if ((e.target as HTMLElement).closest("button")) return; // ボタン上では発火しない
          dragStart.current = { y: e.clientY, t: performance.now() };
          setDragY(0);
          e.currentTarget.setPointerCapture?.(e.pointerId);
        },
        onPointerMove: (e) => {
          if (!dragStart.current) return;
          const dy = e.clientY - dragStart.current.y;
          setDragY(dy > 0 ? dy : dy * 0.2);
        },
        onPointerUp: (e) => {
          if (!dragStart.current) return;
          const dy = e.clientY - dragStart.current.y;
          const dt = performance.now() - dragStart.current.t;
          const v = dy / Math.max(dt, 1);
          dragStart.current = null;
          setDragY(null);
          if (dy > CLOSE_THRESHOLD || (dy > 24 && v > FLICK_VELOCITY)) close();
        },
        onPointerCancel: () => {
          dragStart.current = null;
          setDragY(null);
        },
      }
    : {};

  const dragging = dragY !== null;
  const panelStyle: React.CSSProperties = {
    transform: dragging
      ? `translateY(${Math.max(0, dragY ?? 0)}px)`
      : shown
        ? "translateY(0)"
        : "translateY(100%)",
    transition: dragging ? "none" : `transform ${ANIM_MS}ms ${EASE}`,
  };
  const backdropStyle: React.CSSProperties = { opacity: shown ? 1 : 0 };

  return { mounted, open, close, panelStyle, backdropStyle, dragHandlers };
}

type BottomSheetProps = {
  ariaLabel: string;
  title: React.ReactNode;
  onClose: () => void;
  panelStyle: React.CSSProperties;
  backdropStyle: React.CSSProperties;
  draggable?: boolean;
  dragHandlers?: DragHandlers;
  /** ヘッダ右の ✕ の左に置く追加アクション（例: 削除ボタン） */
  headerActions?: React.ReactNode;
  children: React.ReactNode;
};

// シートの外枠（dialog + バックドロップ + パネル + グラバーヘッダ）。
// 本文（children）は呼び出し側が用意する。
export function BottomSheet({
  ariaLabel,
  title,
  onClose,
  panelStyle,
  backdropStyle,
  draggable = false,
  dragHandlers,
  headerActions,
  children,
}: BottomSheetProps) {
  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label={ariaLabel}
      className="fixed inset-0 z-50 flex items-end justify-center"
      onClick={onClose}
    >
      {/* バックドロップ（パネルとは別レイヤー） */}
      <div
        aria-hidden="true"
        className="absolute inset-0 bg-black/40 transition-opacity duration-300 ease-out"
        style={backdropStyle}
      />

      {/* パネル */}
      <div
        className="relative w-full sm:max-w-md max-h-[90vh] overflow-y-auto bg-card rounded-t-2xl sm:rounded-2xl sm:mb-4 shadow-xl"
        style={panelStyle}
        onClick={(e) => e.stopPropagation()}
      >
        {/* グラバー + ヘッダ（draggable のときはドラッグハンドル兼用） */}
        <div
          className={`sticky top-0 z-10 bg-card pt-2.5 px-4 pb-3 border-b border-border/50${
            draggable
              ? " touch-none select-none cursor-grab active:cursor-grabbing"
              : ""
          }`}
          {...(draggable ? dragHandlers : {})}
        >
          <div className="mx-auto mb-2 h-1.5 w-10 rounded-full bg-muted-foreground/25" />
          <div className="flex items-center justify-between">
            <h2 className="text-base font-semibold">{title}</h2>
            <div className="flex items-center gap-0.5">
              {headerActions}
              <button
                type="button"
                onClick={onClose}
                aria-label="閉じる"
                className="w-10 h-10 -mr-1 rounded-full flex items-center justify-center text-lg text-muted-foreground hover:bg-muted transition-colors"
              >
                ✕
              </button>
            </div>
          </div>
        </div>

        {children}
      </div>
    </div>
  );
}
