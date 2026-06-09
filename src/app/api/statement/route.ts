import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { extractStatement } from "@/lib/statement";
import { findDuplicateFlags } from "@/lib/duplicate";
import { requireHouseholdId, parseJsonBody, jsonError } from "@/lib/api";
import type { StatementExtractResult, StatementRow } from "@/types/api";

// PDF base64 の上限（控えめ）。デプロイ環境のリクエストボディ上限に合わせて調整する。
const MAX_BASE64_LENGTH = 6 * 1024 * 1024;

export async function POST(req: NextRequest) {
  const householdId = await requireHouseholdId();
  if (householdId instanceof NextResponse) return householdId;

  if (!process.env.ANTHROPIC_API_KEY) {
    return jsonError("明細読み取りは未設定です（ANTHROPIC_API_KEY）", 503);
  }

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const { pdfBase64 } = body as { pdfBase64?: unknown };
  if (typeof pdfBase64 !== "string" || pdfBase64.length === 0) {
    return jsonError("PDFがありません", 400);
  }
  if (pdfBase64.length > MAX_BASE64_LENGTH) {
    return jsonError("PDFが大きすぎます", 413);
  }

  // 自世帯の有効カテゴリ名を渡し、抽出結果を id にマッチさせる。
  const categories = await prisma.category.findMany({
    where: { householdId, enabled: true },
    orderBy: { sortOrder: "asc" },
    select: { id: true, name: true },
  });

  try {
    const extracted = await extractStatement({
      pdfBase64,
      categoryNames: categories.map((c) => c.name),
    });

    const rows: StatementRow[] = extracted.rows.map((r) => {
      const matched = r.categoryName
        ? categories.find((c) => c.name === r.categoryName)
        : undefined;
      return {
        amount: r.amount,
        spentAt: r.spentAt,
        storeName: r.storeName,
        categoryId: matched?.id ?? null,
        duplicateLikely: false,
      };
    });

    const flagged = await findDuplicateFlags(householdId, rows);
    return NextResponse.json({ rows: flagged } satisfies StatementExtractResult);
  } catch (e) {
    console.error("statement extraction failed", e);
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
    // extractStatement の自前エラー（拒否 / max_tokens / 空）はメッセージをそのまま返す。
    if (!status && message) {
      return jsonError(message, 502);
    }
    return jsonError("明細の読み取りに失敗しました", 502);
  }
}
