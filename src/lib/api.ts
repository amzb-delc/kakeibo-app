import { NextResponse } from "next/server";
import { getHouseholdId } from "@/lib/auth";

// データ系 API ルートの定型処理を集約する。
// 401 ガード・JSON ボディparse・エラー整形を1か所にまとめ、ルート間の重複と
// ガード漏れ（＝未保存でもデータを返してしまう事故）を防ぐ。

// 統一エラーレスポンス { error: message }。
export function jsonError(message: string, status: number) {
  return NextResponse.json({ error: message }, { status });
}

// 世帯ガード。cookie から householdId を取得し、未保存なら 401 を返す。
// 成功時は householdId(string)、失敗時は NextResponse を返すので、呼び出し側で
// `if (x instanceof NextResponse) return x;` と判定する（以降 x は string に絞られる）。
export async function requireHouseholdId(): Promise<string | NextResponse> {
  const householdId = await getHouseholdId();
  if (!householdId) return jsonError("locked", 401);
  return householdId;
}

// JSON ボディをパース。本体が無い/オブジェクトでなければ 400 を返す。
export async function parseJsonBody(
  req: Request
): Promise<Record<string, unknown> | NextResponse> {
  const body = await req.json().catch(() => null);
  if (!body || typeof body !== "object") return jsonError("invalid body", 400);
  return body as Record<string, unknown>;
}

// Content-Length が上限超のリクエストを、ボディを parse する前に弾く（SEC-4）。
// 巨大ペイロードを req.json() でフルパースする前にメモリ確保を防ぐのが目的。
// ヘッダ欠落・不正時は素通し（後段の base64 長チェックが最終防衛線）。超過なら 413。
export function checkContentLength(
  req: Request,
  maxBytes: number
): NextResponse | null {
  const len = Number(req.headers.get("content-length"));
  if (Number.isFinite(len) && len > maxBytes) {
    return jsonError("リクエストが大きすぎます", 413);
  }
  return null;
}
