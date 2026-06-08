import type { NextRequest } from "next/server";

// App Router の route ハンドラを単体テストするための最小ヘルパ。
// ルートは req.url（new URL で query を読む）か req.json() しか使わないため、
// 素の Request で十分（NextRequest にキャストして型を合わせる）。

export function getReq(url: string): NextRequest {
  return new Request(url) as unknown as NextRequest;
}

export function jsonReq(
  url: string,
  body: unknown,
  method = "POST"
): NextRequest {
  return new Request(url, {
    method,
    headers: { "content-type": "application/json" },
    body: JSON.stringify(body),
  }) as unknown as NextRequest;
}
