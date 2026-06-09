"use client";

import * as React from "react";
import { Switch as SwitchPrimitive } from "@base-ui/react/switch";

import { cn } from "@/lib/utils";

function Switch({
  className,
  children,
  ...props
}: React.ComponentProps<typeof SwitchPrimitive.Root>) {
  return (
    <SwitchPrimitive.Root
      data-slot="switch"
      className={cn(
        // 配色は category-manager の既存トグルに合わせる（blue-600 系）。寸法は支出シート
        // ヘッダーのタップ目標／トラック内アイコンの視認性に合わせて一回り大きめ（h-7 w-12）。
        // group: 子（トラック内のアイコン等）が data-[checked]/[unchecked] に応じて
        // 出し分けできるようにする。
        "group relative inline-flex h-7 w-12 shrink-0 cursor-pointer items-center rounded-full transition-colors outline-none focus-visible:ring-2 focus-visible:ring-ring/30 disabled:cursor-not-allowed disabled:opacity-50 data-[checked]:bg-primary data-[unchecked]:bg-muted-foreground/30",
        className
      )}
      {...props}
    >
      {/* トラック内に置くアイコン等（サム反対側の余白に描画する想定）。サムより背面。 */}
      {children}
      <SwitchPrimitive.Thumb
        data-slot="switch-thumb"
        className="pointer-events-none z-10 inline-block size-5 translate-x-1 rounded-full bg-white shadow transition-transform data-[checked]:translate-x-6"
      />
    </SwitchPrimitive.Root>
  );
}

export { Switch };
