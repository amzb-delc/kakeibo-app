"use client";

import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { Home, BarChart3, Plus, type LucideIcon } from "lucide-react";

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
  const searchParams = useSearchParams();

  const isHome = pathname === "/";
  const isNewExpense = pathname.startsWith("/expenses/new");
  // /summary 配下と /expenses 配下（新規登録は除く）はサマリー文脈とみなす
  const isSummary =
    pathname === "/summary" ||
    pathname.startsWith("/summary/") ||
    (pathname.startsWith("/expenses") && !isNewExpense);

  // 新規登録への動線: 戻れるよう、現在URLを back クエリで渡す
  const currentSearch = searchParams.toString();
  const currentUrl = currentSearch ? `${pathname}?${currentSearch}` : pathname;
  const newExpenseHref = isNewExpense
    ? "/expenses/new"
    : `/expenses/new?back=${encodeURIComponent(currentUrl)}`;

  return (
    <nav
      aria-label="メインナビゲーション"
      className="fixed bottom-0 left-0 right-0 z-30 bg-card border-t border-border/50"
      style={{ paddingBottom: "env(safe-area-inset-bottom)" }}
    >
      <div className="relative flex items-stretch h-24">
        <Tab href="/" label="ホーム" active={isHome} Icon={Home} />
        <div className="w-32 shrink-0" aria-hidden="true" />
        <Tab href="/summary" label="サマリー" active={isSummary} Icon={BarChart3} />

        <Link
          href={newExpenseHref}
          aria-label="支出を登録"
          aria-current={isNewExpense ? "page" : undefined}
          className="absolute left-1/2 -translate-x-1/2 -top-11 w-[88px] h-[88px] rounded-full bg-gradient-to-br from-blue-500 to-blue-700 text-primary-foreground ring-8 ring-card shadow-[0_12px_28px_-6px_rgba(37,99,235,0.55),0_4px_8px_-2px_rgba(37,99,235,0.35)] flex items-center justify-center transition-all duration-200 ease-out active:scale-90 active:duration-75 active:shadow-[0_4px_10px_-2px_rgba(37,99,235,0.5)] active:translate-y-0.5 hover:from-blue-400 hover:to-blue-700 will-change-transform"
        >
          <Plus
            size={40}
            strokeWidth={3}
            strokeLinecap="round"
            aria-hidden="true"
          />
        </Link>
      </div>
    </nav>
  );
}
