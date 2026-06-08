"use client";

import { useEffect } from "react";

// 左右スワイプ（横移動が縦より優位なときだけ）を検出して前後へナビゲートする。
// 確定時は preventDefault でスクロールと合成クリック（誤タップ）を抑止する。
// passive 制御のため native リスナーで張る。以前は SummaryPage に同居していた。
const SWIPE_MIN = 36; // これ未満／縦移動優位は無視（px）。PWA想定で感度高め。

export function useSwipeNavigation(
  ref: React.RefObject<HTMLElement | null>,
  opts: { onSwipeRight: () => void; onSwipeLeft: () => void; enabled: boolean }
) {
  const { onSwipeRight, onSwipeLeft, enabled } = opts;

  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    let startX = 0;
    let startY = 0;
    let tracking = false;
    let horizontal = false;

    const onStart = (e: TouchEvent) => {
      if (e.touches.length !== 1) {
        tracking = false;
        return;
      }
      startX = e.touches[0].clientX;
      startY = e.touches[0].clientY;
      tracking = true;
      horizontal = false;
    };
    const onMove = (e: TouchEvent) => {
      if (!tracking) return;
      const dx = e.touches[0].clientX - startX;
      const dy = e.touches[0].clientY - startY;
      if (!horizontal && Math.abs(dx) > 6 && Math.abs(dx) > Math.abs(dy)) {
        horizontal = true;
      }
      if (horizontal) e.preventDefault();
    };
    const onEnd = (e: TouchEvent) => {
      if (!tracking) return;
      tracking = false;
      const dx = e.changedTouches[0].clientX - startX;
      const dy = e.changedTouches[0].clientY - startY;
      if (Math.abs(dx) < SWIPE_MIN || Math.abs(dx) <= Math.abs(dy)) return;
      if (!enabled) return;
      if (dx < 0) {
        onSwipeLeft(); // 左スワイプ
      } else {
        onSwipeRight(); // 右スワイプ
      }
    };
    const onCancel = () => {
      tracking = false;
    };

    el.addEventListener("touchstart", onStart, { passive: true });
    el.addEventListener("touchmove", onMove, { passive: false });
    el.addEventListener("touchend", onEnd, { passive: true });
    el.addEventListener("touchcancel", onCancel, { passive: true });
    return () => {
      el.removeEventListener("touchstart", onStart);
      el.removeEventListener("touchmove", onMove);
      el.removeEventListener("touchend", onEnd);
      el.removeEventListener("touchcancel", onCancel);
    };
  }, [ref, enabled, onSwipeLeft, onSwipeRight]);
}
