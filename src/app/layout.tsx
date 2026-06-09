import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { FooterNav } from "@/components/footer-nav";
import { SessionProvider } from "@/components/session-provider";
import { ExpenseModalProvider } from "@/components/expense-modal";
import { SettingsModalProvider } from "@/components/settings-modal";
import { StatementImportProvider } from "@/components/statement-import-provider";
import { HOUSEHOLD_NAME } from "@/lib/app-meta";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

// maximumScale は WCAG 2.1 SC 1.4.4 違反になるため設定しない。
// iOS Safari のフォーム自動ズーム回避は入力フィールド側を 16px 以上にすることで対応。
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

const APP_TITLE = `${HOUSEHOLD_NAME}の家計簿`;

export const metadata: Metadata = {
  title: APP_TITLE,
  description: "夫婦のための家計簿アプリ",
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: APP_TITLE,
  },
  manifest: "/manifest.json",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html
      lang="ja"
      className={`${geistSans.variable} ${geistMono.variable} h-full antialiased`}
    >
      <body className="min-h-full flex flex-col">
        <SessionProvider>
          <ExpenseModalProvider>
            <SettingsModalProvider>
              <StatementImportProvider>
                {/*
                  フッタ高 96px + FAB の上方はみ出し 44px + 余白 ≒ 144px(9rem) を確保。
                  末尾のコンテンツが FAB に隠れないようにするため。
                */}
                <div className="flex-1 pb-[calc(env(safe-area-inset-bottom)+9rem)]">
                  {children}
                </div>
                <FooterNav />
              </StatementImportProvider>
            </SettingsModalProvider>
          </ExpenseModalProvider>
        </SessionProvider>
      </body>
    </html>
  );
}
