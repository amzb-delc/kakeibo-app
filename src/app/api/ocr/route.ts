import { NextRequest, NextResponse } from "next/server";
import { getHouseholdId } from "@/lib/auth";
import { prisma } from "@/lib/prisma";
import {
  extractReceipt,
  OCR_ALLOWED_MEDIA_TYPES,
  type OcrMediaType,
} from "@/lib/ocr";

// 画像はクライアントで縮小済み前提。base64 文字列の上限（おおよそ 7MB ぶん）。
const MAX_BASE64_LENGTH = 7 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const householdId = await getHouseholdId();
  if (!householdId) {
    return NextResponse.json({ error: "locked" }, { status: 401 });
  }

  if (!process.env.ANTHROPIC_API_KEY) {
    return NextResponse.json(
      { error: "レシート読み取りは未設定です（ANTHROPIC_API_KEY）" },
      { status: 503 }
    );
  }

  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") {
    return NextResponse.json({ error: "invalid body" }, { status: 400 });
  }

  const { imageBase64, mediaType } = body as {
    imageBase64?: unknown;
    mediaType?: unknown;
  };

  if (typeof imageBase64 !== "string" || imageBase64.length === 0) {
    return NextResponse.json({ error: "画像がありません" }, { status: 400 });
  }
  if (imageBase64.length > MAX_BASE64_LENGTH) {
    return NextResponse.json({ error: "画像が大きすぎます" }, { status: 413 });
  }
  if (
    typeof mediaType !== "string" ||
    !OCR_ALLOWED_MEDIA_TYPES.includes(mediaType as OcrMediaType)
  ) {
    return NextResponse.json(
      { error: "対応していない画像形式です" },
      { status: 400 }
    );
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
    });
  } catch (e) {
    console.error("OCR extraction failed", e);
    const status = (e as { status?: number })?.status;
    const message = (e as { message?: string })?.message ?? "";
    if (status === 401) {
      return NextResponse.json(
        { error: "APIキーが無効です。設定を確認してください" },
        { status: 502 }
      );
    }
    if (status === 400 && /credit balance|billing/i.test(message)) {
      return NextResponse.json(
        {
          error:
            "AIの利用枠（クレジット残高）が不足しています。Anthropic の Plans & Billing を確認してください",
        },
        { status: 502 }
      );
    }
    if (status === 429) {
      return NextResponse.json(
        { error: "混み合っています。少し待って再試行してください" },
        { status: 502 }
      );
    }
    return NextResponse.json(
      { error: "レシートの読み取りに失敗しました" },
      { status: 502 }
    );
  }
}
