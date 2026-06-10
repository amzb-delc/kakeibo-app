// 軽量なインメモリ・レートリミッタ（固定ウィンドウ）。
// /api/session POST のブルートフォース／世帯コード列挙を抑止する（SEC-1）。
//
// 制約: プロセス内 Map のため、サーバレス／多インスタンス構成ではインスタンス間で
// カウントを共有しない（部分的な緩和）。MVP の軽量対策として許容する。恒久的に
// 効かせたい場合は共有ストア（Redis 等）へ差し替える。

type Bucket = { count: number; resetAt: number };

const buckets = new Map<string, Bucket>();

// メモリ肥大の安全弁。これを超えたら期限切れエントリを掃除する。
const MAX_TRACKED = 10_000;

function sweepExpired(now: number) {
  for (const [key, bucket] of buckets) {
    if (now >= bucket.resetAt) buckets.delete(key);
  }
}

export type RateLimitResult = { ok: boolean; retryAfterSec: number };

// key 単位で windowMs あたり limit 回まで許可する。超過時は ok:false と
// 残り秒数（Retry-After 用）を返す。now はテスト用に注入可能。
export function rateLimit(
  key: string,
  opts: { limit: number; windowMs: number },
  now: number = Date.now()
): RateLimitResult {
  const bucket = buckets.get(key);

  if (!bucket || now >= bucket.resetAt) {
    if (buckets.size > MAX_TRACKED) sweepExpired(now);
    buckets.set(key, { count: 1, resetAt: now + opts.windowMs });
    return { ok: true, retryAfterSec: 0 };
  }

  if (bucket.count >= opts.limit) {
    return { ok: false, retryAfterSec: Math.ceil((bucket.resetAt - now) / 1000) };
  }

  bucket.count += 1;
  return { ok: true, retryAfterSec: 0 };
}

// テスト用: 全カウンタを初期化する。
export function resetRateLimit() {
  buckets.clear();
}

// X-Forwarded-For（先頭が元クライアント）→ X-Real-IP の順で送信元 IP を推定する。
// 取れない場合は "unknown"（同一バケットに集約され、結果として全体上限として働く）。
export function getClientIp(req: Request): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first;
  }
  return req.headers.get("x-real-ip")?.trim() || "unknown";
}
