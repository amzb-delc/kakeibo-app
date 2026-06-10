# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 開発コマンド

```bash
npm run dev       # 開発サーバー起動 (localhost:3000)
npm run build     # プロダクションビルド
npm run lint      # ESLint
npx prisma generate          # Prismaクライアント生成
npx prisma migrate dev       # マイグレーション実行
npx prisma db seed           # シードデータ投入
npx prisma studio            # DB GUIツール
npm run db:set-passphrase -- "世帯コード"   # 世帯id(=世帯コード)を変更（一度きりのセットアップ）
```

## アーキテクチャ

**技術スタック:** Next.js 16 (App Router) + Prisma 5 + PostgreSQL + shadcn-ui + TypeScript

**データベース:** `.env` の `DATABASE_URL` に PostgreSQL の接続文字列を設定する。

**Prismaクライアント:** `src/lib/prisma.ts` にシングルトンで定義。dev環境ではホットリロード対応。

**認証（世帯コード）:** ユーザー管理は持たず、**夫婦で共有する「世帯コード」= `household.id`** を入力・保存した端末だけが家計データを見られる方式。
- 保存: `/api/session` に世帯コードを POST → 一致する世帯があれば `household` cookie（httpOnly・長期・**署名なし**）を発行（＝端末に「保存」）。DELETE で「クリア」。
- スコープ: 各データ API は `getHouseholdId()`（`src/lib/auth.ts`、cookie から取得）で世帯を特定。**cookie 無し＝未保存なら 401**（データを返さない）。`middleware` は使わず API 側でガード。
- 世帯コードはアプリから変更しない（仕様）。変更は `npm run db:set-passphrase -- "世帯コード"`（既存世帯の id を付け替え）。
- 保存UIは設定モーダル（`SettingsModalProvider` / フッタ「設定」）、未保存のときは `/` が未保存画面。`SessionProvider` がクライアントの保存状態を保持。
- cookie は端末（ブラウザ／PWA）ごとに別物。**iOSでは Safari とホーム画面PWAでストレージが分離**されるため、保存状態は両者で共有されない（片方でクリアしてももう片方には残る）。MVPの軽量な保護として許容する仕様。
- seed / 上記スクリプトの既定世帯IDは `"demo-household"`（seed・`set-passphrase.ts` 内のリテラル）。

## 画面構成

| パス | 概要 |
|------|------|
| `/` | 月次サマリー（ホーム・アプリの起点）。月切り替え・カテゴリ選択・明細表示。登録/編集は FAB のモーダルで行う |

※ ページ遷移は持たず、支出の登録/編集（`ExpenseModalProvider`）と設定（世帯コード保存・カテゴリ管理、`SettingsModalProvider`）は**ボトムシートのモーダル**で開く。

## APIルート

| エンドポイント | 概要 |
|------|------|
| `GET/POST/PATCH/DELETE /api/session` | 保存状態の取得（世帯＋入力者。**入力者cookie が無ければ既定2=♀を発行**） / 世帯コードを保存（cookie発行） / **入力者(1=♂/2=♀)を端末に保存（PATCH）** / クリア（両cookie破棄） |
| `GET /api/categories` | カテゴリ一覧（sortOrder順）。`?scope=all` で無効含む全16スロット（管理画面用） |
| `PATCH /api/categories/[id]` | カテゴリの名前変更・有効/無効トグル（`Category.enabled`） |
| `POST /api/expenses` | 支出登録（amount, spentAt, categoryId 必須） |
| `POST /api/expenses/batch` | 支出の一括登録（明細取り込み用）。全行バリデーション→1件でも失敗なら何も作らず errors を返す（全成功か全失敗）。上限500件 |
| `GET/PATCH/DELETE /api/expenses/[id]` | 支出の取得 / 編集 / 削除 |
| `GET /api/monthly-summary?year=&month=` | 月次集計（当月・前月合計、カテゴリ別） |
| `POST /api/ocr` | レシート画像（base64）から金額・店名・日付・カテゴリ候補を抽出（Claude ビジョン） |
| `POST /api/statement` | クレカ明細PDF（base64）から利用明細行を一括抽出（Claude document）。自世帯カテゴリに解決し、重複候補に `duplicateLikely` を付与 |

`/api/session` 以外のデータ API は**未保存（cookie 無し）だと 401**。

## データモデルの補足

