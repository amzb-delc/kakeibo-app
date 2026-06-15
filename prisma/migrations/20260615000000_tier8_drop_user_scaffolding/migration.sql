-- Tier 8: 未使用のマルチユーザー/通知足場を撤去する。
-- - User / HouseholdMember モデルを削除
-- - Expense.createdByUserId（常に demo ユーザー固定で情報量ゼロ）を削除
-- - Household.notificationDay / notificationTime（通知未実装）を削除
-- - Expense.receiptImageUrl / ocrRawText（画像非保存方針の予約列）を削除
-- 支出データ（householdId / categoryId / tags 等）は保持される。

-- DropForeignKey
ALTER TABLE "Expense" DROP CONSTRAINT IF EXISTS "Expense_createdByUserId_fkey";
ALTER TABLE "HouseholdMember" DROP CONSTRAINT IF EXISTS "HouseholdMember_householdId_fkey";
ALTER TABLE "HouseholdMember" DROP CONSTRAINT IF EXISTS "HouseholdMember_userId_fkey";

-- DropTable
DROP TABLE "HouseholdMember";
DROP TABLE "User";

-- AlterTable: 通知フィールド（未実装）を撤去
ALTER TABLE "Household" DROP COLUMN "notificationDay",
DROP COLUMN "notificationTime";

-- AlterTable: createdByUserId（情報量ゼロ）と予約列（画像非保存）を撤去
ALTER TABLE "Expense" DROP COLUMN "createdByUserId",
DROP COLUMN "receiptImageUrl",
DROP COLUMN "ocrRawText";
