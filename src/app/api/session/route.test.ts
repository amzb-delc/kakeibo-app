import { describe, it, expect, vi, beforeEach } from "vitest";
import { jsonReq } from "@/test/route-helpers";

// session は cookie 定数と getHouseholdId / getEnteredBy を auth から import する。
const { getHouseholdId, getEnteredBy } = vi.hoisted(() => ({
  getHouseholdId: vi.fn(),
  getEnteredBy: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({
  HOUSEHOLD_COOKIE: "household",
  ENTERED_BY_COOKIE: "enteredBy",
  getHouseholdId,
  getEnteredBy,
}));

const { findUnique } = vi.hoisted(() => ({ findUnique: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { household: { findUnique } } }));

import { GET, POST, PATCH, DELETE } from "./route";

const URL = "http://localhost/api/session";

beforeEach(() => {
  getHouseholdId.mockReset();
  getEnteredBy.mockReset().mockResolvedValue(null);
  findUnique.mockReset();
});

describe("GET /api/session", () => {
  it("cookie 無しは unlocked:false（enteredBy も返す）", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await GET();
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ unlocked: false, enteredBy: null });
  });

  it("保存済みは unlocked:true + 世帯名 + enteredBy", async () => {
    getHouseholdId.mockResolvedValue("夫婦の合言葉");
    getEnteredBy.mockResolvedValue(2);
    findUnique.mockResolvedValue({ name: "我が家" });
    const res = await GET();
    expect(await res.json()).toEqual({
      unlocked: true,
      householdName: "我が家",
      enteredBy: 2,
    });
  });
});

describe("PATCH /api/session（入力者の保存）", () => {
  it("1/2 以外は 400・cookie を発行しない", async () => {
    const res = await PATCH(jsonReq(URL, { enteredBy: 3 }, "PATCH"));
    expect(res.status).toBe(400);
    expect(res.cookies.get("enteredBy")).toBeUndefined();
  });

  it("1 を保存すると 200・enteredBy cookie を発行", async () => {
    const res = await PATCH(jsonReq(URL, { enteredBy: 1 }, "PATCH"));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, enteredBy: 1 });
    expect(res.cookies.get("enteredBy")?.value).toBe("1");
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
  it("世帯コードと入力者の cookie を両方破棄する（maxAge=0）", async () => {
    const res = await DELETE();
    expect(await res.json()).toEqual({ ok: true });
    const household = res.cookies.get("household");
    expect(household?.value).toBe("");
    expect(household?.maxAge).toBe(0);
    const entered = res.cookies.get("enteredBy");
    expect(entered?.value).toBe("");
    expect(entered?.maxAge).toBe(0);
  });
});
