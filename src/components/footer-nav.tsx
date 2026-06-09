"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Plus, Settings, type LucideIcon } from "lucide-react";
import { useExpenseModal } from "@/components/expense-modal";
import { useSettingsModal } from "@/components/settings-modal";
import { useSession } from "@/components/session-provider";

type TabProps = {
  href: string;
  label: string;
  active: boolean;
  Icon: LucideIcon;
};

function Tab({ href, label, active, Icon }: TabProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      aria-current={active ? "page" : undefined}
      className={`flex-1 flex items-center justify-center h-full min-h-[72px] transition-colors ${
        active ? "text-primary" : "text-muted-foreground"
      }`}
    >
      <Icon size={40} strokeWidth={active ? 2.5 : 2} aria-hidden="true" />
    </Link>
  );
}

export function FooterNav() {
  const pathname = usePathname();
  const { openCreate } = useExpenseModal();
  const { openSettings } = useSettingsModal();
  const { unlocked } = useSession();

  const isSummary = pathname === "/";

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border/50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative flex items-stretch h-24">
        <Tab href="/" label="サマリー" active={isSummary} Icon={BarChart3} />
        <div className="w-32 shrink-0" aria-hidden="true" />
        <button
          type="button"
          onClick={openSettings}
          aria-label={unlocked === false ? "設定（世帯コード未保存）" : "設定"}
          className="flex-1 flex items-center justify-center h-full min-h-[72px] text-muted-foreground hover:text-foreground transition-colors"
        >
          <span className="relative">
            <Settings size={40} strokeWidth={2} aria-hidden="true" />
            {/* 未保存（世帯コード未入力）はバッジで気づけるようにする */}
            {unlocked === false && (
              <span className="absolute -top-0.5 -right-0.5 w-3 h-3 rounded-full bg-red-500 ring-2 ring-card" />
            )}
          </span>
        </button>

        {/* 登録 FAB は未保存のときは出さない（未保存では登録できないため） */}
        {unlocked && (
          <button
            type="button"
            onClick={() => openCreate()}
            aria-label="支出を登録"
            className="absolute left-1/2 -translate-x-1/2 -top-11 w-[88px] h-[88px] rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-primary-foreground ring-8 ring-card shadow-[0_12px_28px_-6px_rgba(37,99,235,0.55),0_4px_8px_-2px_rgba(37,99,235,0.35)] flex items-center justify-center transition-all duration-200 ease-out active:scale-90 active:duration-75 active:shadow-[0_4px_10px_-2px_rgba(37,99,235,0.5)] active:translate-y-0.5 hover:from-blue-400 hover:to-blue-700 will-change-transform"
          >
            <Plus
              size={40}
              strokeWidth={3}
              strokeLinecap="round"
              aria-hidden="true"
            />
          </button>
        )}
      </div>
    </nav>
  );
}
