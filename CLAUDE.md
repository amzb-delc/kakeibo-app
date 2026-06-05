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
- `DEMO_HOUSEHOLD_ID` は seed / 上記スクリプトの既定値としてのみ残置。

## 画面構成

| パス | 概要 |
|------|------|
| `/` | 月次サマリー（ホーム・アプリの起点）。月切り替え・カテゴリ選択・明細表示。登録/編集は FAB のモーダルで行う |

## APIルート

| エンドポイント | 概要 |
|------|------|
| `GET/POST/DELETE /api/session` | 保存状態の取得 / 世帯コードを保存（cookie発行） / クリア（cookie破棄） |
| `GET /api/categories` | カテゴリ一覧（sortOrder順） |
| `POST /api/expenses` | 支出登録（amount, spentAt, categoryId 必須） |
| `GET /api/monthly-summary?year=&month=` | 月次集計（当月・前月合計、カテゴリ別） |

`/api/session` 以外のデータ API は**未保存（cookie 無し）だと 401**。

## データモデルの補足

- `Expense.amount` は円単位の整数
- `Category` は `householdId` ごとにユニーク（MVPではseedで固定、追加UIなし）
- トレンド判定ロジックは `src/lib/trend.ts` に集約

## 実装上の制約（MVPスコープ）

- ユーザー管理（個人アカウント）は持たない。保護は世帯共有の世帯コードのみ（上記「認証」参照）
- OCR連携は `handleOcr()` のスタブのみ（`expense-form.tsx`）
- 通知機能は未実装（`notificationDay`, `notificationTime` フィールドのみ存在）
- カテゴリ追加UIは未実装
