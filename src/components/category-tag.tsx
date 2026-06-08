import { categoryColor } from "@/lib/category-color";

// カテゴリ名のピル表示。色は sortOrder から categoryColor で安定的に決まる。
// 支出フォーム・サマリーで重複していたタグ markup を1か所に集約する。
// truncate=true で長い名前を省略表示する（行内で幅が限られる場面用）。
export function CategoryTag({
  name,
  sortOrder,
  truncate = false,
}: {
  name: string;
  sortOrder: number;
  truncate?: boolean;
}) {
  return (
    <span
      className={`inline-flex items-center rounded-lg px-2.5 py-0.5 text-sm font-medium ${
        truncate ? "min-w-0 " : ""
      }${categoryColor(sortOrder).tag}`}
    >
      {truncate ? <span className="truncate">{name}</span> : name}
    </span>
  );
}
