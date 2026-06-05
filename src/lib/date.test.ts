import { describe, it, expect } from "vitest";
import {
  pad2,
  lastDayOfMonth,
  shiftMonth,
  ymKey,
  formatJstDate,
  parseJstDate,
  formatJstDateLabel,
} from "./date";

describe("pad2", () => {
  it("2桁ゼロ詰め", () => {
    expect(pad2(0)).toBe("00");
    expect(pad2(3)).toBe("03");
    expect(pad2(12)).toBe("12");
  });
});

describe("lastDayOfMonth", () => {
  it("通常月", () => {
    expect(lastDayOfMonth(2024, 1)).toBe(31);
    expect(lastDayOfMonth(2024, 4)).toBe(30);
    expect(lastDayOfMonth(2024, 12)).toBe(31);
  });
  it("うるう年の2月は29、平年は28", () => {
    expect(lastDayOfMonth(2024, 2)).toBe(29);
    expect(lastDayOfMonth(2023, 2)).toBe(28);
    expect(lastDayOfMonth(2000, 2)).toBe(29); // 400で割れる
    expect(lastDayOfMonth(1900, 2)).toBe(28); // 100で割れて400で割れない
  });
});

describe("shiftMonth", () => {
  it("前後にずらす", () => {
    expect(shiftMonth(2024, 6, 1)).toEqual({ year: 2024, month: 7 });
    expect(shiftMonth(2024, 6, -1)).toEqual({ year: 2024, month: 5 });
  });
  it("年跨ぎを正規化する", () => {
    expect(shiftMonth(2024, 1, -1)).toEqual({ year: 2023, month: 12 });
    expect(shiftMonth(2024, 12, 1)).toEqual({ year: 2025, month: 1 });
    expect(shiftMonth(2024, 3, -5)).toEqual({ year: 2023, month: 10 });
    expect(shiftMonth(2024, 6, -5)).toEqual({ year: 2024, month: 1 });
  });
});

describe("ymKey", () => {
  it("YYYY-MM 形式", () => {
    expect(ymKey(2024, 3)).toBe("2024-03");
    expect(ymKey(2024, 12)).toBe("2024-12");
  });
});

describe("JST 変換", () => {
  it("parseJstDate → formatJstDate の往復", () => {
    const d = parseJstDate("2024-03-15");
    expect(d).not.toBeNull();
    expect(formatJstDate(d as Date)).toBe("2024-03-15");
  });
  it("parseJstDate は JST 00:00 を UTC で表す（-9h）", () => {
    const d = parseJstDate("2024-03-15");
    expect((d as Date).toISOString()).toBe("2024-03-14T15:00:00.000Z");
  });
  it("不正な文字列は null", () => {
    expect(parseJstDate("2024/03/15")).toBeNull();
    expect(parseJstDate("not-a-date")).toBeNull();
  });
  it("formatJstDateLabel は M/D(曜)", () => {
    // 2024-03-15 は金曜
    expect(formatJstDateLabel(parseJstDate("2024-03-15") as Date)).toBe("3/15(金)");
  });
});
