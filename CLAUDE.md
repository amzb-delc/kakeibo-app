# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

> **一次情報は `docs/spec.html`（living spec）。** 画面・API・機能の挙動はそちらを参照。本ファイルは spec に書きづらい「非自明なアーキテクチャ・運用上の落とし穴・ワークフロー規約」だけを残す。

## 開発コマンド

```bash
npm run dev       # 開発サーバー起動 (localhost:3000)
npm run build     # プロダクションビルド
npm run lint      # ESLint
npm test          # Vitest 一括実行（watch は npm run test:watch）
npx prisma generate          # Prismaクライアント生成
npx prisma migrate dev       # マイグレーション実行
npx prisma db seed           # シードデータ投入
npx prisma studio            # DB GUIツール
npm run db:set-passphrase -- "世帯コード"   # 世帯id(=世帯コード)を変更（一度きりのセットアップ）
```

## アーキテクチャ

**スタック:** Next.js 16 (App Router) + Prisma 5 + PostgreSQL + shadcn-ui + TypeScript。`DATABASE_URL`（env）に接続文字列。Prismaクライアントは `src/lib/prisma.ts` にシングルトン。

ページ遷移は持たず `/`（月次サマリー＝ホーム）のみ。登録/編集・設定はボトムシートのモーダル（`ExpenseModalProvider` / `SettingsModalProvider`）。

### 認証（世帯コード）— 最重要の非自明点

ユーザー管理は持たず、**夫婦で共有する「世帯コード」= `household.id`** を保存した端末だけがデータを見られる。

- `/api/session` に世帯コードを POST → 一致世帯なら `household` cookie（httpOnly・長期・HMAC署名付き）を発行、DELETE でクリア。レート制限あり（同一IP 60秒10回）。
- 各データAPIは `getHouseholdId()`（`src/lib/auth.ts`）で世帯特定。cookie の HMAC署名を検証（`src/lib/cookie-sign.ts`）し、未署名・改竄は未保存扱い。**`/api/session` 以外のデータAPIは未保存だと 401。**
- **`SESSION_SECRET`（env）は本番必須**（未設定だと署名検証で500）。dev/test は固定フォールバック。**鍵を変える/導入すると既存cookieは全て無効化され、全端末で再保存が必要。**
- 世帯コードはアプリから変更しない。変更は `npm run db:set-passphrase`。seed/同スクリプトの既定IDは `"demo-household"`。
- **iOSは Safari とホーム画面PWAでストレージが分離**され保存状態を共有しない（MVPの軽量保護として許容）。

## ドキュメント規約

`docs/` に**自己完結HTML**で置く（ブラウザで読めて git 共有可能）。**起点は `docs/index.html`**、各ページ上部に index へ戻る backlink。docs を増やしたら `index.html` にリンク追加。

- **実装を伴う改修のプランは `docs/<feature>-plan.html` に残す**（plan mode の `~/.claude/plans/*.md` はリポ外で共有しづらいため）。スタイルは `docs/statement-import-plan.html` / `entered-by-plan.html` に倣い、冒頭に backlink ＋「作成日・ステータス(PR番号)」の blockquote。
- 仕様変更は `spec.html` に反映。プランHTMLは「設計時の記録」として残す。
- **リファクタ／セキュリティのバックログは `docs/refactor-backlog.html` がマスター**（Tier 採番・残タスク・SEC 項目の現況を集約）。進捗の更新はこの HTML を直接編集する（採番リストをコード/メモリに散らさない）。

## ワークフロー規約

