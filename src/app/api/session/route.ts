import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { HOUSEHOLD_COOKIE, getHouseholdId } from "@/lib/auth";

// 合言葉 = household.id。署名なし（合言葉を知っていること自体が認可）。
// 解錠は端末で保持したいので長期 cookie（ブラウザ上限に合わせ 400 日）。
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

// 現在の解錠状態（クライアントのロック表示用）
export async function GET() {
  const id = await getHouseholdId();
  if (!id) return NextResponse.json({ unlocked: false });
  const household = await prisma.household.findUnique({
    where: { id },
    select: { name: true },
  });
  if (!household) {
    // cookie はあるが世帯が無い（合言葉変更・再seed 後など）→ 無効 cookie を破棄
    const res = NextResponse.json({ unlocked: false });
    res.cookies.set(HOUSEHOLD_COOKIE, "", cookieOptions(0));
    return res;
  }
  return NextResponse.json({ unlocked: true, householdName: household.name });
}

// 解錠: 合言葉（= household.id）を照合し、一致すれば cookie を発行
export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => null);
  const passphrase =
    body && typeof body.passphrase === "string" ? body.passphrase.trim() : "";
  if (!passphrase) {
    return NextResponse.json({ ok: false, error: "empty" }, { status: 400 });
  }

  const household = await prisma.household.findUnique({
    where: { id: passphrase },
    select: { id: true, name: true },
  });
  if (!household) {
    return NextResponse.json({ ok: false, error: "invalid" }, { status: 401 });
  }

  const res = NextResponse.json({ ok: true, householdName: household.name });
  res.cookies.set(
    HOUSEHOLD_COOKIE,
    encodeURIComponent(household.id),
    cookieOptions(COOKIE_MAX_AGE)
  );
  return res;
}

// ロック: cookie を破棄
export async function DELETE() {
  const res = NextResponse.json({ ok: true });
  res.cookies.set(HOUSEHOLD_COOKIE, "", cookieOptions(0));
  return res;
}
