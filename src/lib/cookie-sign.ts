import { createHmac, timingSafeEqual } from "node:crypto";

// household cookie の HMAC 署名（SEC-3）。
// cookie は「世帯コードを知っていること自体が認可」という設計の bearer になるため、
// 署名なしだと "世帯コードを推測 → cookie を自作 → データAPI 直叩き" でレート制限
// （SEC-1, /api/session のみ）を回避できてしまう。サーバ秘密で署名することで、
// cookie の発行を /api/session に強制し、自作 cookie を弾く。
//
// 形式: `${value}.${base64url(HMAC-SHA256(value))}`。value 自体は世帯コードで
// "." を含み得るため、検証時は最後の "." で分割する（base64url は "." を含まない）。

const DEV_FALLBACK_SECRET = "dev-insecure-secret-do-not-use-in-production";

function getSecret(): string {
  const secret = process.env.SESSION_SECRET;
  if (secret) return secret;
  if (process.env.NODE_ENV === "production") {
    throw new Error("SESSION_SECRET is required in production");
  }
  // dev / test では固定フォールバックで動かす（本番は上で必須化）。
  return DEV_FALLBACK_SECRET;
}

function hmac(value: string): string {
  return createHmac("sha256", getSecret()).update(value).digest("base64url");
}

// 値に署名を付与する。
export function signSession(value: string): string {
  return `${value}.${hmac(value)}`;
}

// 署名を検証し、改竄が無ければ元の値を返す。不正・未署名なら null。
export function verifySession(signed: string): string | null {
  const idx = signed.lastIndexOf(".");
  if (idx <= 0) return null;
  const value = signed.slice(0, idx);
  const sig = signed.slice(idx + 1);

  const expected = hmac(value);
  const a = Buffer.from(sig);
  const b = Buffer.from(expected);
  // 長さが違うと timingSafeEqual が throw するため先に弾く。
  if (a.length !== b.length) return null;
  if (!timingSafeEqual(a, b)) return null;

  return value;
}
