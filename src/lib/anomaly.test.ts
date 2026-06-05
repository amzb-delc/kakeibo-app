import { describe, it, expect } from "vitest";
import { calculateBoxStats } from "./anomaly";

describe("calculateBoxStats", () => {
  it("サンプルが2件未満なら null", () => {
    expect(calculateBoxStats([])).toBeNull();
    expect(calculateBoxStats([5])).toBeNull();
  });

  it("IQR=0（散らばりなし）なら null", () => {
    expect(calculateBoxStats([3, 3, 3])).toBeNull();
    expect(calculateBoxStats([7, 7])).toBeNull();
  });

  it("[1,2,3,4,5] の四分位とフェンス（線形補間）", () => {
    expect(calculateBoxStats([1, 2, 3, 4, 5])).toEqual({
      median: 3,
      q1: 2,
      q3: 4,
      lowerFence: -1,
      upperFence: 7,
    });
  });

  it("[10,20,30,40] の四分位とフェンス（線形補間）", () => {
    expect(calculateBoxStats([10, 20, 30, 40])).toEqual({
      median: 25,
      q1: 17.5,
      q3: 32.5,
      lowerFence: -5,
      upperFence: 55,
    });
  });

  it("入力が順不同でもソートされ同じ結果になる", () => {
    expect(calculateBoxStats([5, 1, 3, 2, 4])).toEqual(
      calculateBoxStats([1, 2, 3, 4, 5]),
    );
  });

  it("lowerFence = q1 - 1.5*iqr / upperFence = q3 + 1.5*iqr を満たす", () => {
    const stats = calculateBoxStats([10, 20, 30, 40]);
    expect(stats).not.toBeNull();
    const s = stats!;
    const iqr = s.q3 - s.q1;
    expect(s.lowerFence).toBe(s.q1 - 1.5 * iqr);
    expect(s.upperFence).toBe(s.q3 + 1.5 * iqr);
  });
});
