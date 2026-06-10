"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { categoryColor } from "@/lib/category-color";
import { CATEGORY_NAME_MAX, isRequiredSlot } from "@/lib/category-constants";
import { useExpenseModal } from "@/components/expense-modal";
import { Switch } from "@/components/ui/switch";
import type { Category } from "@/types";

export function CategoryManager() {
  const [categories, setCategories] = useState<Category[] | null>(null);
  const [loadError, setLoadError] = useState(false);
  // 行ごとの編集中の名前（id -> 入力値）
  const [drafts, setDrafts] = useState<Record<string, string>>({});
  const [rowError, setRowError] = useState<Record<string, string>>({});
  const [savingId, setSavingId] = useState<string | null>(null);
  // 日本語IMEの変換中フラグ（変換確定 Enter での誤送信を防ぐ）
  const composingRef = useRef(false);
  // 編集後、登録モーダルの先読みカテゴリを再取得させる
  const { refreshCategories } = useExpenseModal();

  // マウント時に全16スロットを取得（scope=all で無効スロットも含む）
  useEffect(() => {
    let alive = true;
    (async () => {
      try {
        const res = await fetch("/api/categories?scope=all");
        if (!res.ok) throw new Error("failed");
        const data: Category[] = await res.json();
        if (!alive) return;
        setCategories(data);
        setDrafts(Object.fromEntries(data.map((c) => [c.id, c.name])));
      } catch {
        if (alive) setLoadError(true);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  const patch = useCallback(
    async (id: string, body: { name?: string; enabled?: boolean }) => {
      setSavingId(id);
      setRowError((p) => ({ ...p, [id]: "" }));
      try {
        const res = await fetch(`/api/categories/${id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        });
        if (!res.ok) {
          const j = await res.json().catch(() => null);
          setRowError((p) => ({ ...p, [id]: j?.error ?? "保存に失敗しました" }));
          return false;
        }
        const updated: Category = await res.json();
        setCategories((prev) =>
          prev ? prev.map((c) => (c.id === id ? updated : c)) : prev
        );
        setDrafts((p) => ({ ...p, [id]: updated.name }));
        // 登録/編集モーダルの選択肢へ反映させる
        refreshCategories();
        return true;
      } catch {
        setRowError((p) => ({ ...p, [id]: "保存に失敗しました" }));
        return false;
      } finally {
        setSavingId(null);
      }
    },
    [refreshCategories]
  );

  // 名前: フォーカスを外したタイミングで、変更があれば保存
  const commitName = useCallback(
    (cat: Category) => {
      const next = (drafts[cat.id] ?? "").trim();
      if (next === cat.name) return; // 変更なし
      if (next.length === 0) {
        // 空は確定させず元に戻す
        setDrafts((p) => ({ ...p, [cat.id]: cat.name }));
        setRowError((p) => ({ ...p, [cat.id]: "" }));
        return;
      }
      patch(cat.id, { name: next });
    },
    [drafts, patch]
  );

  const toggleEnabled = useCallback(
    (cat: Category) => {
      patch(cat.id, { enabled: !cat.enabled });
    },
    [patch]
  );

  if (loadError) {
    return (
      <p className="text-xs text-destructive">カテゴリの取得に失敗しました。</p>
    );
  }
  if (!categories) {
    return <p className="text-xs text-muted-foreground">読み込み中…</p>;
  }

  return (
    <ul className="space-y-2">
      {categories.map((cat) => {
        const color = categoryColor(cat.sortOrder);
        const busy = savingId === cat.id;
        const required = isRequiredSlot(cat.sortOrder);
        return (
          <li key={cat.id} className="space-y-1">
            <div className="flex items-center gap-2">
              <span
                aria-hidden="true"
                className={`h-2.5 w-2.5 shrink-0 rounded-full ${color.bar} ${
                  cat.enabled ? "" : "opacity-30"
                }`}
              />
              <input
                type="text"
                value={drafts[cat.id] ?? ""}
                maxLength={CATEGORY_NAME_MAX}
                // 無効カテゴリは名前編集不可（ONにしてからリネームする導線）。必須は常にON＝編集可。
                disabled={busy || !cat.enabled}
                onChange={(e) =>
                  setDrafts((p) => ({ ...p, [cat.id]: e.target.value }))
                }
                onCompositionStart={() => {
                  composingRef.current = true;
                }}
                onCompositionEnd={() => {
                  composingRef.current = false;
                }}
                onBlur={() => commitName(cat)}
                onKeyDown={(e) => {
                  if (e.key === "Enter" && !composingRef.current) {
                    e.currentTarget.blur();
                  }
                }}
                // text-base(16px): iOS Safari は font-size<16px の入力でフォーカス時に自動ズームするため
                className={`flex-1 min-w-0 h-10 px-3 rounded-lg border bg-background text-base outline-none focus:ring-2 focus:ring-primary/30 disabled:opacity-50 ${
                  cat.enabled
                    ? "border-border"
                    : "border-border/50 text-muted-foreground"
                }`}
              />
              {/* 有効/無効トグル。共有 Switch（sm）を使う。必須スロット（先頭4個）は
                  disabled + checked で「ON固定・グレーアウト」のロック表示にする。 */}
              <Switch
                size="sm"
                checked={required ? true : cat.enabled}
                disabled={busy || required}
                onCheckedChange={() => {
                  if (!required) toggleEnabled(cat);
                }}
                aria-label={
                  required
                    ? `${cat.name}（必須・常にオン）`
                    : `${cat.name} を${cat.enabled ? "無効" : "有効"}にする`
                }
                title={required ? "必須カテゴリ（常にオン）" : undefined}
              />
            </div>
            {rowError[cat.id] && (
              <p className="pl-[18px] text-xs text-destructive">{rowError[cat.id]}</p>
            )}
          </li>
        );
      })}
    </ul>
  );
}
