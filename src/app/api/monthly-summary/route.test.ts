import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReq } from "@/test/route-helpers";

// 認可（cookie→householdId）と prisma をモックする。
const { getHouseholdId } = vi.hoisted(() => ({ getHouseholdId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getHouseholdId }));

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { expense: { findMany } } }));

import { GET } from "./route";

beforeEach(() => {
  getHouseholdId.mockReset();
  findMany.mockReset();
  findMany.mockResolvedValue([]); // 支出は空（buildMonthlySummary は実関数）
});

describe("GET /api/monthly-summary", () => {
  it("未保存(cookie無し)は 401 でデータを返さない", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await GET(getReq("http://localhost/api/monthly-summary?year=2026&month=6"));
    expect(res.status).toBe(401);
    expect(findMany).not.toHaveBeenCalled();
  });

  it("保存済みなら 200・query の年月で集計し、全クエリが世帯スコープ", async () => {
    getHouseholdId.mockResolvedValue("hh-1");
    const res = await GET(getReq("http://localhost/api/monthly-summary?year=2026&month=6"));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.year).toBe(2026);
    expect(body.month).toBe(6);
    expect(Array.isArray(body.categories)).toBe(true);
    // IDOR 防止: 取得は必ず自世帯スコープ
    expect(findMany).toHaveBeenCalled();
    for (const call of findMany.mock.calls) {
      expect(call[0].where.householdId).toBe("hh-1");
    }
  });

  it("SEC-8: 不正な year/month は 400（DB 照合しない）", async () => {
    getHouseholdId.mockResolvedValue("hh-1");
    for (const q of ["year=abc&month=6", "year=2026&month=13", "year=2026&month=0"]) {
      const res = await GET(getReq(`http://localhost/api/monthly-summary?${q}`));
      expect(res.status).toBe(400);
    }
    expect(findMany).not.toHaveBeenCalled();
  });

  it("有効な tag 指定で 3つの findMany すべての where に tags フィルタを適用", async () => {
    getHouseholdId.mockResolvedValue("hh-1");
    // 過去月を見ることで比較クエリも走る（findMany が3回）
    const res = await GET(
      getReq("http://localhost/api/monthly-summary?year=2025&month=1&tag=spouse:1")
    );
    expect(res.status).toBe(200);
    expect(findMany).toHaveBeenCalledTimes(3);
    for (const call of findMany.mock.calls) {
      expect(call[0].where.tags).toEqual({ has: "spouse:1" });
    }
  });

  it("不正な tag は 400（DB 照合しない）", async () => {
    getHouseholdId.mockResolvedValue("hh-1");
    const res = await GET(
      getReq("http://localhost/api/monthly-summary?year=2026&month=6&tag=bogus")
    );
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.error).toBe("invalid tag");
    expect(findMany).not.toHaveBeenCalled();
  });

  it("tag 未指定なら where に tags フィルタを含めない", async () => {
    getHouseholdId.mockResolvedValue("hh-1");
    const res = await GET(getReq("http://localhost/api/monthly-summary?year=2026&month=6"));
    expect(res.status).toBe(200);
    for (const call of findMany.mock.calls) {
      expect(call[0].where.tags).toBeUndefined();
    }
  });
});
