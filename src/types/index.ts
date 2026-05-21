export type Category = {
  id: string;
  name: string;
  sortOrder: number;
};

export type Expense = {
  id: string;
  categoryId: string;
  amount: number;
  spentAt: string;
  storeName: string | null;
  memo: string | null;
  receiptImageUrl: string | null;
  category: { id: string; name: string };
};

export type CategoryExpense = {
  id: string;
  amount: number;
  spentAt: string;
  storeName: string | null;
  memo: string | null;
};

export type CategorySummary = {
  categoryId: string;
  name: string;
  sortOrder: number;
  total: number;
  prevTotal: number;
  expenses: CategoryExpense[];
};

export type MonthlySummary = {
  year: number;
  month: number;
  total: number;
  prevTotal: number;
  categories: CategorySummary[];
};
