import { describe, it, expect } from "vitest";
import {
  getTrendLevel,
  TREND_ICON,
  TREND_TEXT_COLOR,
  TREND_BG_COLOR,
  type TrendLevel,
} from "./trend";

describe("getTrendLevel", () => {
  it("prev=0 のとき: current>0 は up2、それ以外は flat", () => {
    expect(getTrendLevel(0, 0)).toBe("flat");
    expect(getTrendLevel(100, 0)).toBe("up2");
  });

  it("ratio>=0.2 は up2", () => {
    expect(getTrendLevel(120, 100)).toBe("up2");
  });

  it("0.05<=ratio<0.2 は up1", () => {
    expect(getTrendLevel(110, 100)).toBe("up1");
    expect(getTrendLevel(105, 100)).toBe("up1");
  });

  it("-0.05<ratio<0.05 は flat", () => {
    expect(getTrendLevel(104, 100)).toBe("flat");
    expect(getTrendLevel(100, 100)).toBe("flat");
    expect(getTrendLevel(96, 100)).toBe("flat");
  });

  it("ratio<=-0.05 は down", () => {
    expect(getTrendLevel(95, 100)).toBe("down");
    expect(getTrendLevel(50, 100)).toBe("down");
  });
});

describe("トレンドマップ", () => {
  const levels: TrendLevel[] = ["up2", "up1", "flat", "down"];

  it("TREND_ICON は4レベルすべてのキーを持つ", () => {
    expect(Object.keys(TREND_ICON).sort()).toEqual([...levels].sort());
    for (const l of levels) {
      expect(TREND_ICON[l]).toBeTruthy();
    }
  });

  it("TREND_TEXT_COLOR は4レベルすべてのキーを持つ", () => {
    expect(Object.keys(TREND_TEXT_COLOR).sort()).toEqual([...levels].sort());
    for (const l of levels) {
      expect(TREND_TEXT_COLOR[l]).toBeTruthy();
    }
  });

  it("TREND_BG_COLOR は4レベルすべてのキーを持つ", () => {
    expect(Object.keys(TREND_BG_COLOR).sort()).toEqual([...levels].sort());
    for (const l of levels) {
      expect(TREND_BG_COLOR[l]).toBeTruthy();
    }
  });
});
