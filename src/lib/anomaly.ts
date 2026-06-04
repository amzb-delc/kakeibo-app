// IQR ベースの異常値検出。median と Q1/Q3 から「いつもの幅」(Tukey's fences) を算出する。
// 値が lowerFence 未満 or upperFence 超過 なら統計的な outlier とみなせる。

export type BoxStats = {
  median: number;
  q1: number;
  q3: number;
  lowerFence: number; // Q1 - 1.5 * IQR
  upperFence: number; // Q3 + 1.5 * IQR
};

// 線形補間（R-7 / Excel `PERCENTILE.INC` 相当）。sorted は昇順前提。
function quantile(sorted: number[], p: number): number {
  const n = sorted.length;
  if (n === 1) return sorted[0];
  const index = p * (n - 1);
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  const weight = index - lower;
  return sorted[lower] * (1 - weight) + sorted[upper] * weight;
}

// サンプルが2件未満 or IQR=0（散らばりなし）の場合は判定不能として null を返す
export function calculateBoxStats(samples: number[]): BoxStats | null {
  if (samples.length < 2) return null;
  const sorted = [...samples].sort((a, b) => a - b);
  const q1 = quantile(sorted, 0.25);
  const median = quantile(sorted, 0.5);
  const q3 = quantile(sorted, 0.75);
  const iqr = q3 - q1;
  if (iqr === 0) return null;
  return {
    median,
    q1,
    q3,
    lowerFence: q1 - 1.5 * iqr,
    upperFence: q3 + 1.5 * iqr,
  };
}
