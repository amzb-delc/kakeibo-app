// 支出タグ（内部仕様）。画面に "#xxx" 形式は出さず、名前空間プレフィックスで
// 種別を機械判定する。DB には Expense.tags (String[]) として保存する。
// - 夫婦タグ: "spouse:1"（♂）/ "spouse:2"（♀）… 設定の入力者 cookie 由来。新規登録時のみ付与
// - カードタグ: "card:<カード名>" … クレカ明細取込時のみ付与
// いずれも編集（PATCH）では据え置き（enteredBy 時代と同じ扱い）。

export const SPOUSE_TAG_PREFIX = "spouse:";
export const CARD_TAG_PREFIX = "card:";

export const SPOUSE_TAGS = ["spouse:1", "spouse:2"] as const;

// カード名は LLM 抽出由来の自由文字列なので上限を切る（DB/表示の暴発防止）。
export const MAX_CARD_NAME_LENGTH = 30;

export function spouseTagOf(enteredBy: 1 | 2): string {
  return `${SPOUSE_TAG_PREFIX}${enteredBy}`;
}

export function isSpouseTag(tag: string): boolean {
  return (SPOUSE_TAGS as readonly string[]).includes(tag);
}

// 制御文字（C0 と DEL）を含むか。LLM 抽出由来の事故・改行混入などを弾く。
function hasControlChar(value: string): boolean {
  for (const ch of value) {
    const code = ch.codePointAt(0)!;
    if (code < 0x20 || code === 0x7f) return true;
  }
  return false;
}

// カード名 → タグ。前後空白を落とし、空・長すぎ・制御文字入りは null（タグ化しない）。
export function cardTagOf(cardName: string): string | null {
  const trimmed = cardName.trim();
  if (!trimmed || trimmed.length > MAX_CARD_NAME_LENGTH) return null;
  if (hasControlChar(trimmed)) return null;
  return `${CARD_TAG_PREFIX}${trimmed}`;
}

export function isCardTag(tag: string): boolean {
  if (!tag.startsWith(CARD_TAG_PREFIX)) return false;
  // cardTagOf との往復一致で「trim 済み・上限内・制御文字なし」を保証する
  return cardTagOf(tag.slice(CARD_TAG_PREFIX.length)) === tag;
}

export function isValidTag(tag: string): boolean {
  return isSpouseTag(tag) || isCardTag(tag);
}

// 識別ドット用の色（hex）。spouse は固定色、card はカード名のハッシュでパレットから安定選択。
const SPOUSE_COLORS: Record<string, string> = {
  "spouse:1": "#3b82f6", // blue-500（♂）
  "spouse:2": "#f43f5e", // rose-500（♀）
};

// カテゴリ16色パレット（category-color.ts）と紛れにくいよう彩度高めの中間色を選定。
const CARD_PALETTE = ["#f59e0b", "#8b5cf6", "#10b981", "#06b6d4", "#84cc16", "#d946ef"];

export function tagColor(tag: string): string | null {
  const spouse = SPOUSE_COLORS[tag];
  if (spouse) return spouse;
  if (isCardTag(tag)) {
    const name = tag.slice(CARD_TAG_PREFIX.length);
    let h = 5381;
    for (let i = 0; i < name.length; i++) h = ((h * 33) ^ name.charCodeAt(i)) | 0;
    return CARD_PALETTE[Math.abs(h) % CARD_PALETTE.length];
  }
  return null;
}
