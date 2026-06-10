import { describe, it, expect, vi, beforeEach } from "vitest";

// next/headers の cookies() と prisma をモックする。
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get })) }));

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));

import { getHouseholdId, getDemoUserId, getEnteredBy } from "./auth";

beforeEach(() => {
  get.mockReset();
  findUnique.mockReset();
});

describe("getHouseholdId", () => {
  it("cookie 無しは null", async () => {
    get.mockReturnValue(undefined);
    expect(await getHouseholdId()).toBeNull();
  });

  it("cookie 値を decodeURIComponent して返す（日本語の世帯コード）", async () => {
    get.mockReturnValue({ value: encodeURIComponent("夫婦の合言葉") });
    expect(await getHouseholdId()).toBe("夫婦の合言葉");
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

describe("getDemoUserId", () => {
  // ※ モジュール内キャッシュがあるため throw テストを先に置く（成功時に永続キャッシュされる）。
  it("demo ユーザーが無ければ throw", async () => {
    findUnique.mockResolvedValue(null);
    await expect(getDemoUserId()).rejects.toThrow("demo user not found");
  });

  it("取得した id を返し、2回目はキャッシュして再クエリしない", async () => {
    findUnique.mockResolvedValue({ id: "u-1" });
    expect(await getDemoUserId()).toBe("u-1");
    expect(await getDemoUserId()).toBe("u-1");
    expect(findUnique).toHaveBeenCalledTimes(1);
  });
});
