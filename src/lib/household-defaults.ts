// seed が作成するデモ世帯の既定 id（= 既定の世帯コード）。
// 本番は seed → `npm run db:set-passphrase` で実コードへ付け替える運用のため、
// セットアップ後の本番にこの id の世帯は存在しない。set-passphrase 実行忘れの
// 事故（既定コードで誰でもログインできる状態）を塞ぐため、/api/session が本番で
// この値でのログインを拒否する（SEC-2）。
//
// ※ prisma/seed.ts のリテラルと一致させること（seed は @/ エイリアス不可のため
//   相対 import で参照する。category-constants と同じ流儀）。
export const DEFAULT_HOUSEHOLD_ID = "demo-household";
