"use client";

import { useState } from "react";
import Image from "next/image";
import { ThinkingBubble } from "@/components/thinking-bubble";

// ヘッダーに出す小さなキャラクター。タップで「ぴょこっ」と揺れつつ、当月以外なら
// 当月へジャンプ、当月表示中ならその月を再取得（PWA向けの手動リフレッシュ導線）する。
// 月に関わらず常時表示する。
// thinking=true（明細PDF抽出中）はキャラが揺れ続け、頭から「考え中…」吹き出しを出す。
export function HeaderCharacter({
  onPress,
  thinking = false,
}: {
  onPress?: () => void;
  thinking?: boolean;
}) {
  const [playing, setPlaying] = useState(false);

  return (
    <span className="relative inline-flex">
      <button
        type="button"
        aria-label="今月へ移動・更新"
        onClick={() => {
          setPlaying(true);
          onPress?.();
        }}
        className="w-11 h-11 flex items-center justify-center -mr-1"
      >
        <Image
          src="/character.png"
          alt=""
          width={28}
          height={28}
          sizes="28px"
          aria-hidden="true"
          className={`w-7 h-7 opacity-90 ${
            thinking
              ? "animate-character-loading"
              : playing
                ? "animate-character-wiggle"
                : ""
          }`}
          onAnimationEnd={() => setPlaying(false)}
        />
      </button>
      {thinking && <ThinkingBubble side="right" />}
    </span>
  );
}
