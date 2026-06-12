---
name: review-same-origin-csrf
description: SEC-6 requireSameOrigin(src/lib/api.ts)の判定ロジックと、Host偽装でのCSRFバイパス可否の判断基準
metadata:
  type: project
---

`requireSameOrigin`（src/lib/api.ts）は状態変更API（POST/PATCH/DELETE）の多層CSRF防御。Origin ヘッダのホスト vs 宛先ホストを比較し、不一致なら403。Origin 無しは許可（非ブラウザ前提）。

SEC-6 修正で宛先ホストの取得を `new URL(req.url).host` → `x-forwarded-host || host || URL(req.url).host` に変更。

**Why:** dev サーバでは req.url のホストがバインド先(localhost)に固定され Host に追従しないため、LAN IP・実機からの正当な同一オリジン POST まで 403 になっていた。

**How to apply（レビュー時の判断基準）:**
- Host 偽装で CSRF バイパスは成立しない。攻撃者ページから fetch する場合、ブラウザは Origin を攻撃者オリジンに固定し JS から Host を書き換えられない（forbidden header）。Origin≠Host で 403。Host を偽装できるのは「ブラウザ外クライアント」だが、それは CSRF（被害者ブラウザ経由）ではない。
- x-forwarded-host を無条件採用する点は注意。直接アクセス可能なオリジンサーバだと攻撃者が任意の x-forwarded-host を付けられ、Origin も任意値にできる（ブラウザ外なら）→ 一致させて通過可能。ただしこれもブラウザ外なので CSRF にはならない。**本番が Vercel（信頼プロキシが x-forwarded-host を上書き）なら安全。リバースプロキシ無しで公開する構成に変わる場合は再評価が必要。**
- 多層防御の一層であり、cookie は SameSite=Lax + HMAC署名が本丸。requireSameOrigin はあくまで補完。
