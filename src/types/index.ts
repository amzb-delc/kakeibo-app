export type Category = {
  id: string;
  name: string;
  sortOrder: number;
  enabled: boolean;
};

export type Expense = {
  id: string;
  categoryId: string;
  amount: number;
  spentAt: string;
  storeName: string | null;
  memo: string | null;
  category: { id: string; name: string };
};

export type CategoryExpense = {
  id: string;
  amount: number;
  spentAt: string; // 発生日（利用日）
  updatedAt: string; // 更新日（最終編集日時）
  storeName: string | null;
  memo: string | null;
};

export type BoxStats = {
  median: number;
  q1: number;
  q3: number;
  lowerFence: number;
  upperFence: number;
};

export type CategorySummary = {
  categoryId: string;
  name: string;
  sortOrder: number;
  total: number;
  compareTotal: number | null;
  boxStats: BoxStats | null;
  expenses: CategoryExpense[];
};

export type MonthlySummary = {
  year: number;
  month: number;
  total: number;
  compareTotal: number | null;
  boxStats: BoxStats | null;
  categories: CategorySummary[];
};
