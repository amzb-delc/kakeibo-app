---
name: review-tags-feature
description: Expense.enteredBy→tags(String[])移行のアーキテクチャと、レビューで確認すべき不変条件
metadata:
  type: project
---

支出タグ機能（feat/expense-tags, PR #69 でmainマージ済）。`Expense.enteredBy Int?` を `tags String[] @default([])` に置換。タグ仕様は src/lib/tags.ts。

タグ種別:
- `spouse:1`(♂)/`spouse:2`(♀): 端末cookie由来。POST /api/expenses・/batch の新規登録時のみ getEnteredBy() で付与。
- `card:<カード名>`: クレカ明細取込時のみ。/batch のトップレベル cardName から。

**How to apply（レビューで守るべき不変条件）:**
- tags は新規登録(POST/batch)時のみ付与。**PATCH(編集)は据え置き** = validateExpenseInput(src/lib/expenses.ts)に tags/enteredBy を含めない。PATCH route は data に tags を入れないこと（[id]/route.ts）。
- cardName は LLM抽出由来の自由文字列 → 二重検証が肝。lib/statement.ts(抽出)→client→/batch(cardTagOf で再検証)。cardTagOf は trim・30字上限・制御文字(C0/DEL)弾き。batch で型不正/上限超は400・全行不作成。
- ?tag= フィルタ(monthly-summary route)は isValidTag で検証(不正400)。tagFilter は表示月・比較月・6ヶ月の**3クエリ全てに一貫適用**すること（漏れると集計不整合）。
- isCardTag は cardTagOf との往復一致で正規化を保証（trim済み・上限内・制御文字なしのみ true）。
- マイグレーション: tags 列を `NOT NULL DEFAULT ARRAY[]` で追加 → enteredBy を `spouse:N` にバックフィル(NULLはタグなし) → enteredBy 列削除。ロスレス。
- enteredBy 型・cookie(ENTERED_BY_COOKIE)・/api/session の既定2発行は**意図的に存続**（タグ付与の入力源）。Expense への書き込み経路にだけ enteredBy が残っていないかを見る。
