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

export type CategorySummary = {
  categoryId: string;
  name: string;
  sortOrder: number;
  total: number;
  prevTotal: number;
};

export type MonthlySummary = {
  year: number;
  month: number;
  total: number;
  prevTotal: number;
  categories: CategorySummary[];
};
