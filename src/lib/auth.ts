import { cookies } from "next/headers";
import { prisma } from "@/lib/prisma";

// 「合言葉」= household.id 方式。合言葉を知っていること自体が認可。
// 解錠時に /api/session が household.id をこの cookie に保存し、
// 各 API は cookie から世帯を特定する。cookie 無し＝未解錠＝データを返さない。
export const HOUSEHOLD_COOKIE = "household";

// seed / 一度きりの re-key スクリプトの既定世帯ID。アプリ実行時の参照には使わない。
export const DEMO_HOUSEHOLD_ID = "demo-household";
export const DEMO_USER_EMAIL = "demo@example.com";

// 解錠 cookie から household id を取り出す。未解錠なら null。
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
