import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jsonReq } from "@/test/route-helpers";
import { resetRateLimit } from "@/lib/rate-limit";
import { verifySession } from "@/lib/cookie-sign";

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
  resetRateLimit(); // IP バケットを毎テスト初期化（モジュール状態の持ち越し防止）
});

afterEach(() => {
  vi.unstubAllEnvs();
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

  it("一致すれば 200・署名付き household cookie を発行", async () => {
    findUnique.mockResolvedValue({ id: "夫婦の合言葉", name: "我が家" });
    const res = await POST(jsonReq(URL, { passphrase: "夫婦の合言葉" }));
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true, householdName: "我が家" });
    const cookie = res.cookies.get("household");
    // 署名付き（素の値ではない）。検証すると元の世帯コードに戻る（SEC-3）。
    expect(cookie?.value).not.toBe(encodeURIComponent("夫婦の合言葉"));
    expect(verifySession(decodeURIComponent(cookie!.value))).toBe("夫婦の合言葉");
  });

  it("SEC-1: 同一 IP の試行が上限を超えると 429（Retry-After 付き）", async () => {
    findUnique.mockResolvedValue(null);
    // 上限 10 回までは通過（中身は 401 でもレートは消費される）
    for (let i = 0; i < 10; i++) {
      const ok = await POST(jsonReq(URL, { passphrase: "x" }));
      expect(ok.status).toBe(401);
    }
    // 11 回目はレート制限で 429。DB 照合まで到達しない
    findUnique.mockClear();
    const res = await POST(jsonReq(URL, { passphrase: "x" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("SEC-2: 本番では既定コード demo-household を 401 で拒否（DB 照合しない）", async () => {
    vi.stubEnv("NODE_ENV", "production");
    const res = await POST(jsonReq(URL, { passphrase: "demo-household" }));
    expect(res.status).toBe(401);
    expect(findUnique).not.toHaveBeenCalled();
  });

  it("SEC-2: 本番以外なら demo-household も通常照合する", async () => {
    findUnique.mockResolvedValue({ id: "demo-household", name: "ワレワレ" });
    const res = await POST(jsonReq(URL, { passphrase: "demo-household" }));
    expect(res.status).toBe(200);
    expect(findUnique).toHaveBeenCalled();
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
