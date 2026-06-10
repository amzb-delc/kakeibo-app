import Anthropic from "@anthropic-ai/sdk";

// クレジットカード利用明細PDFから利用明細行を構造化抽出する。
// レシートOCR（lib/ocr.ts）の document(PDF) 版。PDF base64 をそのまま Claude に渡す。
// PDFは保存しない方針なので、抽出に使った base64 は呼び出し側で破棄する。

// 明細は「長い表＋多数行」で、レシートより取りこぼし・桁ずれが起きやすい。
// 既定は表抽出の精度が安定する Sonnet。env で切替可（Haiku でコスト比較したい場合など）。
const STATEMENT_MODEL = process.env.STATEMENT_MODEL ?? "claude-sonnet-4-6";

export type StatementExtractionRow = {
  amount: number | null; // 円・整数。返金/キャンセルは負
  spentAt: string | null; // YYYY-MM-DD
  storeName: string | null;
  categoryName: string | null; // 渡したカテゴリ名のいずれか、または null
};

export type StatementExtraction = {
  rows: StatementExtractionRow[];
};

// 抽出側の「ユーザーに見せてよい」自前エラー（拒否 / max_tokens / 空）。
// route 側はこれだけメッセージを透過し、想定外の例外（ネットワーク等）は
// 内部情報を晒さない汎用メッセージに丸める（SEC-9）。
export class StatementExtractionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "StatementExtractionError";
  }
}

// 構造化出力スキーマ。配列直返しより「オブジェクト直下の配列」が安定する
// （structured outputs は additionalProperties:false と全プロパティ必須が要件）。
// 配列の minItems/maxItems は非対応なので行数はプロンプト指示＋サーバ側で担保する。
const STATEMENT_SCHEMA = {
  type: "object",
  additionalProperties: false,
  properties: {
    rows: {
      type: "array",
      items: {
        type: "object",
        additionalProperties: false,
        properties: {
          amount: {
            type: ["integer", "null"],
            description:
              "利用金額（円、整数）。返金・キャンセル・マイナス計上はマイナスの整数。読み取れなければ null",
          },
          spentAt: {
            type: ["string", "null"],
            description:
              "ご利用日を YYYY-MM-DD で。年の記載が無ければ明細の対象期間から推定し、不能なら null",
          },
          storeName: {
            type: ["string", "null"],
            description: "ご利用先・加盟店名。読み取れなければ null",
          },
          categoryName: {
            type: ["string", "null"],
            description:
              "与えられたカテゴリ一覧から最も近いものを1つ、名前を完全一致で返す。該当なしは null",
          },
        },
        required: ["amount", "spentAt", "storeName", "categoryName"],
      },
    },
  },
  required: ["rows"],
};

export async function extractStatement(opts: {
  pdfBase64: string;
  categoryNames: string[];
}): Promise<StatementExtraction> {
  // ANTHROPIC_API_KEY は環境から自動解決される。
  const client = new Anthropic();

  const categoryList =
    opts.categoryNames.length > 0
      ? opts.categoryNames.map((n) => `  - ${n}`).join("\n")
      : "  （カテゴリ未設定）";

  const instruction = `これは日本のクレジットカード利用明細のPDFです。家計簿に取り込むため、すべての利用明細行を漏れなく構造化抽出してください。
各行（rows[]）は次の項目を持ちます。
- amount: 利用金額（円・整数）。返金・キャンセル・マイナス計上はマイナスの整数で
- spentAt: ご利用日を YYYY-MM-DD で（年の記載が無ければ明細の対象期間から推定）
- storeName: ご利用先・加盟店名
- categoryName: 次のカテゴリから最も近いものを「名前を完全一致」で1つ。該当が無ければ null
${categoryList}
次の行は明細に含めないでください: お支払金額合計・ご請求額・繰越残高・前回お支払額・手数料/利息・ポイント・キャッシング元金など、個別の購入ではない集計/管理行。
読み取れない項目は無理に推測せず null にしてください。`;

  const res = await client.messages.create({
    model: STATEMENT_MODEL,
    // 明細は数十〜100行。レシートの 1024 では足りないので広めに。
    max_tokens: 8192,
    messages: [
      {
        role: "user",
        content: [
          {
            type: "document",
            source: {
              type: "base64",
              media_type: "application/pdf",
              data: opts.pdfBase64,
            },
          },
          { type: "text", text: instruction },
        ],
      },
    ],
    // 構造化出力で JSON を強制（パース不要で型に一致した文字列が返る）。
    output_config: { format: { type: "json_schema", schema: STATEMENT_SCHEMA } },
  });

  if (res.stop_reason === "refusal") {
    throw new StatementExtractionError("明細の読み取りを拒否されました");
  }
  if (res.stop_reason === "max_tokens") {
    throw new StatementExtractionError(
      "明細が長すぎて全件を読み取れませんでした。ページを分けてお試しください"
    );
  }

  const textBlock = res.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new StatementExtractionError("明細の読み取り結果が空でした");
  }

  return JSON.parse(textBlock.text) as StatementExtraction;
}
