import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jsonReq } from "@/test/route-helpers";
import { resetRateLimit } from "@/lib/rate-limit";

const { getHouseholdId } = vi.hoisted(() => ({ getHouseholdId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getHouseholdId }));

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({
  prisma: { category: { findMany } },
}));

// 抽出（SDK）と重複判定（prisma）は別レイヤでテスト済みなのでここではモック。
// StatementExtractionError は実クラスを再エクスポート（route の instanceof 判定が効くように）。
const { extractStatement } = vi.hoisted(() => ({ extractStatement: vi.fn() }));
vi.mock("@/lib/statement", async (importOriginal) => {
  const actual = (await importOriginal()) as typeof import("@/lib/statement");
  return { extractStatement, StatementExtractionError: actual.StatementExtractionError };
});

import { StatementExtractionError } from "@/lib/statement";

const { findDuplicateFlags } = vi.hoisted(() => ({ findDuplicateFlags: vi.fn() }));
vi.mock("@/lib/duplicate", () => ({ findDuplicateFlags }));

import { POST } from "./route";

const URL = "http://localhost/api/statement";
const CATEGORIES = [
  { id: "cat-1", name: "食費" },
  { id: "cat-2", name: "交通費" },
];

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  getHouseholdId.mockReset().mockResolvedValue("hh-1");
  findMany.mockReset().mockResolvedValue(CATEGORIES);
  extractStatement.mockReset();
  resetRateLimit(); // 世帯バケットを毎テスト初期化
  // 既定: 重複フラグは素通し（入力 rows をそのまま返す）。
  findDuplicateFlags.mockReset().mockImplementation((_hh, rows) => Promise.resolve(rows));
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
});

describe("POST /api/statement", () => {
  it("未保存は 401（抽出しない）", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, { pdfBase64: "X" }));
    expect(res.status).toBe(401);
    expect(extractStatement).not.toHaveBeenCalled();
  });

  it("ANTHROPIC_API_KEY 未設定は 503", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(jsonReq(URL, { pdfBase64: "X" }));
    expect(res.status).toBe(503);
    expect(extractStatement).not.toHaveBeenCalled();
  });

  it("pdfBase64 欠落は 400", async () => {
    const res = await POST(jsonReq(URL, {}));
    expect(res.status).toBe(400);
    expect(extractStatement).not.toHaveBeenCalled();
  });

  it("pdfBase64 が大きすぎると 413", async () => {
    const big = "a".repeat(6 * 1024 * 1024 + 1);
    const res = await POST(jsonReq(URL, { pdfBase64: big }));
    expect(res.status).toBe(413);
    expect(extractStatement).not.toHaveBeenCalled();
  });

  it("SEC-4: 世帯の試行が上限を超えると 429（抽出しない）", async () => {
    extractStatement.mockResolvedValue({ rows: [] });
    // 上限 10 回までは 200
    for (let i = 0; i < 10; i++) {
      const ok = await POST(jsonReq(URL, { pdfBase64: "PDF" }));
      expect(ok.status).toBe(200);
    }
    extractStatement.mockClear();
    const res = await POST(jsonReq(URL, { pdfBase64: "PDF" }));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(extractStatement).not.toHaveBeenCalled();
  });

  it("正常時: categoryName を自世帯の categoryId に解決して rows を返す", async () => {
    extractStatement.mockResolvedValue({
      rows: [
        { amount: 1280, spentAt: "2026-05-03", storeName: "スーパー", categoryName: "食費" },
        { amount: 300, spentAt: "2026-05-04", storeName: "謎の店", categoryName: "未登録" },
        { amount: 500, spentAt: "2026-05-05", storeName: "駅", categoryName: null },
      ],
    });
    const res = await POST(jsonReq(URL, { pdfBase64: "PDF" }));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.rows[0].categoryId).toBe("cat-1"); // 食費 → 解決
    expect(body.rows[1].categoryId).toBe(null); // 該当なし → null
    expect(body.rows[2].categoryId).toBe(null); // categoryName null → null
    // 有効カテゴリのみを自世帯スコープで取得する
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh-1", enabled: true }),
      })
    );
    // 抽出にはカテゴリ名一覧を渡す
    expect(extractStatement).toHaveBeenCalledWith(
      expect.objectContaining({ categoryNames: ["食費", "交通費"] })
    );
    // 重複判定を世帯スコープで通す
    expect(findDuplicateFlags).toHaveBeenCalledWith("hh-1", expect.any(Array));
  });

  it("抽出が status=429 で失敗したら 502（混雑メッセージ）", async () => {
    extractStatement.mockRejectedValue({ status: 429 });
    const res = await POST(jsonReq(URL, { pdfBase64: "PDF" }));
    expect(res.status).toBe(502);
  });

  it("SEC-9: 自前エラー（StatementExtractionError）はメッセージを 502 で透過", async () => {
    extractStatement.mockRejectedValue(
      new StatementExtractionError("明細が長すぎて全件を読み取れませんでした")
    );
    const res = await POST(jsonReq(URL, { pdfBase64: "PDF" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toContain("長すぎ");
  });

  it("SEC-9: 想定外の例外（plain Error）はメッセージを晒さず汎用文言", async () => {
    extractStatement.mockRejectedValue(new Error("connect ECONNREFUSED 10.0.0.5:5432"));
    const res = await POST(jsonReq(URL, { pdfBase64: "PDF" }));
    expect(res.status).toBe(502);
    const body = await res.json();
    expect(body.error).toBe("明細の読み取りに失敗しました");
    expect(body.error).not.toContain("ECONNREFUSED");
  });

  it("SEC-6: クロスオリジンの POST は 403（抽出しない）", async () => {
    const req = new Request(URL, {
      method: "POST",
      headers: { "content-type": "application/json", origin: "http://evil.example" },
      body: JSON.stringify({ pdfBase64: "PDF" }),
    });
    const res = await POST(req as never);
    expect(res.status).toBe(403);
    expect(extractStatement).not.toHaveBeenCalled();
  });
});
