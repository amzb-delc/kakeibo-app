import { prisma } from "@/lib/prisma";

// TODO: 認証実装後はセッションから取得する。
// MVPの全リクエストはこの定数経由でデモ世帯にスコープ。
export const DEMO_HOUSEHOLD_ID = "demo-household";
export const DEMO_USER_EMAIL = "demo@example.com";

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
