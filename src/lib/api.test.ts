import { describe, it, expect, vi, beforeEach } from "vitest";

// requireHouseholdId が依存する cookie 解決をモックする。
vi.mock("@/lib/auth", () => ({
  getHouseholdId: vi.fn(),
}));

import { getHouseholdId } from "@/lib/auth";
import {
  jsonError,
  parseJsonBody,
  requireHouseholdId,
  checkContentLength,
  requireSameOrigin,
} from "./api";

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

describe("checkContentLength", () => {
  const reqWith = (headers: Record<string, string>) =>
    new Request("http://test/api", { method: "POST", headers });

  it("Content-Length が上限超なら 413", () => {
    const res = checkContentLength(reqWith({ "content-length": "2000" }), 1000);
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(413);
  });

  it("上限以下なら null（素通し）", () => {
    expect(checkContentLength(reqWith({ "content-length": "500" }), 1000)).toBeNull();
  });

  it("ヘッダ欠落・非数値は null（後段チェックに委ねる）", () => {
    expect(checkContentLength(reqWith({}), 1000)).toBeNull();
    expect(checkContentLength(reqWith({ "content-length": "abc" }), 1000)).toBeNull();
  });
});

describe("requireSameOrigin", () => {
  const reqWith = (headers: Record<string, string>) =>
    new Request("http://localhost/api/x", { method: "POST", headers });

  it("Origin 無しは null（許可・非ブラウザクライアント）", () => {
    expect(requireSameOrigin(reqWith({}))).toBeNull();
  });

  it("同一オリジンは null（許可）", () => {
    expect(requireSameOrigin(reqWith({ origin: "http://localhost" }))).toBeNull();
  });

  it("クロスオリジンは 403", () => {
    const res = requireSameOrigin(reqWith({ origin: "http://evil.example" }));
    expect(res).toBeInstanceOf(Response);
    expect((res as Response).status).toBe(403);
  });

  it("不正な Origin は 403", () => {
    const res = requireSameOrigin(reqWith({ origin: "not-a-url" }));
    expect((res as Response).status).toBe(403);
  });

  // dev では req.url のホストがバインド先(localhost)に固定され Host に追従しないため、
  // 宛先判定は Host ヘッダを正とする（LAN IP・実機アクセスの誤 403 防止）。
  it("Host ヘッダ一致なら req.url のホストと違っても null（LAN/実機アクセス）", () => {
    const res = requireSameOrigin(
      reqWith({ origin: "http://192.168.1.12:3000", host: "192.168.1.12:3000" })
    );
    expect(res).toBeNull();
  });

  it("Host ヘッダ不一致は 403", () => {
    const res = requireSameOrigin(
      reqWith({ origin: "http://localhost", host: "192.168.1.12:3000" })
    );
    expect((res as Response).status).toBe(403);
  });

  it("Host も x-forwarded-host も無ければ req.url のホストにフォールバック", () => {
    // reqWith は Host ヘッダを明示しない限り付けないため、req.url(localhost) との比較になる
    expect(requireSameOrigin(reqWith({ origin: "http://localhost" }))).toBeNull();
    const res = requireSameOrigin(reqWith({ origin: "http://192.168.1.12:3000" }));
    expect((res as Response).status).toBe(403);
  });

  it("x-forwarded-host があれば Host より優先（プロキシ配下）", () => {
    const res = requireSameOrigin(
      reqWith({
        origin: "https://kakeibo.example.com",
        host: "internal:3000",
        "x-forwarded-host": "kakeibo.example.com",
      })
    );
    expect(res).toBeNull();
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
