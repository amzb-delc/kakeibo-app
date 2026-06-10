import { describe, it, expect, beforeEach } from "vitest";
import { rateLimit, resetRateLimit, getClientIp } from "./rate-limit";

const OPTS = { limit: 3, windowMs: 1000 };

beforeEach(() => resetRateLimit());

describe("rateLimit", () => {
  it("上限までは ok、超過で ok:false + 残り秒数を返す", () => {
    expect(rateLimit("a", OPTS, 0).ok).toBe(true); // 1
    expect(rateLimit("a", OPTS, 100).ok).toBe(true); // 2
    expect(rateLimit("a", OPTS, 200).ok).toBe(true); // 3
    const blocked = rateLimit("a", OPTS, 300); // 4 → 超過
    expect(blocked.ok).toBe(false);
    expect(blocked.retryAfterSec).toBe(1); // resetAt=1000, now=300 → ceil(0.7)=1
  });

  it("ウィンドウ経過でカウンタがリセットされる", () => {
    rateLimit("a", OPTS, 0);
    rateLimit("a", OPTS, 0);
    rateLimit("a", OPTS, 0);
    expect(rateLimit("a", OPTS, 0).ok).toBe(false); // 上限到達
    expect(rateLimit("a", OPTS, 1000).ok).toBe(true); // 次ウィンドウで復活
  });

  it("key（IP）ごとに独立して数える", () => {
    rateLimit("a", OPTS, 0);
    rateLimit("a", OPTS, 0);
    rateLimit("a", OPTS, 0);
    expect(rateLimit("a", OPTS, 0).ok).toBe(false);
    expect(rateLimit("b", OPTS, 0).ok).toBe(true); // 別 key は影響なし
  });

  it("resetRateLimit で全カウンタが消える", () => {
    rateLimit("a", OPTS, 0);
    rateLimit("a", OPTS, 0);
    rateLimit("a", OPTS, 0);
    expect(rateLimit("a", OPTS, 0).ok).toBe(false);
    resetRateLimit();
    expect(rateLimit("a", OPTS, 0).ok).toBe(true);
  });
});

describe("getClientIp", () => {
  const reqWith = (headers: Record<string, string>) =>
    new Request("http://localhost", { headers });

  it("X-Forwarded-For の先頭を採用する", () => {
    expect(getClientIp(reqWith({ "x-forwarded-for": "1.1.1.1, 2.2.2.2" }))).toBe(
      "1.1.1.1"
    );
  });

  it("XFF が無ければ X-Real-IP を使う", () => {
    expect(getClientIp(reqWith({ "x-real-ip": "3.3.3.3" }))).toBe("3.3.3.3");
  });

  it("どちらも無ければ unknown", () => {
    expect(getClientIp(reqWith({}))).toBe("unknown");
  });
});