- **非自明な改修（UI/仕様変更・機能追加など）は feat ブランチを切り、GitHub PR で main にマージ**する。`main` 直コミットは避ける（typo・小修正のような明らかに軽微な変更のみ直でも可）。着手前に `git checkout -b feat/xxx`。
- コミットは **feat + docs に分割**するスタイル。
- push 後は `gh pr create`（または GitHub MCP `create_pull_request`）で PR を立てる。
- **ファイルを書き換える（＝コミットを伴い得る）サブエージェント（Agent ツール）は、必ず `isolation: "worktree"`（隔離ワークツリー）で起動する**。複数の並行ジョブが同じ作業ディレクトリでブランチを切り替え、未コミット変更を失う/stash 退避される競合を避けるため。**`Explore`/`Plan`/`claude-code-guide` などの読み取り専用調査エージェント、および read-only レビュアー `REV一郎`（Write/Edit を持たず、`git diff` で作業ツリーの直近差分を見る必要があるため）は隔離不要**（`.claude/settings.json` の PreToolUse フックが種別で判定し、書き込み系のみ worktree を必須化＝**このリポジトリ限定**・他プロジェクトには適用しない）。共有ハブ＝`expense-modal.tsx`/`page.tsx`/`*-provider.tsx`/`schema.prisma`/`package-lock.json` は特に並行で衝突しやすい。

### サブエージェント分業（所有境界とブランチ運用）

メイン（司令塔兼実装）が逐次起動し、**コミット/PRは直列**。worktree は使い捨て（成果の永続性はブランチが持つ。書き込み系は push まで完了して終了）。

| 領域 | 担当 | worktree | ブランチ |
|---|---|---|---|
| PRレビュー（read-only） | `REV一郎` | 不要 | なし（`gh pr diff`/MCPで読み、`gh pr review` でコメント） |
| `*.test.ts` の追加・更新 | `TEST二郎` | 使い捨て（frontmatter で既定） | feature 相乗り／単独タスクは `agent/test-jiro` |
| `docs/` の更新（spec/plan/backlog/index） | `DOC三郎` | 使い捨て（同上） | feature 相乗り／単独タスクは `agent/doc-saburo` |
| フロントエンド実装（スポット起動） | `FRONT四郎` | 使い捨て（同上） | `feat/xxx`（1機能=1PR） |
| バックエンド実装・root・`CLAUDE.md`・メモリ | メイン | — | `feat/xxx` |

専用ブランチ（`agent/*`）はマージまで積み増し、マージ後は main に追従させてから次を積む。

## データモデルの非自明点

spec の「データモデル」に加え、コードを触る前に知っておくべき点:

- `Expense.amount` は円単位の整数。
- `Expense.enteredBy`（入力者 `1=♂/2=♀`）は**端末cookie設定（`ENTERED_BY_COOKIE`）を元に新規登録(POST/batch)時にサーバが付与**。**編集 PATCH は据え置き**で、`expense-form`/`validateExpenseInput` には乗せない。未設定端末は GET `/api/session` が既定2=♀を発行するため登録の必須ゲートは無い。`getEnteredBy()`（`src/lib/auth.ts`）。
- `Category` は **16スロット固定**（seed生成・`householdId` ごとにユニーク）。追加・削除・並び替えは不可、名前変更・有効/無効トグルのみ（`Category.enabled`）。
- `POST /api/expenses/batch` は**全成功か全失敗**（1件でも失敗なら何も作らず errors を返す・上限500件）。
- 日付は `src/lib/date.ts`。`parseJstDate` は 2/30・4/31 等をロールオーバーせず null（無効日付はサーバが弾く）。トレンド判定は `src/lib/trend.ts`。

## 実装状況（MVPスコープ）

機能の動線・UI詳細は `docs/spec.html`、設計記録は各 `*-plan.html` 参照。要点のみ:

- **レシートOCR**（`src/lib/ocr.ts`）・**クレカ明細PDF取込**（`src/lib/statement.ts` → プレビュー → `/api/expenses/batch`）は実装済。いずれも **`ANTHROPIC_API_KEY` 必須**（未設定なら503）、画像/PDFは保存しない。モデルは env `OCR_MODEL`（既定 haiku）/ `STATEMENT_MODEL`（既定 sonnet）。
- **未実装:** 通知（`notificationDay`/`notificationTime` フィールドのみ）。カテゴリの追加・削除・並び替え。
