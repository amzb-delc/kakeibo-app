// API 入力検証の共通型。lib/expenses・lib/categories などで共有する。
export type ValidationError = { field: string; message: string };
