import { describe, it, expect, vi, beforeEach } from "vitest";

// @anthropic-ai/sdk をモックし、messages.create の戻りを差し替える（ocr.test.ts と同手法）。
const { create } = vi.hoisted(() => ({ create: vi.fn() }));
vi.mock("@anthropic-ai/sdk", () => ({
  default: vi.fn(() => ({ messages: { create } })),
}));

import { extractStatement } from "./statement";

const ok = (extraction: Record<string, unknown>) => ({
  stop_reason: "end_turn",
  content: [{ type: "text", text: JSON.stringify(extraction) }],
});

const EXTRACTION = {
  rows: [
    { amount: 1280, spentAt: "2026-05-03", storeName: "スーパー〇〇", categoryName: "食費" },
    { amount: -500, spentAt: "2026-05-10", storeName: "返金", categoryName: null },
  ],
};

beforeEach(() => {
  create.mockReset();
});

describe("extractStatement", () => {
  it("構造化出力(text block の JSON)をパースして rows を返す", async () => {
    create.mockResolvedValue(ok(EXTRACTION));
    const r = await extractStatement({
      pdfBase64: "BASE64PDF",
      categoryNames: ["食費", "日用品"],
    });
    expect(r).toEqual(EXTRACTION);
  });

  it("リクエストに モデル/PDF(document,media_type,data)/json_schema/カテゴリ名 を含める", async () => {
    create.mockResolvedValue(ok(EXTRACTION));
    await extractStatement({
      pdfBase64: "ABC123",
      categoryNames: ["食費", "交通費"],
    });
    const arg = create.mock.calls[0][0];
    expect(arg.model).toBe("claude-sonnet-4-6");
    expect(arg.max_tokens).toBe(8192);
    const doc = arg.messages[0].content[0];
    expect(doc.type).toBe("document");
    expect(doc.source.media_type).toBe("application/pdf");
    expect(doc.source.data).toBe("ABC123");
    expect(arg.output_config.format.type).toBe("json_schema");
    const instruction = arg.messages[0].content[1].text;
    expect(instruction).toContain("食費");
    expect(instruction).toContain("交通費");
  });

  it("カテゴリ未設定なら指示文に「（カテゴリ未設定）」を出す", async () => {
    create.mockResolvedValue(ok(EXTRACTION));
    await extractStatement({ pdfBase64: "X", categoryNames: [] });
    const instruction = create.mock.calls[0][0].messages[0].content[1].text;
    expect(instruction).toContain("（カテゴリ未設定）");
  });

  it("stop_reason=refusal は拒否エラー", async () => {
    create.mockResolvedValue({ stop_reason: "refusal", content: [] });
    await expect(
      extractStatement({ pdfBase64: "X", categoryNames: [] })
    ).rejects.toThrow("拒否");
  });

  it("stop_reason=max_tokens は『長すぎて全件を読み取れません』エラー", async () => {
    create.mockResolvedValue({ stop_reason: "max_tokens", content: [] });
    await expect(
      extractStatement({ pdfBase64: "X", categoryNames: [] })
    ).rejects.toThrow("長すぎ");
  });

  it("text block が無い応答は空エラー", async () => {
    create.mockResolvedValue({
      stop_reason: "end_turn",
      content: [{ type: "tool_use" }],
    });
    await expect(
      extractStatement({ pdfBase64: "X", categoryNames: [] })
    ).rejects.toThrow("空");
  });
});