- `Expense.amount` は円単位の整数
- `Expense.enteredBy` は**入力者**（`1=♂(夫) / 2=♀(妻)`）。**端末ごとの設定**（設定モーダルで選択 → `ENTERED_BY_COOKIE`）で、**新規登録（POST `/api/expenses`・batch）時にサーバが cookie から付与**する。**編集 PATCH は触らない（据え置き）**ため、`expense-form` / `validateExpenseInput` には乗せない。**未設定の端末は起動時の GET `/api/session` で既定値 2=♀ を発行**（妻がメイン利用の想定。夫は設定で 1=♂ に切替）するので、登録の必須ゲートは設けない。`getEnteredBy()`（`src/lib/auth.ts`）で取得。**一覧での入力者表示は未実装**（別途）
- `Category` は `householdId` ごとにユニーク。**16スロット固定**（seedで生成）。追加・削除・並び替えは不可だが、**名前変更・有効/無効トグルは実装済み**（設定モーダル内 `category-manager.tsx` ＋ `PATCH /api/categories/[id]`、`Category.enabled` 列）
- トレンド判定ロジックは `src/lib/trend.ts` に集約

## 実装上の制約（MVPスコープ）

- ユーザー管理（個人アカウント）は持たない。保護は世帯共有の世帯コードのみ（上記「認証」参照）
- レシートOCRは実装済み（`POST /api/ocr` + `src/lib/ocr.ts`、Claude ビジョン）。撮影・縮小・読み取りは再利用可能な `ReceiptCaptureButton`（隠し input + `useReceiptOcr`）が担い、抽出結果（金額・店名・日付・カテゴリ）だけを `onResult` で返す。**2つの動線**:
  - **支出モーダル新規時のヘッダーのカメラ**: 開いているフォームに `ocrResult`（`expense-modal` 経由で `ExpenseForm` に渡る）として反映。
  - **フッター右のカメラ（ホーム）**: 撮影 → `openCreate({ ocr, keepOpen: true })` で**連続入力ON・レシートの月**で登録モーダルを開く（まとめ入力動線）。アイコンは“重ねカメラ”で連続入力モードを表す。
  - **日付の扱い**: OCR の日付が妥当なら（`parseReceiptDate`、`src/lib/date.ts`）**年月日を丸ごと**フォームに反映する。レシートの月でフォームが開くとき、ホームの表示月も `createMonth` 経由で同期する（`useMonthlySummary.goToMonth`）。
  - **画像は保存しない**（抽出のみ、`receiptImageUrl`/`ocrRawText` は未使用のまま）。`ANTHROPIC_API_KEY` 必須（未設定なら 503）。モデルは `OCR_MODEL`（既定 `claude-haiku-4-5`）
- 日付入力: `ExpenseForm` の年月日は**縦ホイール**（`src/components/wheel.tsx`、汎用ドラム）で選ぶ。**月・日は端で巡回**（`loop`）、年は範囲（今年〜5年前＋OCR等で外れた年も内包）。年月変更時は日を月末でクランプ（`clampDay`）。無効日付は保存をブロック（クライアント）＋サーバも弾く（`parseJstDate` は 2/30・4/31 等をロールオーバーせず null）。登録/編集の保存時も `onSuccess` の年月でホーム表示月を同期する。
- 連続入力（ロック）トグル: 支出モーダル**新規時のヘッダー**にスイッチ（`src/components/ui/switch.tsx`、base-ui）を置き、ON のとき保存後もシートを閉じず年月＋日＋カテゴリを残して続けて入力する。状態は `expense-modal` が保持し `ExpenseForm` に渡す。錠アイコンはスイッチのトラック内（ON=閉錠・OFF=開錠）。
- フッター（`footer-nav.tsx`）: ホームは唯一のページなのでサマリータブは廃止。**左=設定／中央=登録FAB（手入力）／右=レシートOCRカメラ**。FAB とカメラは未保存（`unlocked` でない）のときは出さない（OCR API も 401）。
- クレカ明細の一括取り込みは実装済み（`POST /api/statement` + `src/lib/statement.ts`、Claude の document(PDF) 抽出。既定モデルは `STATEMENT_MODEL`＝`claude-sonnet-4-6`、env で切替可）。動線は**ホームのヘッダ左「フォルダ」アイコン**（`StatementImportButton`）→ PDF ピッカー → 抽出 → **プレビューシート**（`statement-preview-sheet.tsx`、行ごとに金額・日付・店名・カテゴリを編集／除外）→ `POST /api/expenses/batch` で一括登録。
  - **重複候補**: 抽出行を対象期間の既存支出と突合し（`src/lib/duplicate.ts`、同日×同額×店名近似）`duplicateLikely` を立てるが、**除外はせずユーザー判断**（プレビューで警告表示）。
  - **PDFは保存しない**（抽出のみ、base64 は送信後破棄）。`ANTHROPIC_API_KEY` 必須（未設定なら 503）。状態は `StatementImportProvider`（`ExpenseModalProvider` の内側でカテゴリ先読み・登録後の一覧再取得 `notifyBatch` を借りる）。
- 通知機能は未実装（`notificationDay`, `notificationTime` フィールドのみ存在）
- カテゴリの**追加・削除・並び替えは未対応**（16スロット固定）。名前変更・有効/無効の管理UIは実装済み（`category-manager.tsx`、設定モーダル内）
