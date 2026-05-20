import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { APP_VERSION, HOUSEHOLD_NAME } from "@/lib/app-meta";

type Props = {
  /**
   * 文字列なら h1 で表示。ReactNode の場合は div 展開のため、
   * 利用元で別途 sr-only な h1 を用意することを推奨。
   */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** "/" 始まり以外は呼び出し元責任で弾く想定。PageHeader 内ではバリデーションしない。 */
  backHref?: string;
  right?: React.ReactNode;
};

export function PageHeader({ title, subtitle, backHref, right }: Props) {
  return (
    <header
      className="sticky top-0 z-10 bg-background border-b border-border/50"
      style={{ paddingTop: "env(safe-area-inset-top)" }}
    >
      {/* アプリラベルは装飾。SR には h1 / メタタイトル経由で十分伝わるので隠す。 */}
      <div className="text-center pt-1.5" aria-hidden="true">
        <span className="text-[11px] text-muted-foreground font-medium tracking-[0.18em]">
          {HOUSEHOLD_NAME}の家計簿{" "}
          <span className="opacity-60 tracking-normal">v{APP_VERSION}</span>
        </span>
      </div>
      <div className="flex items-center gap-1 px-2 pb-2 min-h-[44px]">
        <div className="w-11 shrink-0 flex justify-start">
          {backHref ? (
            <Link
              href={backHref}
              aria-label="戻る"
              className="w-11 h-11 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors"
            >
              <ChevronLeft size={26} strokeWidth={2.25} aria-hidden="true" />
            </Link>
          ) : null}
        </div>
        <div className="flex-1 text-center min-w-0">
          {typeof title === "string" ? (
            <h1 className="text-base font-semibold truncate">{title}</h1>
          ) : (
            <div className="text-base font-semibold">{title}</div>
          )}
          {subtitle && (
            <p className="text-[11px] text-muted-foreground mt-0.5">{subtitle}</p>
          )}
        </div>
        <div className="w-11 shrink-0 flex justify-end">{right}</div>
      </div>
    </header>
  );
}
