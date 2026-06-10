import { describe, it, expect, vi, beforeEach } from "vitest";
import { jsonReq } from "@/test/route-helpers";

const { getHouseholdId, getDemoUserId, getEnteredBy } = vi.hoisted(() => ({
  getHouseholdId: vi.fn(),
  getDemoUserId: vi.fn(),
  getEnteredBy: vi.fn(),
}));
vi.mock("@/lib/auth", () => ({ getHouseholdId, getDemoUserId, getEnteredBy }));

// validateExpenseInput は実関数のまま使い、その中の category 照合だけ prisma をモック。
const { findFirst, create, $transaction } = vi.hoisted(() => ({
  findFirst: vi.fn(),
  create: vi.fn(),
  $transaction: vi.fn(),
}));
vi.mock("@/lib/prisma", () => ({
  prisma: { category: { findFirst }, expense: { create }, $transaction },
}));

import { POST } from "./route";

const URL = "http://localhost/api/expenses/batch";
const validRow = { amount: 1280, spentAt: "2026-05-03", categoryId: "cat-1" };

beforeEach(() => {
  getHouseholdId.mockReset().mockResolvedValue("hh-1");
  getDemoUserId.mockReset().mockResolvedValue("u-1");
  getEnteredBy.mockReset().mockResolvedValue(1); // 入力者は設定済みが既定
  findFirst.mockReset().mockResolvedValue({ id: "cat-1" }); // 自世帯にカテゴリ存在
  create.mockReset().mockImplementation((args) => args); // $transaction に渡る配列要素
  $transaction.mockReset().mockResolvedValue([]);
});

describe("POST /api/expenses/batch", () => {
  it("未保存は 401（何も作らない）", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, { rows: [validRow] }));
    expect(res.status).toBe(401);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("入力者が未設定（cookie 無し）は 400・何も作らない", async () => {
    getEnteredBy.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, { rows: [validRow] }));
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "enteredByRequired" });
    expect($transaction).not.toHaveBeenCalled();
  });

  it("rows が空配列なら 400", async () => {
    const res = await POST(jsonReq(URL, { rows: [] }));
    expect(res.status).toBe(400);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("rows が配列でなければ 400", async () => {
    const res = await POST(jsonReq(URL, { rows: "x" }));
    expect(res.status).toBe(400);
  });

  it("500件超は 400（暴発防止）", async () => {
    const rows = Array.from({ length: 501 }, () => validRow);
    const res = await POST(jsonReq(URL, { rows }));
    expect(res.status).toBe(400);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("1行でもバリデーション失敗なら全件作らず 400 + errors[index]", async () => {
    const rows = [validRow, { amount: -1, spentAt: "2026-05-03", categoryId: "cat-1" }];
    const res = await POST(jsonReq(URL, { rows }));
    expect(res.status).toBe(400);
    const body = await res.json();
    expect(body.created).toBe(0);
    expect(body.errors[0].index).toBe(1);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("他世帯/存在しない categoryId は 400（IDOR防止）", async () => {
    findFirst.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, { rows: [validRow] }));
    expect(res.status).toBe(400);
    expect($transaction).not.toHaveBeenCalled();
  });

  it("全行有効なら 201・1トランザクションで自世帯/デモユーザー/入力者作成", async () => {
    getEnteredBy.mockResolvedValue(2);
    const rows = [validRow, { ...validRow, amount: 800, storeName: "コンビニ" }];
    const res = await POST(jsonReq(URL, { rows }));
    expect(res.status).toBe(201);
    const body = await res.json();
    expect(body.created).toBe(2);
    expect(body.errors).toEqual([]);
    expect($transaction).toHaveBeenCalledTimes(1);
    expect(create).toHaveBeenCalledTimes(2);
    const data = create.mock.calls[0][0].data;
    expect(data.householdId).toBe("hh-1");
    expect(data.createdByUserId).toBe("u-1");
    expect(data.enteredBy).toBe(2);
    expect(data.categoryId).toBe("cat-1");
  });
});
