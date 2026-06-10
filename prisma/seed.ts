import { PrismaClient } from "@prisma/client";
// 16スロット定数はアプリ本体と共有する（@/ エイリアスは ts-node で解決されないため相対 import）。
import { CATEGORY_SLOTS, slotName } from "../src/lib/category-constants";
import { DEFAULT_HOUSEHOLD_ID } from "../src/lib/household-defaults";

const prisma = new PrismaClient();

// 決定論的な疑似乱数（mulberry32）。固定 seed で繰り返し実行しても同じデータが得られる。
function mulberry32(seed: number) {
  return function () {
    let t = (seed += 0x6d2b79f5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// カテゴリは 16 個固定（CATEGORY_SLOTS / slotName は category-constants と共有）。
// 先頭 9 個（sortOrder 0-8）を有効、残り 7 個を無効とする。
// 実機確認時は、下記 DEMO_LABELS の意味のある名前へ手動でリネームする想定。
const ENABLED_SLOTS = 9;

// デモ支出を割り当てる論理カテゴリ（slot 0..8 に対応）。
// 実機ではこの名前へ手動リネームすることで「食費」等として確認できる。
const DEMO_LABELS = [
  "食費", // slot 0 / ヒヨウ01
  "日用品", // slot 1 / ヒヨウ02
  "交通費", // slot 2 / ヒヨウ03
  "娯楽", // slot 3 / ヒヨウ04
  "医療", // slot 4 / ヒヨウ05
  "特別費", // slot 5 / ヒヨウ06
  "美容", // slot 6 / ヒヨウ07
  "教育", // slot 7 / ヒヨウ08
  "その他", // slot 8 / ヒヨウ09
];

// 16 スロットぶんの create データ
const categorySlotData = (householdId: string) =>
  Array.from({ length: CATEGORY_SLOTS }, (_, i) => ({
    householdId,
    name: slotName(i),
    sortOrder: i,
    enabled: i < ENABLED_SLOTS,
  }));

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
    where: { id: DEFAULT_HOUSEHOLD_ID },
    update: {},
    create: {
      id: DEFAULT_HOUSEHOLD_ID,
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

  // 初期カテゴリを 16 スロット用意（既存の ヒヨウNN は skipDuplicates でそのまま）。
  // 本番でも 16 枠だけは確実に存在させる。既存データの削除はしない。
  await prisma.category.createMany({
    data: categorySlotData(household.id),
    skipDuplicates: true,
  });

  // ここから下はデモ用支出データの生成（破壊的）。
  // 本番DBで誤って実行されないよう、NODE_ENV=production の時は SEED_DEMO=1 を要求する。
  if (process.env.NODE_ENV === "production" && process.env.SEED_DEMO !== "1") {
    console.warn(
      "[seed] Skipping demo expense generation in production. Set SEED_DEMO=1 to override."
    );
    console.log("Seed completed (categories only).");
    return;
  }

  // サンプル支出（12ヶ月分）を再生成。既存はクリアして再実行可能に。
  await prisma.expense.deleteMany({ where: { householdId: household.id } });

  // 旧シードの名前付きカテゴリ等が残っていても、デモ路線ではカテゴリを 16 スロットに作り直す。
  // 支出を消した後なので FK(Restrict) に阻まれず削除できる。
  await prisma.category.deleteMany({ where: { householdId: household.id } });
  await prisma.category.createMany({ data: categorySlotData(household.id) });

  const allCategories = await prisma.category.findMany({
    where: { householdId: household.id },
  });
  // デモ支出は論理名（DEMO_LABELS）→ slot index（sortOrder）で引く
  const catId = (label: string) => {
    const idx = DEMO_LABELS.indexOf(label);
    const c = allCategories.find((x) => x.sortOrder === idx);
    if (!c) throw new Error(`Demo category slot not found: ${label}`);
    return c.id;
  };

  const now = new Date();
  const endYear = now.getFullYear();
  const endMonth = now.getMonth() + 1;

  // JST 12:00 (UTC 03:00) として保存する
  const dateAt = (y: number, m: number, d: number) =>
    new Date(Date.UTC(y, m - 1, d, 3, 0, 0));

  // 再現性のため seedable RNG (mulberry32) を使う。組込み乱数だと実行毎に値が変わり、
  // 「先月と同じ条件で再現したい」レビュー検証が困難になる。
  const rng = mulberry32(20260528);
  const rand = (min: number, max: number) =>
    Math.floor(min + rng() * (max - min + 1));
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
    if (rng() < 0.8) {
      for (let k = 0; k < rand(1, 4); k++) {
        push(y, m, rand(1, daysInMonth), "娯楽", rand(1500, 8000));
      }
    }

    // 医療
    if (rng() < 0.5) {
      push(y, m, rand(1, daysInMonth), "医療", rand(800, 5000));
    }

    // 特別費
    if (isAnomalyHighSpecial) {
      push(y, m, rand(1, daysInMonth), "特別費", 150000, null, "大物家具");
    } else if (rng() < 0.3) {
      push(y, m, rand(1, daysInMonth), "特別費", rand(15000, 50000));
    }

    // 美容
    if (rng() < 0.7) {
      push(y, m, rand(1, daysInMonth), "美容", rand(4000, 12000));
    }

    // 教育
    if (rng() < 0.4) {
      push(y, m, rand(1, daysInMonth), "教育", rand(8000, 25000));
    }

    // その他
    if (rng() < 0.4) {
      push(y, m, rand(1, daysInMonth), "その他", rand(2000, 7000));
    }
  }

  await prisma.expense.createMany({ data });

  console.log("Seed completed.");
  console.log(`  User: ${user.email}`);
  console.log(`  Household: ${household.name}`);
  console.log(
    `  Categories: ${CATEGORY_SLOTS} slots (${slotName(0)}..${slotName(CATEGORY_SLOTS - 1)}, ${ENABLED_SLOTS} enabled)`
  );
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
