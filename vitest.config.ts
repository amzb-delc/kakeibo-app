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
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
