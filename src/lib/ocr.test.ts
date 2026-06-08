import { describe, it, expect, vi, beforeEach } from "vitest";

// @anthropic-ai/sdk をモックし、messages.create の戻りを差し替える。
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({ messages: { create } })),
}));

import { extractReceipt } from "./ocr";

const ok = (extraction: Record<string, unknown>) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify(extraction) }],
});

const EXTRACTION = {
  amount: 1280,
  storeName: "スーパー〇〇",
  spentAt: "2026-06-08",
  categoryName: "食費",
};

beforeEach(() => {
  create.mockReset();
});

describe("extractReceipt", () => {
  it("構造化出力(text block の JSON)をパースして返す", async () => {
    create.mockResolvedValue(ok(EXTRACTION));
    const r = await extractReceipt({
      imageBase64: "BASE64DATA",
      mediaType: "image/jpeg",
      categoryNames: ["食費", "日用品"],
    });
    expect(r).toEqual(EXTRACTION);
  });

  it("リクエストに モデル/画像(media_type,data)/json_schema/カテゴリ名 を含める", async () => {
    create.mockResolvedValue(ok(EXTRACTION));
    await extractReceipt({
      imageBase64: "ABC123",
      mediaType: "image/png",
      categoryNames: ["食費", "交通費"],
    });
    const arg = create.mock.calls[0][0];
    expect(arg.model).toBe("claude-haiku-4-5");
    const image = arg.messages[0].content[0];
    expect(image.type).toBe("image");
    expect(image.source.media_type).toBe("image/png");
    expect(image.source.data).toBe("ABC123");
    expect(arg.output_config.format.type).toBe("json_schema");
    const instruction = arg.messages[0].content[1].text;
    expect(instruction).toContain("食費");
    expect(instruction).toContain("交通費");
  });

  it("カテゴリ未設定なら指示文に「（カテゴリ未設定）」を出す", async () => {
    create.mockResolvedValue(ok(EXTRACTION));
    await extractReceipt({
      imageBase64: "X",
      mediaType: "image/webp",
      categoryNames: [],
    });
    const instruction = create.mock.calls[0][0].messages[0].content[1].text;
    expect(instruction).toContain("（カテゴリ未設定）");
  });

  it("stop_reason=refusal は拒否エラー", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    await expect(
      extractReceipt({ imageBase64: "X", mediaType: "image/jpeg", categoryNames: [] })
    ).rejects.toThrow("拒否");
  });

  it("text block が無い応答は空エラー", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "tool_use" }],
    });
    await expect(
      extractReceipt({ imageBase64: "X", mediaType: "image/jpeg", categoryNames: [] })
    ).rejects.toThrow("空");
  });
});
