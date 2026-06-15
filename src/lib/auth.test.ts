import { describe, it, expect, vi, beforeEach } from "vitest";

// next/headers の cookies() をモックする。
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get })) }));

import { getHouseholdId, getEnteredBy } from "./auth";
import { signSession } from "./cookie-sign";

beforeEach(() => {
  get.mockReset();
});

describe("getHouseholdId", () => {
  it("cookie 無しは null", async () => {
    get.mockReturnValue(undefined);
    expect(await getHouseholdId()).toBeNull();
  });

  it("署名付き cookie を検証して世帯コードを返す（日本語）", async () => {
    get.mockReturnValue({
      value: encodeURIComponent(signSession("夫婦の合言葉")),
    });
    expect(await getHouseholdId()).toBe("夫婦の合言葉");
  });

  it("未署名の旧 cookie は null（要再保存・SEC-3）", async () => {
    get.mockReturnValue({ value: encodeURIComponent("夫婦の合言葉") });
    expect(await getHouseholdId()).toBeNull();
  });

  it("不正な %エンコーディングは throw せず null（SEC-7）", async () => {
    get.mockReturnValue({ value: "%" }); // decodeURIComponent が URIError を投げる値
    expect(await getHouseholdId()).toBeNull();
  });
});

describe("getEnteredBy", () => {
  it("cookie 無しは null", async () => {
    get.mockReturnValue(undefined);
    expect(await getEnteredBy()).toBeNull();
  });

  it('"1"→1 / "2"→2 を返す', async () => {
    get.mockReturnValue({ value: "1" });
    expect(await getEnteredBy()).toBe(1);
    get.mockReturnValue({ value: "2" });
    expect(await getEnteredBy()).toBe(2);
  });

  it("不正値（範囲外・非数値）は null", async () => {
    get.mockReturnValue({ value: "3" });
    expect(await getEnteredBy()).toBeNull();
    get.mockReturnValue({ value: "x" });
    expect(await getEnteredBy()).toBeNull();
  });
});
