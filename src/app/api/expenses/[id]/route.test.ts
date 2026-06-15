import { describe, it, expect, vi, beforeEach } from "vitest";
import { getReq, jsonReq } from "@/test/route-helpers";

// requireHouseholdId / requireSameOrigin は @/lib/api の実関数のまま使い、
// その内部が参照する getHouseholdId（@/lib/auth）だけモックする。
const { getHouseholdId } = vi.hoisted(() => ({ getHouseholdId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getHouseholdId }));

// validateExpenseInput は実関数のまま。category 照合と expense 操作だけ prisma をモック。
const { categoryFindFirst, findFirst, updateMany, deleteMany } = vi.hoisted(
  () => ({
    categoryFindFirst: vi.fn(),
    findFirst: vi.fn(),
    updateMany: vi.fn(),
    deleteMany: vi.fn(),
  })
);
vi.mock("@/lib/prisma", () => ({
  prisma: {
    category: { findFirst: categoryFindFirst },
    expense: { findFirst, updateMany, deleteMany },
  },
}));

import { GET, PATCH, DELETE } from "./route";

const URL = "http://localhost/api/expenses/e1";
const params = { params: Promise.resolve({ id: "e1" }) };
const row = {
  id: "e1",
  amount: 1280,
  category: { id: "cat-1", name: "食費" },
};

beforeEach(() => {
  getHouseholdId.mockReset().mockResolvedValue("hh-1");
  categoryFindFirst.mockReset().mockResolvedValue({ id: "cat-1" });
  findFirst.mockReset();
  updateMany.mockReset();
  deleteMany.mockReset();
});

describe("GET /api/expenses/[id]", () => {
  it("未保存は 401", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await GET(getReq(URL), params);
    expect(res.status).toBe(401);
    expect(findFirst).not.toHaveBeenCalled();
  });

  it("他世帯/存在しない id は 404", async () => {
    findFirst.mockResolvedValue(null);
    const res = await GET(getReq(URL), params);
    expect(res.status).toBe(404);
    // 自世帯スコープで照合している
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "e1", householdId: "hh-1" }),
      })
    );
  });

  it("正常時は 200 で当該レコードを返す", async () => {
    findFirst.mockResolvedValue(row);
    const res = await GET(getReq(URL), params);
    expect(res.status).toBe(200);
    expect((await res.json()).id).toBe("e1");
  });
});

describe("PATCH /api/expenses/[id]", () => {
  it("未保存は 401（更新しない）", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await PATCH(jsonReq(URL, { amount: 2000 }, "PATCH"), params);
    expect(res.status).toBe(401);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("バリデーション不正は 400（更新しない）", async () => {
    const res = await PATCH(jsonReq(URL, { amount: -5 }, "PATCH"), params);
    expect(res.status).toBe(400);
    expect(updateMany).not.toHaveBeenCalled();
  });

  it("対象なし（他世帯/存在しない）は 404", async () => {
    updateMany.mockResolvedValue({ count: 0 });
    const res = await PATCH(jsonReq(URL, { amount: 2000 }, "PATCH"), params);
    expect(res.status).toBe(404);
    expect(findFirst).not.toHaveBeenCalled();
    // 世帯スコープを where に含めて更新している
    expect(updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "e1", householdId: "hh-1" }),
      })
    );
  });

  it("更新成功後に並行削除で消えていたら 404（null 返却防御）", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue(null); // 再取得時には消えている
    const res = await PATCH(jsonReq(URL, { amount: 2000 }, "PATCH"), params);
    expect(res.status).toBe(404);
  });

  it("正常時は 200 で更新後レコードを返す", async () => {
    updateMany.mockResolvedValue({ count: 1 });
    findFirst.mockResolvedValue({ ...row, amount: 2000 });
    const res = await PATCH(jsonReq(URL, { amount: 2000 }, "PATCH"), params);
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.id).toBe("e1");
    expect(body.amount).toBe(2000);
    // 再取得も自世帯スコープ
    expect(findFirst).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "e1", householdId: "hh-1" }),
      })
    );
  });
});

describe("DELETE /api/expenses/[id]", () => {
  it("未保存は 401（削除しない）", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await DELETE(jsonReq(URL, {}, "DELETE"), params);
    expect(res.status).toBe(401);
    expect(deleteMany).not.toHaveBeenCalled();
  });

  it("対象なしは 404", async () => {
    deleteMany.mockResolvedValue({ count: 0 });
    const res = await DELETE(jsonReq(URL, {}, "DELETE"), params);
    expect(res.status).toBe(404);
    expect(deleteMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: "e1", householdId: "hh-1" }),
      })
    );
  });

  it("正常時は 200・{ ok: true }", async () => {
    deleteMany.mockResolvedValue({ count: 1 });
    const res = await DELETE(jsonReq(URL, {}, "DELETE"), params);
    expect(res.status).toBe(200);
    expect(await res.json()).toEqual({ ok: true });
  });
});
