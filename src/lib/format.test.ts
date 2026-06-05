import { describe, it, expect } from "vitest";
import { formatYen, formatDiff } from "./format";

describe("formatYen", () => {
  it("¥ + 3桁区切り", () => {
    expect(formatYen(0)).toBe("¥0");
    expect(formatYen(1280)).toBe("¥1,280");
    expect(formatYen(1000000)).toBe("¥1,000,000");
  });
});

describe("formatDiff", () => {
  it("0 は ±¥0", () => {
    expect(formatDiff(0)).toBe("±¥0");
  });
  it("正は +¥、負は -¥（絶対値を3桁区切り）", () => {
    expect(formatDiff(1500)).toBe("+¥1,500");
    expect(formatDiff(-1500)).toBe("-¥1,500");
  });
});
