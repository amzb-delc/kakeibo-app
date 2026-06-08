"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// 画面下部に一定時間だけ出すトースト通知。
// 以前は ExpenseModalProvider に同居していたが、独立した UI プリミティブとして切り出す。
const TOAST_MS = 2200;

export function useToast() {
  const [message, setMessage] = useState<string | null>(null);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  const show = useCallback((next: string) => {
    setMessage(next);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => setMessage(null), TOAST_MS);
  }, []);

  // アンマウント時にタイマーを後始末
  useEffect(
    () => () => {
      if (timer.current) clearTimeout(timer.current);
    },
    []
  );

  return { message, show };
}

export function Toast({ message }: { message: string | null }) {
  if (!message) return null;
  return (
    <div
      role="status"
      aria-live="polite"
      className="fixed bottom-6 left-4 right-4 z-[60] bg-foreground text-background rounded-xl px-4 py-3 text-sm font-medium text-center shadow-lg animate-in slide-in-from-bottom"
    >
      {message}
    </div>
  );
}
