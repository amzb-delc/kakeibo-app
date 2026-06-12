import { describe, it, expect } from "vitest";
import {
  spouseTagOf,
  isSpouseTag,
  cardTagOf,
  isCardTag,
  isValidTag,
  tagColor,
} from "./tags";

describe("spouseTagOf", () => {
  it("入力者 1/2 を spouse:N 形式に変換する", () => {
    expect(spouseTagOf(1)).toBe("spouse:1");
    expect(spouseTagOf(2)).toBe("spouse:2");
  });
});

describe("isSpouseTag", () => {
  it("spouse:1 / spouse:2 のみ true", () => {
    expect(isSpouseTag("spouse:1")).toBe(true);
    expect(isSpouseTag("spouse:2")).toBe(true);
  });

  it("範囲外・別名前空間・空は false", () => {
    expect(isSpouseTag("spouse:3")).toBe(false);
    expect(isSpouseTag("spouse:")).toBe(false);
    expect(isSpouseTag("card:楽天")).toBe(false);
    expect(isSpouseTag("")).toBe(false);
  });
});

describe("cardTagOf", () => {
  it("正常なカード名を card:<名前> に変換する", () => {
    expect(cardTagOf("楽天カード")).toBe("card:楽天カード");
  });

  it("前後の空白を落として変換する", () => {
    expect(cardTagOf("  楽天カード  ")).toBe("card:楽天カード");
  });

  it("空・空白のみは null", () => {
    expect(cardTagOf("")).toBeNull();
    expect(cardTagOf("   ")).toBeNull();
  });

  it("30文字超は null（境界: 30=可, 31=不可）", () => {
    expect(cardTagOf("あ".repeat(30))).toBe(`card:${"あ".repeat(30)}`);
    expect(cardTagOf("あ".repeat(31))).toBeNull();
  });

  it("制御文字（改行など）入りは null", () => {
    expect(cardTagOf("楽天\nカード")).toBeNull();
    expect(cardTagOf("楽天\tカード")).toBeNull();
  });
});

describe("isCardTag", () => {
  it("cardTagOf が往復一致する正常なカードタグは true", () => {
    expect(isCardTag("card:楽天カード")).toBe(true);
  });

  it('"card:" だけ（中身が空）は false', () => {
    expect(isCardTag("card:")).toBe(false);
  });

  it("前後に空白を含む（正規化されていない）タグは false", () => {
    expect(isCardTag("card: 楽天カード ")).toBe(false);
  });

  it("プレフィックス違い・spouse タグは false", () => {
    expect(isCardTag("spouse:1")).toBe(false);
    expect(isCardTag("楽天カード")).toBe(false);
  });

  it("30文字超のカードタグは往復一致せず false", () => {
    expect(isCardTag(`card:${"あ".repeat(31)}`)).toBe(false);
  });
});

describe("isValidTag", () => {
  it("spouse / card の有効タグは true", () => {
    expect(isValidTag("spouse:1")).toBe(true);
    expect(isValidTag("spouse:2")).toBe(true);
    expect(isValidTag("card:楽天カード")).toBe(true);
  });

  it("いずれでもない形式は false", () => {
    expect(isValidTag("spouse:3")).toBe(false);
    expect(isValidTag("card:")).toBe(false);
    expect(isValidTag("bogus")).toBe(false);
    expect(isValidTag("")).toBe(false);
  });
});

describe("tagColor", () => {
  it("spouse タグは固定色を返す", () => {
    expect(tagColor("spouse:1")).toBe("#3b82f6");
    expect(tagColor("spouse:2")).toBe("#f43f5e");
  });

  it("card タグは同じカード名なら安定して同じ色を返す", () => {
    const a = tagColor("card:楽天カード");
    const b = tagColor("card:楽天カード");
    expect(a).toBe(b);
  });

  it("card タグの色はパレット内の hex を返す", () => {
    const palette = ["#f59e0b", "#8b5cf6", "#10b981", "#06b6d4", "#84cc16", "#d946ef"];
    for (const name of ["楽天カード", "三井住友", "JCB", "AMEX", "VISA", "イオン"]) {
      expect(palette).toContain(tagColor(`card:${name}`));
    }
  });

  it("不正タグ（無効な spouse/card・空）は null", () => {
    expect(tagColor("spouse:3")).toBeNull();
    expect(tagColor("card:")).toBeNull();
    expect(tagColor("bogus")).toBeNull();
    expect(tagColor("")).toBeNull();
  });
});
