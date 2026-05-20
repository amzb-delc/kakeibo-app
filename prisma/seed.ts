import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

const INITIAL_CATEGORIES = [
  "食費",
  "日用品",
  "交通費",
  "娯楽",
  "医療",
  "特別費",
  "美容",
  "教育",
  "その他",
];

async function main() {
  // デモ用ユーザー
  const user = await prisma.user.upsert({
    where: { email: "demo@example.com" },
    update: {},
    create: {
      name: "デモユーザー",
      email: "demo@example.com",
    },
  });

  // デモ用世帯
  const household = await prisma.household.upsert({
    where: { id: "demo-household" },
    update: {},
    create: {
      id: "demo-household",
      name: "我が家",
      notificationDay: 25,
      notificationTime: "09:00",
    },
  });

  // 世帯メンバー登録
  await prisma.householdMember.upsert({
    where: {
      householdId_userId: {
        householdId: household.id,
        userId: user.id,
      },
    },
    update: {},
    create: {
      householdId: household.id,
      userId: user.id,
      role: "owner",
    },
  });

  // 初期カテゴリ投入
  for (let i = 0; i < INITIAL_CATEGORIES.length; i++) {
    await prisma.category.upsert({
      where: {
        householdId_name: {
          householdId: household.id,
          name: INITIAL_CATEGORIES[i],
        },
      },
      update: {},
      create: {
        householdId: household.id,
        name: INITIAL_CATEGORIES[i],
        sortOrder: i,
      },
    });
  }

  console.log("Seed completed.");
  console.log(`  User: ${user.email}`);
  console.log(`  Household: ${household.name}`);
  console.log(`  Categories: ${INITIAL_CATEGORIES.join(", ")}`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
