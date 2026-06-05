import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

// 純粋関数（lib/*）のユニットテスト用の最小構成。
// `@/` エイリアスを src に解決し、Node 環境で実行する。
export default defineConfig({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  // .tsx テスト（コンポーネント）の JSX を React 自動ランタイムで変換する。
  esbuild: { jsx: "automatic" },
  test: {
    // 既定は node（純粋関数）。コンポーネントテストはファイル先頭の
    // `// @vitest-environment jsdom` で個別に jsdom に切り替える。
    environment: "node",
    include: ["src/**/*.test.{ts,tsx}"],
  },
});
