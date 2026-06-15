/**
 * 世帯コードのセットアップ用スクリプト（一度きり）。
 *
 * 「世帯コード = household.id」方式のため、既存世帯の id を選んだ世帯コードへ付け替える。
 * id は各テーブルの FK なので、子レコード（Category / Expense）も
 * トランザクションで新 id に移行する。
 *
 * 使い方:
 *   npm run db:set-passphrase -- "うちのひみつ2026"
 *
 * 注意: アプリ側に世帯コードの変更UIは無い（仕様）。変更はこのスクリプトで行う。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newId = process.argv[2]?.trim();
  if (!newId) {
    console.error('使い方: npm run db:set-passphrase -- "世帯コード"');
    process.exit(1);
  }

  const households = await prisma.household.findMany({
    select: { id: true, name: true },
  });
  if (households.length === 0) {
    console.error("世帯が見つかりません。先に `npm run db:seed` を実行してください。");
    process.exit(1);
  }
  if (households.length > 1) {
    console.error(
      `世帯が複数(${households.length})あります。このスクリプトは単一世帯のみ対応です。`
    );
    process.exit(1);
  }

  const current = households[0];
  if (current.id === newId) {
    console.log(`既に世帯コードは "${newId}" です。変更は不要です。`);
    return;
  }

  const clash = await prisma.household.findUnique({
    where: { id: newId },
    select: { id: true },
  });
  if (clash) {
    console.error(`"${newId}" は既に使われています。別の世帯コードにしてください。`);
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.household.create({
      data: {
        id: newId,
        name: current.name,
      },
    });
    await tx.category.updateMany({
      where: { householdId: current.id },
      data: { householdId: newId },
    });
    await tx.expense.updateMany({
      where: { householdId: current.id },
      data: { householdId: newId },
    });
    await tx.household.delete({ where: { id: current.id } });
  });

  const [cats, exps] = await Promise.all([
    prisma.category.count({ where: { householdId: newId } }),
    prisma.expense.count({ where: { householdId: newId } }),
  ]);
  console.log(
    `✓ 世帯コード(=世帯id)を "${current.id}" → "${newId}" に変更しました（カテゴリ ${cats} 件 / 支出 ${exps} 件 を移行）。`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
