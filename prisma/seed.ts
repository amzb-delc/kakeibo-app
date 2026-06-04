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
      name: "ワレワレ",
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

  // サンプル支出（12ヶ月分）を再生成。既存はクリアして idempotent に。
  await prisma.expense.deleteMany({ where: { householdId: household.id } });

  const allCategories = await prisma.category.findMany({
    where: { householdId: household.id },
  });
  const catId = (name: string) => {
    const c = allCategories.find((x) => x.name === name);
    if (!c) throw new Error(`Category not found: ${name}`);
    return c.id;
  };

  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  // JST 12:00 (UTC 03:00) として保存する
  const dateAt = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d, 3, 0, 0));
  const rand = (min: number, max: number) =>
    Math.floor(min + Math.random() * (max - min + 1));
  const pick = <T>(arr: T[]): T => arr[rand(0, arr.length - 1)];

  const foodStores = ["スーパー〇〇", "コンビニ", "イオン", "OKストア", "外食", "デリバリー"];
  const dailyStores = ["ドラッグストア", "100均", "ホームセンター"];

  type ExpenseInput = {
    householdId: string;
    categoryId: string;
    amount: number;
    spentAt: Date;
    storeName: string | null;
    memo: string | null;
    createdByUserId: string;
  };

  const data: ExpenseInput[] = [];
  const push = (
    y: number,
    m: number,
    d: number,
    category: string,
    amount: number,
    storeName: string | null = null,
    memo: string | null = null
  ) => {
    data.push({
      householdId: household.id,
      categoryId: catId(category),
      amount,
      spentAt: dateAt(y, m, d),
      storeName,
      memo,
      createdByUserId: user.id,
    });
  };

  // 12ヶ月分（現在月を含む）を生成
  for (let i = 11; i >= 0; i--) {
    let y = endYear;
    let m = endMonth - i;
    while (m <= 0) {
      m += 12;
      y -= 1;
    }
    const daysInMonth = new Date(y, m, 0).getDate();

    // 異常月の仕込み
    const isAnomalyLowFood = i === 2; // 2ヶ月前: 食費が「やたら少ない」
    const isAnomalyHighSpecial = i === 5; // 5ヶ月前: 特別費が「やたら多い」

    // 食費
    if (isAnomalyLowFood) {
      push(y, m, rand(1, daysInMonth), "食費", 1300, "コンビニ", "ほぼ外食 / 帰省");
    } else {
      const n = rand(15, 25);
      for (let k = 0; k < n; k++) {
        push(y, m, rand(1, daysInMonth), "食費", rand(800, 4500), pick(foodStores));
      }
    }

    // 日用品
    for (let k = 0; k < rand(2, 5); k++) {
      push(y, m, rand(1, daysInMonth), "日用品", rand(800, 3500), pick(dailyStores));
    }

    // 交通費
    for (let k = 0; k < rand(2, 4); k++) {
      push(y, m, rand(1, daysInMonth), "交通費", rand(300, 2500));
    }

    // 娯楽
    if (Math.random() < 0.8) {
      for (let k = 0; k < rand(1, 4); k++) {
        push(y, m, rand(1, daysInMonth), "娯楽", rand(1500, 8000));
      }
    }

    // 医療
    if (Math.random() < 0.5) {
      push(y, m, rand(1, daysInMonth), "医療", rand(800, 5000));
    }

    // 特別費
    if (isAnomalyHighSpecial) {
      push(y, m, rand(1, daysInMonth), "特別費", 150000, null, "大物家具");
    } else if (Math.random() < 0.3) {
      push(y, m, rand(1, daysInMonth), "特別費", rand(15000, 50000));
    }

    // 美容
    if (Math.random() < 0.7) {
      push(y, m, rand(1, daysInMonth), "美容", rand(4000, 12000));
    }

    // 教育
    if (Math.random() < 0.4) {
      push(y, m, rand(1, daysInMonth), "教育", rand(8000, 25000));
    }

    // その他
    if (Math.random() < 0.4) {
      push(y, m, rand(1, daysInMonth), "その他", rand(2000, 7000));
    }
  }

  await prisma.expense.createMany({ data });

  console.log("Seed completed.");
  console.log(`  User: ${user.email}`);
  console.log(`  Household: ${household.name}`);
  console.log(`  Categories: ${INITIAL_CATEGORIES.join(", ")}`);
  console.log(`  Expenses: ${data.length} (12 months)`);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
