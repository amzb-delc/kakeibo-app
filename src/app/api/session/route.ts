import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  HOUSEHOLD_COOKIE,
  ENTERED_BY_COOKIE,
  getHouseholdId,
  getEnteredBy,
} from "@/lib/auth";
import { jsonError, parseJsonBody } from "@/lib/api";
import { rateLimit, getClientIp } from "@/lib/rate-limit";
import { DEFAULT_HOUSEHOLD_ID } from "@/lib/household-defaults";
import type { SessionStatus, SessionUnlockResult } from "@/types/api";

// 世帯コード照合（保存）のブルートフォース抑止: 同一 IP から 60 秒で 10 回まで。
// 正規利用は数回で足りる一方、辞書攻撃には桁違いに足りない閾値（SEC-1）。
const UNLOCK_RATE_LIMIT = { limit: 10, windowMs: 60 * 1000 };

// 世帯コード = household.id。署名なし（世帯コードを知っていること自体が認可）。
// 保存は端末で保持したいので長期 cookie（ブラウザ上限に合わせ 400 日）。
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

// 入力者の既定値（2=♀ 妻）。妻がメイン利用のため、未設定の端末は起動時にこの値で
// cookie を発行する。夫の端末は設定モーダルで 1=♂ に切り替える。
const DEFAULT_ENTERED_BY = 2;

function cookieOptions(maxAge: number) {
  return {
    httpOnly: true,
    sameSite: "lax" as const,
    secure: process.env.NODE_ENV === "production",
    path: "/",
    maxAge,
  };
}

// 現在の保存状態（クライアントの未保存表示用）。入力者 cookie も合わせて返す。
// 入力者が未設定の端末は、起動時のこの GET で既定値（2=♀）を発行する。
export async function GET() {
  let enteredBy = await getEnteredBy();
  const needsDefault = enteredBy == null;
  if (needsDefault) enteredBy = DEFAULT_ENTERED_BY;

  const id = await getHouseholdId();
  const household = id
    ? await prisma.household.findUnique({
        where: { id },
        select: { name: true },
      })
    : null;

  const body: SessionStatus = household
    ? { unlocked: true, householdName: household.name, enteredBy }
    : { unlocked: false, enteredBy };
  const res = NextResponse.json(body);
  // cookie はあるが世帯が無い（世帯コード変更・再seed 後など）→ 無効 cookie を破棄
  if (id && !household) res.cookies.set(HOUSEHOLD_COOKIE, "", cookieOptions(0));
  // 未設定の端末に既定の入力者 cookie を発行（永続化）
  if (needsDefault)
    res.cookies.set(
      ENTERED_BY_COOKIE,
      String(DEFAULT_ENTERED_BY),
      cookieOptions(COOKIE_MAX_AGE)
    );
  return res;
}

// 入力者（夫/妻）を端末に保存。1=♂ / 2=♀ のみ受け付ける。
export async function PATCH(req: NextRequest) {
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const value = body.enteredBy;
  if (value !== 1 && value !== 2) return jsonError("invalid", 400);

  const res = NextResponse.json({ ok: true, enteredBy: value });
  res.cookies.set(
    ENTERED_BY_COOKIE,
    String(value),
    cookieOptions(COOKIE_MAX_AGE)
  );
  return res;
}

// 保存: 世帯コード（= household.id）を照合し、一致すれば cookie を発行
export async function POST(req: NextRequest) {
  // SEC-1: 同一 IP からの試行をレート制限（DB 照合の前に弾く）
  const limit = rateLimit(`session:${getClientIp(req)}`, UNLOCK_RATE_LIMIT);
  if (!limit.ok) {
    const res = jsonError("too many requests", 429);
    res.headers.set("Retry-After", String(limit.retryAfterSec));
    return res;
  }

  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const passphrase =
    typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  if (!passphrase) return jsonError("empty", 400);

  // SEC-2: 本番では既定の世帯コードでのログインを拒否（set-passphrase 実行忘れ対策）。
  // 理由は伏せて不一致と同じ 401 を返す。dev/seed のローカルログインは従来どおり可。
  if (
    process.env.NODE_ENV === "production" &&
    passphrase === DEFAULT_HOUSEHOLD_ID
  ) {
    return jsonError("invalid", 401);
  }

  const household = await prisma.household.findUnique({
    where: { id: passphrase },
    select: { id: true, name: true },
  });
  if (!household) return jsonError("invalid", 401);

  const res = NextResponse.json({
    ok: true,
    householdName: household.name,
  } satisfies SessionUnlockResult);
  res.cookies.set(
    HOUSEHOLD_COOKIE,
    encodeURIComponent(household.id),
    cookieOptions(COOKIE_MAX_AGE)
  );
  return res;
}

// クリア: 世帯コードと入力者の cookie をどちらも破棄（端末リセットを一貫させる）
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HOUSEHOLD_COOKIE, "", cookieOptions(0));
  res.cookies.set(ENTERED_BY_COOKIE, "", cookieOptions(0));
  return res;
}
