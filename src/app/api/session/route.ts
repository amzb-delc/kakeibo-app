import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import {
  HOUSEHOLD_COOKIE,
  ENTERED_BY_COOKIE,
  getHouseholdId,
  getEnteredBy,
} from "@/lib/auth";
import { jsonError, parseJsonBody } from "@/lib/api";
import type { SessionStatus, SessionUnlockResult } from "@/types/api";

// 世帯コード = household.id。署名なし（世帯コードを知っていること自体が認可）。
// 保存は端末で保持したいので長期 cookie（ブラウザ上限に合わせ 400 日）。
const COOKIE_MAX_AGE = 60 * 60 * 24 * 400;

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
export async function GET() {
  const enteredBy = await getEnteredBy();
  const id = await getHouseholdId();
  if (!id)
    return NextResponse.json({ unlocked: false, enteredBy } satisfies SessionStatus);
  const household = await prisma.household.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!household) {
    // cookie はあるが世帯が無い（世帯コード変更・再seed 後など）→ 無効 cookie を破棄
    const res = NextResponse.json({
      unlocked: false,
      enteredBy,
    } satisfies SessionStatus);
    res.cookies.set(HOUSEHOLD_COOKIE, "", cookieOptions(0));
    return res;
  }
  return NextResponse.json({
    unlocked: true,
    householdName: household.name,
    enteredBy,
  } satisfies SessionStatus);
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
  const body = await parseJsonBody(req);
  if (body instanceof NextResponse) return body;

  const passphrase =
    typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  if (!passphrase) return jsonError("empty", 400);

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
