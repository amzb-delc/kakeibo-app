# リファクタ・バックログ

> 仕様変更・追加を繰り返してたまった歪みを片付けるための調査結果。
> **この採番（T5/T6… の項目）は機能PR番号とは別系統。** 過去の手元メモの `#7/#9/#12` との対応は各項目に併記。
> 初版: 2026-06-08（Tier 1〜4 消化後に再調査。lib 層は分解＋テスト済みで綺麗、歪みは UI層とスキーマ足場に集中）。

## 完了済み（Tier 1〜4 / PR #18〜#24）
- Tier 1: 型・フォーマッタ・日付ユーティリティを単一ソースへ集約 + Vitest 導入
- Tier 2: API ルート定型処理を `lib/api.ts` に共通化 / ボトムシート基盤共通化 + テスト
- Tier 3: monthly-summary 集計を純関数化 / ホームの選択解決ロジックを純関数化 + テスト
- Tier 4: 未使用 `GET /api/expenses` + `listExpenses` を撤去 / seed 定数共有 + 予約カラム明記

---

## Tier 5 — 低リスク・コードのみ・即効（マイグレ不要）
低リスクから消化する従来の流儀どおり、ここから着手するのが安全。
**2026-06-08 着手: T5-1〜T5-4・T5-6 完了（branch `refactor/tier5-quickwins`）。T5-5 は見送り。**

| ID | 内容 | 場所 | 工数 | 価値 | 状態 |
|----|------|------|------|------|------|
| T5-1 | 月送りを `shiftMonth()` に置換（自前の境界計算をやめバグ予防） | `src/app/page.tsx:124-131` | S | 中 | ✅ |
| T5-2 | `receiptImageUrl` の死んだバリデーション撤去（validate するが保存も読戻しもしない）※#12の一部だがマイグレ不要 | `src/lib/expenses.ts:92-101` | S | 中 | ✅ |
| T5-3 | `POST /api/session` を `api.ts`（`parseJsonBody`/`jsonError`）経由に揃える（エラー形が他ルートと不一致） | `src/app/api/session/route.ts:37-50` | S | 中 | ✅ |
| T5-4 | `<CategoryTag name sortOrder />` を抽出（タグ表示の重複を集約） | `expense-form.tsx:254,266` / `monthly-summary.tsx:97` | S | 中 | ✅ |
| T5-6 | `DEMO_*` 定数の整理（`DEMO_HOUSEHOLD_ID` は死んでいたので撤去、`DEMO_USER_EMAIL` は export 解除） | `src/lib/auth.ts:10-11` | S | 低 | ✅ |
| ~~T5-5~~ | ~~削除確認ダイアログを `BottomSheet` 再利用に~~ → **見送り**。確認ダイアログは BottomSheet と形が違う（グラバー/✕なし・デスクトップ中央・支出シートより前面 z-[70]）。寄せると UX が変わり BottomSheet の API も肥大。やるなら別途 **ConfirmDialog 小コンポーネント抽出**（下記 T6-6 候補）。 | `expense-modal.tsx:276-314` | — | 低 | ⏸ 見送り |

## Tier 6 — 構造リファクタ（マイグレ不要）
| ID | 内容 | 場所 | 工数 | 価値 |
|----|------|------|------|------|
| **T6-1** ★本命（旧 #9 Provider分割） | `ExpenseModalProvider` の6関心を分割（モーダル状態 / データ変更 mutationVersion / カテゴリキャッシュ）。`useToast` を layout 直下に切り出し他モーダルからも使えるように | `src/components/expense-modal.tsx:60-327` | M | 高 |
| T6-2 | `useCategories(scope)` フック抽出（`?scope=all` 取得＋alive クリーンアップが2箇所重複）※T6-1 に内包しうる | `expense-modal.tsx:82-97` / `category-manager.tsx:22-39` | M | 中 |
| T6-3 | `page.tsx` のスワイプ/アニメ/データ取得/カテゴリ同期をフック分離 | `src/app/page.tsx`（全体304行） | M-L | 高 |
| T6-4 | API レスポンス型を `src/types/api.ts` に集約（各所で `res.json() as {...}` 手キャスト） | `expense-form.tsx:108` / `page.tsx:68` ほか | M | 中 |
| T6-5 | OCR 画像縮小＋抽出をフォームから `useReceiptOcr` 等に切り出し | `src/components/expense-form.tsx:54-144` | S-M | 中 |
| T6-6 | `ConfirmDialog` 小コンポーネント抽出（削除確認の自前実装を汎用化。旧 T5-5 の置き換え案） | `expense-modal.tsx:276-314` | S-M | 低 |

## Tier 7 — テスト空白埋め（マイグレ不要）
| ID | 内容 | 場所 | 工数 | 価値 |
|----|------|------|------|------|
| T7-1 | `lib/ocr.ts` のユニットテスト（クリティカルパス・無テスト） | `src/lib/ocr.ts` | M | 高 |
| T7-2 | 主要コンポーネントの結合テスト（expense-form / expense-modal / monthly-summary） | 各コンポーネント | M-L | 高 |
| T7-3 | `lib/auth.ts` / `session-provider.tsx` のテスト | 該当 | M | 中 |

## Tier 8 — スキーマ撤去（旧 #12 本体・**DBマイグレ要・先に設計判断**）
未使用の「マルチユーザー/通知」足場をどうするか。**完成させる or 撤去する**を先に決める（コード前に意思決定）。撤去なら以下を一括:
- `HouseholdMember` モデル + `role`、（監査用途で残すか要確認の）`User`
- `Household.notificationDay` / `notificationTime`（通知未実装）
- `Expense.receiptImageUrl` / `ocrRawText`（画像非保存方針）
- 工数 M / 価値 中 / **マイグレ YES**

---

## 却下（やらない）
- **旧 #7 fetch共通化** — 実測 fetch 9箇所・重複ごくわずか・エラー処理は文脈依存。共通フックはかえって冗長で意図が埋もれる。**低価値として正式に却下。**
- エラーメッセージ定数化（i18n 準備）— churn 高・価値低。実際に i18n をやる時まで保留。

## 命名ドリフトについて（参考・対応しない）
UI は「世帯コード/保存/クリア」だが、識別子は `passphrase`/`unlock`/`lock`/`unlocked`、cookie 名 `household`、npm `db:set-passphrase` のまま。**据え置き決定済み**（CLAUDE.md 記載）。リファクタ対象ではない。
