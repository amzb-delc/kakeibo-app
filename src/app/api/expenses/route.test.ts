import { describe, it, expect, vi, beforeEach } from "vitest";
import { jsonReq } from "@/test/route-helpers";

const { getHouseholdId, getEnteredBy } = vi.hoisted(() => ({
  getHouseholdId: vi.fn(),
  getEnteredBy: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getHouseholdId, getEnteredBy }));

// validateExpenseInput は実関数のまま使い、その中の category 照合だけ prisma をモック。
const { findFirst, create } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { category: { findFirst }, expense: { create } },
}));

import { POST } from "./route";

const URL = "http://localhost/api/expenses";
const valid = { amount: 1280, spentAt: "2026-06-08", categoryId: "cat-1" };

beforeEach(() => {
  getHouseholdId.mockReset().mockResolvedValue("hh-1");
  getEnteredBy.mockReset().mockResolvedValue(1); // 入力者は設定済みが既定
  findFirst.mockReset().mockResolvedValue({ id: "cat-1" }); // 自世帯にカテゴリ存在
  create.mockReset();
});

describe("POST /api/expenses", () => {
  it("未保存は 401（保存しない）", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, valid));
    expect(res.status).toBe(401);
    expect(create).not.toHaveBeenCalled();
  });

  it("amount 欠落は 400", async () => {
    const res = await POST(jsonReq(URL, { spentAt: "2026-06-08", categoryId: "cat-1" }));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("他世帯/存在しない categoryId は 400（IDOR防止）", async () => {
    findFirst.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, valid));
    expect(res.status).toBe(400);
    expect(create).not.toHaveBeenCalled();
  });

  it("正常時は 201・自世帯/入力者タグで作成（createdByUserId は付与しない）", async () => {
    getEnteredBy.mockResolvedValue(2);
    create.mockResolvedValue({ id: "e1", ...valid, category: { id: "cat-1", name: "食費" } });
    const res = await POST(jsonReq(URL, valid));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.id).toBe("e1");
    const data = create.mock.calls[0][0].data;
    expect(data.householdId).toBe("hh-1");
    expect(data).not.toHaveProperty("createdByUserId");
    expect(data.tags).toEqual(["spouse:2"]);
    expect(data.categoryId).toBe("cat-1");
    // category 照合は自世帯スコープで行う
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh-1" }),
      })
    );
  });

  it("入力者 cookie 未設定なら tags は空配列で作成", async () => {
    getEnteredBy.mockResolvedValue(null);
    create.mockResolvedValue({ id: "e2", ...valid, category: { id: "cat-1", name: "食費" } });
    const res = await POST(jsonReq(URL, valid));
    expect(res.status).toBe(201);
    expect(create.mock.calls[0][0].data.tags).toEqual([]);
  });
});
