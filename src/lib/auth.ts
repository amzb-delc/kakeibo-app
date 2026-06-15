import { cookies } from "next/headers";
import { verifySession } from "@/lib/cookie-sign";

// 「世帯コード」= household.id 方式。世帯コードを知っていること自体が認可。
// 保存時に /api/session が household.id を HMAC 署名してこの cookie に保存し、
// 各 API は cookie から世帯を特定する。cookie 無し＝未保存＝データを返さない。
export const HOUSEHOLD_COOKIE = "household";

// 入力者（夫/妻）の端末ごと設定。1=♂ / 2=♀。設定モーダルで選び、新規登録時に付与する。
export const ENTERED_BY_COOKIE = "enteredBy";

// 保存 cookie から household id を取り出す。未保存・署名不正なら null。
// ※ Server Component / Route Handler / Server Action からのみ呼べる。
export async function getHouseholdId(): Promise<string | null> {
  const store = await cookies();
  const raw = store.get(HOUSEHOLD_COOKIE)?.value;
  if (!raw) return null;
  // SEC-7: 不正な %エンコーディング（例 "household=%"）は decodeURIComponent が
  // URIError を投げる → 全データ API が未捕捉 500 になるので null（未保存扱い）に倒す。
  let decoded: string;
  try {
    decoded = decodeURIComponent(raw);
  } catch {
    return null;
  }
  // 署名検証（SEC-3）。改竄・未署名の旧 cookie は null（＝未保存扱い、要再保存）。
  return verifySession(decoded);
}

// 入力者 cookie を取り出す。未設定・不正値は null（"1"→1 / "2"→2 のみ）。
export async function getEnteredBy(): Promise<1 | 2 | null> {
  const store = await cookies();
  const raw = store.get(ENTERED_BY_COOKIE)?.value;
  return raw === "1" ? 1 : raw === "2" ? 2 : null;
}
