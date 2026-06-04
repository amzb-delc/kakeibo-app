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
npm run db:set-passphrase -- "合言葉"   # 世帯id(=合言葉)を変更（一度きりのセットアップ）
```

## アーキテクチャ

**技術スタック:** Next.js 16 (App Router) + Prisma 5 + PostgreSQL + shadcn-ui + TypeScript

**データベース:** `.env` の `DATABASE_URL` に PostgreSQL の接続文字列を設定する。

**Prismaクライアント:** `src/lib/prisma.ts` にシングルトンで定義。dev環境ではホットリロード対応。

**認証（合言葉ロック）:** ユーザー管理は持たず、**夫婦で共有する「合言葉」= `household.id`** でデータをロックする方式。
- 解錠: `/api/session` に合言葉を POST → 一致する世帯があれば `household` cookie（httpOnly・長期・**署名なし**）を発行。DELETE でロック。
- スコープ: 各データ API は `getHouseholdId()`（`src/lib/auth.ts`、cookie から取得）で世帯を特定。**cookie 無し＝未解錠なら 401**（データを返さない）。`middleware` は使わず API 側でガード。
- 合言葉はアプリから変更しない（仕様）。変更は `npm run db:set-passphrase -- "合言葉"`（既存世帯の id を付け替え）。
- 解錠UIは設定モーダル（`SettingsModalProvider` / フッタ「設定」）、ロック中は `/` がロック画面。`SessionProvider` がクライアントのロック状態を保持。
- `DEMO_HOUSEHOLD_ID` は seed / 上記スクリプトの既定値としてのみ残置。

## 画面構成

| パス | 概要 |
|------|------|
| `/` | 月次サマリー（ホーム・アプリの起点）。月切り替え・カテゴリ選択・明細表示。登録/編集は FAB のモーダルで行う |

## APIルート

| エンドポイント | 概要 |
|------|------|
| `GET/POST/DELETE /api/session` | 解錠状態の取得 / 合言葉で解錠（cookie発行） / ロック（cookie破棄） |
| `GET /api/categories` | カテゴリ一覧（sortOrder順） |
| `POST /api/expenses` | 支出登録（amount, spentAt, categoryId 必須） |
| `GET /api/monthly-summary?year=&month=` | 月次集計（当月・前月合計、カテゴリ別） |

`/api/session` 以外のデータ API は**未解錠（cookie 無し）だと 401**。

## データモデルの補足

- `Expense.amount` は円単位の整数
- `Category` は `householdId` ごとにユニーク（MVPではseedで固定、追加UIなし）
- トレンド判定ロジックは `src/lib/trend.ts` に集約

## 実装上の制約（MVPスコープ）

- ユーザー管理（個人アカウント）は持たない。保護は世帯共有の合言葉ロックのみ（上記「認証」参照）
- OCR連携は `handleOcr()` のスタブのみ（`expense-form.tsx`）
- 通知機能は未実装（`notificationDay`, `notificationTime` フィールドのみ存在）
- カテゴリ追加UIは未実装
