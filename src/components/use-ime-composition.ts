"use client";

import { useCallback, useRef } from "react";

// 日本語IME（かな漢字変換）の変換中フラグを管理する小フック。
// 変換確定の Enter がフォーム送信/確定として誤発火するのを防ぐのに使う。
// 使い方:
//   const { isComposing, bind } = useImeComposition();
//   <input {...bind} onKeyDown={(e) => { if (e.key === "Enter" && !isComposing()) ... }} />
//   onSubmit で if (isComposing()) return;
export function useImeComposition() {
  const composingRef = useRef(false);
  const onCompositionStart = useCallback(() => {
    composingRef.current = true;
  }, []);
  const onCompositionEnd = useCallback(() => {
    composingRef.current = false;
  }, []);
  // 変換中か（変換確定 Enter の誤送信を弾く判定に使う）。
  const isComposing = useCallback(() => composingRef.current, []);
  return {
    isComposing,
    // 入力要素にそのまま展開する: <input {...bind} />
    bind: { onCompositionStart, onCompositionEnd },
  };
}
