// カテゴリの色分け（タグ風）。seed の sortOrder で安定的に割り当てる。
// アプリ全体（サマリー・モーダル等）で同じ色を使うため、ここに集約する。
// 文字列はそのまま記述（Tailwind の検出に乗せるため動的生成しない）。

export type CategoryColor = {
  tag: string; // pill 用の背景＋文字色
  bar: string; // 棒グラフ等の塗り色
};

const PALETTE: CategoryColor[] = [
  { tag: "bg-rose-100 text-rose-700", bar: "bg-rose-500" },
  { tag: "bg-orange-100 text-orange-700", bar: "bg-orange-500" },
  { tag: "bg-amber-100 text-amber-700", bar: "bg-amber-500" },
  { tag: "bg-lime-100 text-lime-700", bar: "bg-lime-500" },
  { tag: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500" },
  { tag: "bg-teal-100 text-teal-700", bar: "bg-teal-500" },
  { tag: "bg-cyan-100 text-cyan-700", bar: "bg-cyan-500" },
  { tag: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500" },
  { tag: "bg-violet-100 text-violet-700", bar: "bg-violet-500" },
  { tag: "bg-fuchsia-100 text-fuchsia-700", bar: "bg-fuchsia-500" },
];

export function categoryColor(sortOrder: number): CategoryColor {
  const i = ((sortOrder % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i];
}
