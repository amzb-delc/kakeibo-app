import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// 「世帯コード」= household.id 方式。世帯コードを知っていること自体が認可。
// 保存時に /api/session が household.id をこの cookie に保存し、
// 各 API は cookie から世帯を特定する。cookie 無し＝未保存＝データを返さない。
export const HOUSEHOLD_COOKIE = "household";

// 入力者（夫/妻）の端末ごと設定。1=♂ / 2=♀。設定モーダルで選び、新規登録時に付与する。
export const ENTERED_BY_COOKIE = "enteredBy";

// getDemoUserId が引くデモユーザーの email。seed が作成するユーザーと一致させる。
const DEMO_USER_EMAIL = "demo@example.com";

// 保存 cookie から household id を取り出す。未保存なら null。
// ※ Server Component / Route Handler / Server Action からのみ呼べる。
export async function getHouseholdId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(HOUSEHOLD_COOKIE)?.value;
  return raw ? decodeURIComponent(raw) : null;
}

// 入力者 cookie を取り出す。未設定・不正値は null（"1"→1 / "2"→2 のみ）。
export async function getEnteredBy(): Promise<1 | 2 | null> {
  const store = await cookies();
  const raw = store.get(ENTERED_BY_COOKIE)?.value;
  return raw === "1" ? 1 : raw === "2" ? 2 : null;
}

let cachedDemoUserId: string | null = null;

export async function getDemoUserId(): Promise<string> {
  if (cachedDemoUserId) return cachedDemoUserId;
  const user = await prisma.user.findUnique({
    where: { email: DEMO_USER_EMAIL },
    select: { id: true },
  });
  if (!user) throw new Error("demo user not found");
  cachedDemoUserId = user.id;
  return user.id;
}
