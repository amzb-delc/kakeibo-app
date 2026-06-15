import Anthropic from "@anthropic-ai/sdk";

// レシート画像から支出項目を構造化抽出する（Claude ビジョン）。
// 画像保存はしない方針なので、抽出に使った画像は呼び出し側で破棄する。

// コスト優先で Haiku を既定にする（レシート抽出は短く単純なタスクなので十分実用的）。
// env で切替可（日本語レシートの精度をさらに上げたい場合は "claude-opus-4-8" など）。
const OCR_MODEL = process.env.OCR_MODEL ?? "claude-haiku-4-5";

export const OCR_ALLOWED_MEDIA_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
] as const;
export type OcrMediaType = (typeof OCR_ALLOWED_MEDIA_TYPES)[number];

export type ReceiptExtraction = {
  amount: number | null; // 税込合計（円・整数）
  storeName: string | null;
  spentAt: string | null; // YYYY-MM-DD
  categoryName: string | null; // 渡したカテゴリ名のいずれか、または null
};

// 構造化出力スキーマ。null 許容のため type 配列を使い、全項目を required にする
// （structured outputs は additionalProperties:false と全プロパティ必須が要件）。
const RECEIPT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    amount: {
      type: ["integer", "null"],
      description: "支払合計金額（税込総額、円、整数）。読み取れなければ null",
    },
    storeName: {
      type: ["string", "null"],
      description: "店名・店舗名。読み取れなければ null",
    },
    spentAt: {
      type: ["string", "null"],
      description:
        "利用日を YYYY-MM-DD 形式で。年の記載が無ければレシート文脈から推定し、推定不能なら null",
    },
    categoryName: {
      type: ["string", "null"],
      description:
        "与えられたカテゴリ一覧の中から最も近いものを1つ、名前を完全一致で返す。該当なしは null",
    },
  },
  required: ["amount", "storeName", "spentAt", "categoryName"],
};

export async function extractReceipt(opts: {
  imageBase64: string;
  mediaType: OcrMediaType;
  categoryNames: string[];
}): Promise<ReceiptExtraction> {
  // ANTHROPIC_API_KEY は環境から自動解決される。
  const client = new Anthropic();

  const categoryList =
    opts.categoryNames.length > 0
      ? opts.categoryNames.map((n) => `  - ${n}`).join("\n")
      : "  （カテゴリ未設定）";

  const instruction = `これは日本のレシート画像です。家計簿に記録するため、次の項目を抽出してください。
- amount: 支払合計金額（税込の総額、円、整数）
- storeName: 店名・店舗名
- spentAt: 利用日を YYYY-MM-DD で
- categoryName: 次のカテゴリから最も近いものを「名前を完全一致」で1つ。該当が無ければ null
${categoryList}
読み取れない項目は無理に推測せず null にしてください。`;

  const res = await client.messages.create({
    model: OCR_MODEL,
    max_tokens: 1024,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "image",
            source: {
              type: "base64",
              media_type: opts.mediaType,
              data: opts.imageBase64,
            },
          },
          { type: "text", text: instruction },
        ],
      },
    ],
    // 構造化出力で JSON を強制（パース不要で型に一致した文字列が返る）。
    output_config: { format: { type: "json_schema", schema: RECEIPT_SCHEMA } },
  });

  if (res.stop_reason === "refusal") {
    throw new Error("画像の読み取りを拒否されました");
  }

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("レシートの読み取り結果が空でした");
  }

  const parsed = JSON.parse(textBlock.text) as ReceiptExtraction;
  return parsed;
}
