import { cn } from "@/lib/utils";

// 明細PDF取り込み中、マスコット（宇宙人）の頭から出る「考え中…」のモクモク思考吹き出し。
// 装飾なので aria-hidden。pointer-events-none で背後の画面操作を妨げない。
// 親に position:relative を持たせ、その左上/右上を基準に絶対配置する想定。
// side="right"（ヘッダ右のキャラ）は画面右端で見切れないよう左下方向へ開く。
// 影は本体＋しっぽ＋膨らみをまとめて drop-shadow でかけ、雲のシルエットを一体に見せる。
export function ThinkingBubble({ side = "left" }: { side?: "left" | "right" }) {
  const isRight = side === "right";
  return (
    <span
      aria-hidden="true"
      className={cn(
        "pointer-events-none absolute z-20 animate-thinking-puff [filter:drop-shadow(0_2px_3px_rgba(0,0,0,0.18))]",
        isRight ? "right-9 top-4" : "left-7 top-6"
      )}
    >
      {/* しっぽ：小さな泡が2つ、キャラの頭へ向かって連なる */}
      <span
        className={cn(
          "absolute -top-1 block h-1.5 w-1.5 rounded-full bg-card",
          isRight ? "-right-2" : "-left-2"
        )}
      />
      <span
        className={cn(
          "absolute top-1.5 block h-2.5 w-2.5 rounded-full bg-card",
          isRight ? "-right-0.5" : "-left-0.5"
        )}
      />

      {/* モクモク本体（上辺に膨らみを足して雲のシルエットに） */}
      <span className="relative block rounded-[1.1rem] bg-card px-3 py-2">
        <span className="absolute -top-1.5 left-2 block h-3 w-3 rounded-full bg-card" />
        <span className="absolute -top-2.5 left-5 block h-4 w-4 rounded-full bg-card" />
        <span className="absolute -top-1.5 right-3 block h-3.5 w-3.5 rounded-full bg-card" />

        {/* 考え中の3点ドット（順番に弾む） */}
        <span className="relative flex items-center gap-1">
          <span className="block h-1.5 w-1.5 rounded-full bg-foreground/60 animate-thinking-dot" />
          <span
            className="block h-1.5 w-1.5 rounded-full bg-foreground/60 animate-thinking-dot"
            style={{ animationDelay: "0.18s" }}
          />
          <span
            className="block h-1.5 w-1.5 rounded-full bg-foreground/60 animate-thinking-dot"
            style={{ animationDelay: "0.36s" }}
          />
        </span>
      </span>
    </span>
  );
}
