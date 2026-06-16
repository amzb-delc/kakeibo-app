import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  extractReceipt,
  OCR_ALLOWED_MEDIA_TYPES,
  type OcrMediaType,
} from "@/lib/ocr";
import {
  requireHouseholdId,
  parseJsonBody,
  jsonError,
  checkContentLength,
  requireSameOrigin,
} from "@/lib/api";
import { rateLimit } from "@/lib/rate-limit";
import type { OcrResult } from "@/types/api";

// 画像はクライアントで縮小済み前提。base64 文字列の上限（おおよそ 7MB ぶん）。
const MAX_BASE64_LENGTH = 7 * 1024 * 1024;
// JSON ボディ全体の上限（base64 + 包み）。Content-Length 事前チェック用（SEC-4）。
const MAX_BODY_BYTES = 8 * 1024 * 1024;
// 世帯単位のコスト/DoS 上限。連写しても 60 秒 30 回まで（SEC-4）。
const OCR_RATE_LIMIT = { limit: 30, windowMs: 60 * 1000 };

// Claude への OCR 問い合わせで処理が数十秒かかり得るため、Vercel 関数の既定タイムアウトを延長
export const maxDuration = 60;

export async function POST(req: NextRequest) {
  const csrf = requireSameOrigin(req); // SEC-6
  if (csrf) return csrf;

  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  // SEC-4: 世帯単位でレート制限（API コスト爆発の抑止）
  const limit = rateLimit(`ocr:${householdId}`, OCR_RATE_LIMIT);
  if (!limit.ok) {
    const res = jsonError("混み合っています。少し待って再試行してください", 429);
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("レシート読み取りは未設定です（ANTHROPIC_API_KEY）", 503);
  }

  // SEC-4: 巨大ボディを parse 前に弾く
  const tooLarge = checkContentLength(req, MAX_BODY_BYTES);
  if (tooLarge) return tooLarge;

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { imageBase64, mediaType } = body as {
    imageBase64?: unknown;
    mediaType?: unknown;
  };

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return jsonError("画像がありません", 400);
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return jsonError("画像が大きすぎます", 413);
  }
  if (
    typeof mediaType !== "string" ||
    !OCR_ALLOWED_MEDIA_TYPES.includes(mediaType as OcrMediaType)
  ) {
    return jsonError("対応していない画像形式です", 400);
  }

  // 自世帯の有効カテゴリ名を渡し、抽出結果を id にマッチさせる。
  const categories = await prisma.category.findMany({
    where: { householdId, enabled: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  try {
    const extracted = await extractReceipt({
      imageBase64,
      mediaType: mediaType as OcrMediaType,
      categoryNames: categories.map((c) => c.name),
    });

    const matched = extracted.categoryName
      ? categories.find((c) => c.name === extracted.categoryName)
      : undefined;

    return NextResponse.json({
      amount: extracted.amount,
      storeName: extracted.storeName,
      spentAt: extracted.spentAt,
      categoryId: matched?.id ?? null,
    } satisfies OcrResult);
  } catch (e) {
    console.error("OCR extraction failed", e);
    const status = (e as { status?: number })?.status;
    const message = (e as { message?: string })?.message ?? "";
    if (status === 401) {
      return jsonError("APIキーが無効です。設定を確認してください", 502);
    }
    if (status === 400 && /credit balance|billing/i.test(message)) {
      return jsonError(
        "AIの利用枠（クレジット残高）が不足しています。Anthropic の Plans & Billing を確認してください",
        502
      );
    }
    if (status === 429) {
      return jsonError("混み合っています。少し待って再試行してください", 502);
    }
    return jsonError("レシートの読み取りに失敗しました", 502);
  }
}
