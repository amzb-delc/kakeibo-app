"use client";

import { useCallback, useEffect, useState } from "react";
import { useSession } from "@/components/session-provider";
import type { Category } from "@/types";

// 全カテゴリ（無効含む scope=all）を先読みしてアプリ全体で共有するキャッシュ。
// フォームの選択肢生成や名前解決に使う。
// - 未保存（cookie 無し）のときは /api/categories が 401 になるため取得しない。
//   保存された瞬間（unlocked→true）に取得する。
// - refresh() で version を増分し、カテゴリ管理での編集後に再取得する。
//
// 以前は ExpenseModalProvider に同居していた取得ロジックを切り出したもの。
export function useCategoryCache() {
  const { unlocked } = useSession();
  const [categories, setCategories] = useState<Category[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [version, setVersion] = useState(0);

  useEffect(() => {
    if (!unlocked) return;
    let alive = true;
    fetch("/api/categories?scope=all")
      .then((r) => (r.ok ? r.json() : []))
      .then((data: Category[]) => {
        if (alive) {
          setCategories(data);
          setLoaded(true);
        }
      })
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [unlocked, version]);

  const refresh = useCallback(() => setVersion((v) => v + 1), []);

  return { categories, loaded, version, refresh };
}
