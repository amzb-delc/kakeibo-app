import { describe, it, expect, vi, beforeEach } from "vitest";

// next/headers の cookies() と prisma をモックする。
const { get } = vi.hoisted(() => ({ get: vi.fn() }));
vi.mock("next/headers", () => ({ cookies: vi.fn(async () => ({ get })) }));

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { user: { findUnique } } }));

import { getHouseholdId, getDemoUserId } from "./auth";
import { signSession } from "./cookie-sign";

beforeEach(() => {
  get.mockReset();
  findUnique.mockReset();
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
