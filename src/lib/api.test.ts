import { describe, it, expect, vi, beforeEach } from "vitest";

// requireHouseholdId が依存する cookie 解決をモックする。
vi.mock("@/lib/auth", () => ({
  getHouseholdId: vi.fn(),
}));

import { getHouseholdId } from "@/lib/auth";
import { jsonError, parseJsonBody, requireHouseholdId } from "./api";

const mockGetHouseholdId = vi.mocked(getHouseholdId);

describe("jsonError", () => {
  it("status と { error } を返す", async () => {
    const res = jsonError("だめ", 400);
    expect(res.status).toBe(400);
    expect(await res.json()).toEqual({ error: "だめ" });
  });
});

describe("parseJsonBody", () => {
  const makeReq = (body: string) =>
    new Request("http://test/api", {
      method: "POST",
      body,
      headers: { "content-type": "application/json" },
    });

  it("正しい JSON オブジェクトはそのまま返す", async () => {
    const result = await parseJsonBody(makeReq(JSON.stringify({ a: 1 })));
    expect(result).toEqual({ a: 1 });
  });

  it("不正な JSON は 400", async () => {
    const result = await parseJsonBody(makeReq("not json"));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });

  it("オブジェクトでない値(数値)は 400", async () => {
    const result = await parseJsonBody(makeReq("5"));
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(400);
  });
});

describe("requireHouseholdId", () => {
  beforeEach(() => mockGetHouseholdId.mockReset());

  it("世帯ありなら id 文字列を返す", async () => {
    mockGetHouseholdId.mockResolvedValue("hh-1");
    expect(await requireHouseholdId()).toBe("hh-1");
  });

  it("未保存(null)なら 401 を返す", async () => {
    mockGetHouseholdId.mockResolvedValue(null);
    const result = await requireHouseholdId();
    expect(result).toBeInstanceOf(Response);
    expect((result as Response).status).toBe(401);
  });
});
