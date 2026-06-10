import { describe, it, expect, vi, beforeEach, afterEach } from "vitest";
import { jsonReq } from "@/test/route-helpers";
import { resetRateLimit } from "@/lib/rate-limit";

const { getHouseholdId } = vi.hoisted(() => ({ getHouseholdId: vi.fn() }));
vi.mock("@/lib/auth", () => ({ getHouseholdId }));

const { findMany } = vi.hoisted(() => ({ findMany: vi.fn() }));
vi.mock("@/lib/prisma", () => ({ prisma: { category: { findMany } } }));

// 抽出（SDK）は lib/ocr 側でテスト済みなのでここではモック。
const { extractReceipt } = vi.hoisted(() => ({ extractReceipt: vi.fn() }));
vi.mock("@/lib/ocr", () => ({
  extractReceipt,
  OCR_ALLOWED_MEDIA_TYPES: ["image/jpeg", "image/png", "image/webp"],
}));

import { POST } from "./route";

const URL = "http://localhost/api/ocr";
const CATEGORIES = [{ id: "cat-1", name: "食費" }];
const validBody = { imageBase64: "abc", mediaType: "image/jpeg" };

let savedKey: string | undefined;

beforeEach(() => {
  savedKey = process.env.ANTHROPIC_API_KEY;
  process.env.ANTHROPIC_API_KEY = "test-key";
  getHouseholdId.mockReset().mockResolvedValue("hh-1");
  findMany.mockReset().mockResolvedValue(CATEGORIES);
  extractReceipt.mockReset();
  resetRateLimit();
});

afterEach(() => {
  if (savedKey === undefined) delete process.env.ANTHROPIC_API_KEY;
  else process.env.ANTHROPIC_API_KEY = savedKey;
});

describe("POST /api/ocr", () => {
  it("未保存は 401（抽出しない）", async () => {
    getHouseholdId.mockResolvedValue(null);
    const res = await POST(jsonReq(URL, validBody));
    expect(res.status).toBe(401);
    expect(extractReceipt).not.toHaveBeenCalled();
  });

  it("ANTHROPIC_API_KEY 未設定は 503", async () => {
    delete process.env.ANTHROPIC_API_KEY;
    const res = await POST(jsonReq(URL, validBody));
    expect(res.status).toBe(503);
    expect(extractReceipt).not.toHaveBeenCalled();
  });

  it("正常時: categoryName を自世帯の categoryId に解決して返す", async () => {
    extractReceipt.mockResolvedValue({
      amount: 1280,
      storeName: "スーパー",
      spentAt: "2026-05-03",
      categoryName: "食費",
    });
    const res = await POST(jsonReq(URL, validBody));
    expect(res.status).toBe(200);
    const body = await res.json();
    expect(body.categoryId).toBe("cat-1");
    expect(findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ householdId: "hh-1", enabled: true }),
      })
    );
  });

  it("SEC-4: 世帯の試行が上限を超えると 429（抽出しない）", async () => {
    extractReceipt.mockResolvedValue({
      amount: 100,
      storeName: null,
      spentAt: null,
      categoryName: null,
    });
    // 上限 30 回までは 200
    for (let i = 0; i < 30; i++) {
      const ok = await POST(jsonReq(URL, validBody));
      expect(ok.status).toBe(200);
    }
    extractReceipt.mockClear();
    const res = await POST(jsonReq(URL, validBody));
    expect(res.status).toBe(429);
    expect(res.headers.get("Retry-After")).toBeTruthy();
    expect(extractReceipt).not.toHaveBeenCalled();
  });
});
