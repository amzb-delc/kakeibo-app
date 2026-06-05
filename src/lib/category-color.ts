// カテゴリの色分け（タグ風）。seed の sortOrder で安定的に割り当てる。
// アプリ全体（サマリー・モーダル等）で同じ色を使うため、ここに集約する。
// 文字列はそのまま記述（Tailwind の検出に乗せるため動的生成しない）。

export type CategoryColor = {
  tag: string; // pill 用の背景＋文字色
  bar: string; // 棒グラフ等の塗り色
  // SVG 等で実 hex が必要な場面用。値は Tailwind v3 の -500 系と一致させている。
  // 本プロジェクトは Tailwind v4 で動作するが、v4 の OKLCH 由来色は sRGB 換算で微差が出るため
  // 「bar / tag の見た目と完全一致」は保証しない（chart は装飾扱いなので許容範囲）。
  hex: string;
};

// 16 スロットぶんを決め打ちで割り当てる。色相環を一周ぶん 16 色用意し、
// 隣り合う sortOrder（＝ドーナツの隣接セグメント）の色相が離れるよう並べ替えてある
// （色相環の連続並びに対しステップ 7 の置換。7 と 16 は互いに素なので全色を一巡する）。
const PALETTE: CategoryColor[] = [
  { tag: "bg-red-100 text-red-700", bar: "bg-red-500", hex: "#ef4444" }, // 0
  { tag: "bg-cyan-100 text-cyan-700", bar: "bg-cyan-500", hex: "#06b6d4" }, // 1
  { tag: "bg-pink-100 text-pink-700", bar: "bg-pink-500", hex: "#ec4899" }, // 2
  { tag: "bg-emerald-100 text-emerald-700", bar: "bg-emerald-500", hex: "#10b981" }, // 3
  { tag: "bg-purple-100 text-purple-700", bar: "bg-purple-500", hex: "#a855f7" }, // 4
  { tag: "bg-lime-100 text-lime-700", bar: "bg-lime-500", hex: "#84cc16" }, // 5
  { tag: "bg-indigo-100 text-indigo-700", bar: "bg-indigo-500", hex: "#6366f1" }, // 6
  { tag: "bg-orange-100 text-orange-700", bar: "bg-orange-500", hex: "#f97316" }, // 7
  { tag: "bg-sky-100 text-sky-700", bar: "bg-sky-500", hex: "#0ea5e9" }, // 8
  { tag: "bg-rose-100 text-rose-700", bar: "bg-rose-500", hex: "#f43f5e" }, // 9
  { tag: "bg-teal-100 text-teal-700", bar: "bg-teal-500", hex: "#14b8a6" }, // 10
  { tag: "bg-fuchsia-100 text-fuchsia-700", bar: "bg-fuchsia-500", hex: "#d946ef" }, // 11
  { tag: "bg-green-100 text-green-700", bar: "bg-green-500", hex: "#22c55e" }, // 12
  { tag: "bg-violet-100 text-violet-700", bar: "bg-violet-500", hex: "#8b5cf6" }, // 13
  { tag: "bg-amber-100 text-amber-700", bar: "bg-amber-500", hex: "#f59e0b" }, // 14
  { tag: "bg-blue-100 text-blue-700", bar: "bg-blue-500", hex: "#3b82f6" }, // 15
];

export function categoryColor(sortOrder: number): CategoryColor {
  const i = ((sortOrder % PALETTE.length) + PALETTE.length) % PALETTE.length;
  return PALETTE[i];
}

// 「その他」(上位N件以外の合算) 用のニュートラルな灰色。
// 個別カテゴリのどのパレット色とも被らないグレーで「集約」を表す。
export const OTHERS_COLOR: CategoryColor = {
  tag: "bg-gray-100 text-gray-600",
  bar: "bg-gray-400",
  hex: "#9ca3af", // gray-400（空リングの gray-200 より濃く、セグメントとして視認できる）
};
