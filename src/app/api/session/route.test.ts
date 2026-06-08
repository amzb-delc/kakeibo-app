import { describe, it, expect, vi, beforeEach } from "vitest";
import { jsonReq } from "@/test/route-helpers";

// session は HOUSEHOLD_COOKIE と getHouseholdId を auth から import する。
const { getHouseholdId } = vi.hoisted(() => ({ getHouseholdId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ HOUSEHOLD_COOKIE: "household", getHouseholdId }));

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { household: { findUnique } } }));

import { GET, POST, DELETE } from "./route";

const URL = "http://localhost/api/session";

beforeEach(() => {
  getHouseholdId.mockReset();
  findUnique.mockReset();
});

describe("GET /api/session", () => {
  it("cookie 無しは unlocked:false", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unlocked: false });
  });

  it("保存済みは unlocked:true + 世帯名", async () => {
    getHouseholdId.mockResolvedValue("夫婦の合言葉");
    findUnique.mockResolvedValue({ name: "我が家" });
    const res = await GET();
    expect(await res.json()).toEqual({ unlocked: true, householdName: "我が家" });
  });
});

describe("POST /api/session（世帯コード保存）", () => {
  it("空コードは 400", async () => {
    const res = await POST(jsonReq(URL, { passphrase: "  " }));
    expect(res.status).toBe(400);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("一致しない世帯コードは 401", async () => {
    findUnique.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, { passphrase: "wrong" }));
    expect(res.status).toBe(401);
  });

  it("一致すれば 200・household cookie を発行", async () => {
    findUnique.mockResolvedValue({ id: "夫婦の合言葉", name: "我が家" });
    const res = await POST(jsonReq(URL, { passphrase: "夫婦の合言葉" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, householdName: "我が家" });
    const cookie = res.cookies.get("household");
    expect(cookie?.value).toBe(encodeURIComponent("夫婦の合言葉"));
  });
});

describe("DELETE /api/session（クリア）", () => {
  it("cookie を破棄する（maxAge=0）", async () => {
    const res = await DELETE();
    expect(await res.json()).toEqual({ ok: true });
    const cookie = res.cookies.get("household");
    expect(cookie?.value).toBe("");
    expect(cookie?.maxAge).toBe(0);
  });
});
