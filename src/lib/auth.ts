import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// 「世帯コード」= household.id 方式。世帯コードを知っていること自体が認可。
// 保存時に /api/session が household.id をこの cookie に保存し、
// 各 API は cookie から世帯を特定する。cookie 無し＝未保存＝データを返さない。
export const HOUSEHOLD_COOKIE = "household";

// getDemoUserId が引くデモユーザーの email。seed が作成するユーザーと一致させる。
const DEMO_USER_EMAIL = "demo@example.com";

// 保存 cookie から household id を取り出す。未保存なら null。
// ※ Server Component / Route Handler / Server Action からのみ呼べる。
export async function getHouseholdId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(HOUSEHOLD_COOKIE)?.value;
  return raw ? decodeURIComponent(raw) : null;
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
