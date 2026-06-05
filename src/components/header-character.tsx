"use client";

import { useState } from "react";
import Image from "next/image";

// ヘッダーに出す小さなキャラクター。タップすると一発だけ「ぴょこっ」と揺れる。
// 当月表示のときだけ親から描画される（過去月では出さない）。
export function HeaderCharacter() {
  const [playing, setPlaying] = useState(false);

  return (
    <button
      type="button"
      aria-label="キャラクター"
      onClick={() => setPlaying(true)}
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
