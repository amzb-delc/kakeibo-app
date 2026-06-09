"use client";

import { useState } from "react";
import Image from "next/image";

// ヘッダーに出す小さなキャラクター。タップで当月へジャンプしつつ「ぴょこっ」と揺れる。
// 月に関わらず常時表示する。
export function HeaderCharacter({ onPress }: { onPress?: () => void }) {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      aria-label="今月へ移動"
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
        className={`w-7 h-7 opacity-90 ${playing ? "animate-character-wiggle" : ""}`}
        onAnimationEnd={() => setPlaying(false)}
      />
    </button>
  );
}
