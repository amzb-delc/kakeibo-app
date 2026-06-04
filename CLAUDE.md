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
```

## アーキテクチャ

**技術スタック:** Next.js 16 (App Router) + Prisma 5 + PostgreSQL + shadcn-ui + TypeScript

**データベース:** `.env` の `DATABASE_URL` に PostgreSQL の接続文字列を設定する。

**Prismaクライアント:** `src/lib/prisma.ts` にシングルトンで定義。dev環境ではホットリロード対応。

**認証:** MVPでは未実装。APIルートはすべて `DEMO_HOUSEHOLD_ID = "demo-household"` のデモ世帯を使用。実装時はここを差し替える。

## 画面構成

| パス | 概要 |
|------|------|
| `/` | 月次サマリー（ホーム・アプリの起点）。月切り替え・カテゴリ選択・明細表示。登録/編集は FAB のモーダルで行う |

## APIルート

| エンドポイント | 概要 |
|------|------|
| `GET /api/categories` | カテゴリ一覧（sortOrder順） |
| `POST /api/expenses` | 支出登録（amount, spentAt, categoryId 必須） |
| `GET /api/monthly-summary?year=&month=` | 月次集計（当月・前月合計、カテゴリ別） |

## データモデルの補足

- `Expense.amount` は円単位の整数
- `Category` は `householdId` ごとにユニーク（MVPではseedで固定、追加UIなし）
- トレンド判定ロジックは `src/lib/trend.ts` に集約

## 実装上の制約（MVPスコープ）

- 認証・ユーザー管理は作り込まない
- OCR連携は `handleOcr()` のスタブのみ（`expense-form.tsx`）
- 通知機能は未実装（`notificationDay`, `notificationTime` フィールドのみ存在）
- カテゴリ追加UIは未実装
