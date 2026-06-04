/**
 * 合言葉ロックのセットアップ用スクリプト（一度きり）。
 *
 * 「合言葉 = household.id」方式のため、既存世帯の id を選んだ合言葉へ付け替える。
 * id は各テーブルの FK なので、子レコード（Category / Expense / HouseholdMember）も
 * トランザクションで新 id に移行する。
 *
 * 使い方:
 *   npm run db:set-passphrase -- "うちのひみつ2026"
 *
 * 注意: アプリ側に合言葉の変更UIは無い（仕様）。変更はこのスクリプトで行う。
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const newId = process.argv[2]?.trim();
  if (!newId) {
    console.error('使い方: npm run db:set-passphrase -- "合言葉"');
    process.exit(1);
  }

  const households = await prisma.household.findMany({
    select: { id: true, name: true, notificationDay: true, notificationTime: true },
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
    console.log(`既に合言葉は "${newId}" です。変更は不要です。`);
    return;
  }

  const clash = await prisma.household.findUnique({
    where: { id: newId },
    select: { id: true },
  });
  if (clash) {
    console.error(`"${newId}" は既に使われています。別の合言葉にしてください。`);
    process.exit(1);
  }

  await prisma.$transaction(async (tx) => {
    await tx.household.create({
      data: {
        id: newId,
        name: current.name,
        notificationDay: current.notificationDay,
        notificationTime: current.notificationTime,
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
    await tx.householdMember.updateMany({
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
    `✓ 合言葉(=世帯id)を "${current.id}" → "${newId}" に変更しました（カテゴリ ${cats} 件 / 支出 ${exps} 件 を移行）。`
  );
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
