import { categoryColor } from "@/lib/category-color";
import { cn } from "@/lib/utils";

// カテゴリ名のピル表示。色は sortOrder から categoryColor で安定的に決まる。
// 支出フォーム・サマリーで重複していたタグ markup を1か所に集約する。
// truncate=true で長い名前を省略表示する（行内で幅が限られる場面用）。
// className で max-width 等を足せる（省略を効かせたい場面で幅を制約する）。
export function CategoryTag({
  name,
  sortOrder,
  truncate = false,
  className,
}: {
  name: string;
  sortOrder: number;
  truncate?: boolean;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-medium",
        truncate && "min-w-0",
        categoryColor(sortOrder).tag,
        className
      )}
    >
      {truncate ? <span className="truncate">{name}</span> : name}
    </span>
  );
}
