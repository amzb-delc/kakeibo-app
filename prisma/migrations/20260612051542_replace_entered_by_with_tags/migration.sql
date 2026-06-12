-- enteredBy(Int) を内部タグ配列 tags(TEXT[]) に置き換える。
-- 既存の入力者データは "spouse:<1|2>" タグとしてバックフィルしてから列を落とす（ロスレス）。

-- 1) tags 列を追加
ALTER TABLE "Expense" ADD COLUMN "tags" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

-- 2) 既存 enteredBy をバックフィル（1=♂ → spouse:1 / 2=♀ → spouse:2、NULL はタグなしのまま）
UPDATE "Expense" SET "tags" = ARRAY['spouse:' || "enteredBy"] WHERE "enteredBy" IS NOT NULL;

-- 3) enteredBy 列を削除
ALTER TABLE "Expense" DROP COLUMN "enteredBy";
