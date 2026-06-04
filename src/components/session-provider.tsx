"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";

// 合言葉ロックの状態をアプリ全体で共有する。
// 実際のデータ保護はサーバー（cookie + API の 401）が担い、ここはUX用の状態。
type ContextValue = {
  /** null=判定中, true=解錠済み, false=ロック中 */
  unlocked: boolean | null;
  householdName: string | null;
  /** 合言葉で解錠。成功で true */
  unlock: (passphrase: string) => Promise<boolean>;
  /** ロック（cookie 破棄） */
  lock: () => Promise<void>;
};

const SessionContext = createContext<ContextValue | null>(null);

export function useSession(): ContextValue {
  const ctx = useContext(SessionContext);
  if (!ctx) {
    throw new Error("useSession は SessionProvider の内側で使ってください");
  }
  return ctx;
}

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [unlocked, setUnlocked] = useState<boolean | null>(null);
  const [householdName, setHouseholdName] = useState<string | null>(null);

  // 起動時に現在の解錠状態を取得
  useEffect(() => {
    let alive = true;
    fetch("/api/session")
      .then((r) => (r.ok ? r.json() : { unlocked: false }))
      .then((d) => {
        if (!alive) return;
        setUnlocked(!!d.unlocked);
        setHouseholdName(d.householdName ?? null);
      })
      .catch(() => {
        if (alive) setUnlocked(false);
      });
    return () => {
      alive = false;
    };
  }, []);

  const unlock = useCallback(async (passphrase: string) => {
    const res = await fetch("/api/session", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ passphrase }),
    });
    if (!res.ok) return false;
    const d = await res.json().catch(() => null);
    setUnlocked(true);
    setHouseholdName(d?.householdName ?? null);
    return true;
  }, []);

  const lock = useCallback(async () => {
    await fetch("/api/session", { method: "DELETE" }).catch(() => {});
    setUnlocked(false);
    setHouseholdName(null);
  }, []);

  return (
    <SessionContext.Provider value={{ unlocked, householdName, unlock, lock }}>
      {children}
    </SessionContext.Provider>
  );
}
