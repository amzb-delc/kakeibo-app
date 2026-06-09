"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// ヘッダのすぐ下に一定時間だけ出すトースト通知（視認性のため上部に配置）。
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
      className="fixed left-4 right-4 z-[60] top-[calc(env(safe-area-inset-top)+4.75rem)] mx-auto max-w-sm bg-foreground/85 text-background backdrop-blur-sm rounded-xl px-4 py-3 text-sm font-medium text-center shadow-lg animate-in slide-in-from-top fade-in"
    >
      {message}
    </div>
  );
}
