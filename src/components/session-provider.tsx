"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import type { SessionStatus, SessionUnlockResult } from "@/types/api";

// 世帯コードの保存状態をアプリ全体で共有する。
// 実際のデータ保護はサーバー（cookie + API の 401）が担い、ここはUX用の状態。
type ContextValue = {
  /** null=判定中, true=保存済み, false=未保存 */
  unlocked: boolean | null;
  householdName: string | null;
  /** 世帯コードを保存。成功で true */
  unlock: (passphrase: string) => Promise<boolean>;
  /** クリア（cookie 破棄） */
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

  // 起動時に現在の保存状態を取得
  useEffect(() => {
    let alive = true;
    fetch("/api/session")
      .then((r) => (r.ok ? r.json() : { unlocked: false }))
      .then((d: SessionStatus) => {
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
    const d: SessionUnlockResult | null = await res.json().catch(() => null);
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
