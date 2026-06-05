// 金額表示のフォーマッタ。円表示の規約（ja-JP・¥プレフィクス・差額の符号）を集約する。

// 金額を「¥1,280」形式に。
export function formatYen(amount: number): string {
  return `¥${amount.toLocaleString("ja-JP")}`;
}

// 差額を符号付きで。0 は「±¥0」、正は「+¥…」、負は「-¥…」。
export function formatDiff(diff: number): string {
  if (diff === 0) return "±¥0";
  const abs = Math.abs(diff).toLocaleString("ja-JP");
  return diff > 0 ? `+¥${abs}` : `-¥${abs}`;
}
