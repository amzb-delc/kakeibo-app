"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  children,
  size = "default",
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root> & {
  // default: 支出シートヘッダー用（h-7 w-12・トラック内アイコンが入る大きめ）。
  // sm: 設定のカテゴリ一覧用（h-6 w-11・行に並ぶ控えめサイズ）。
  // サムの移動量（translate-x-1 → translate-x-6 = 4px → 24px）は両サイズで一致するため
  // トラックとサムの寸法クラスだけを差し替える。
  size?: "default" | "sm";
}) {
  const track = size === "sm" ? "h-6 w-11" : "h-7 w-12";
  const thumbSize = size === "sm" ? "size-4" : "size-5";
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // 配色は category-manager の既存トグルに合わせる（blue-600 系）。
        // group: 子（トラック内のアイコン等）が data-[checked]/[unchecked] に応じて
        // 出し分けできるようにする。
        "group relative inline-flex shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[unchecked]:bg-muted-foreground/30",
        track,
        className
      )}
      {...props}
    >
      {/* トラック内に置くアイコン等（サム反対側の余白に描画する想定）。サムより背面。 */}
      {children}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className={cn(
          "pointer-events-none z-10 inline-block translate-x-1 rounded-full bg-white shadow transition-transform data-[checked]:translate-x-6",
          thumbSize
        )}
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
