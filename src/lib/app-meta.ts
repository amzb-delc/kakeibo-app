// アプリのメタ情報。クライアントバンドルにも乗るので prisma 等を import しない。
// バージョンは package.json と手動で揃える（package.json を直 import すると
// 依存パッケージ一覧までバンドルに含まれてしまうため避ける）。

// TODO: 世帯名は DB から取得すべき。MVP は seed と揃えた固定値。
export const HOUSEHOLD_NAME = "我が家";
export const APP_VERSION = "0.1.0";
export const APP_LABEL = `${HOUSEHOLD_NAME}の家計簿 v${APP_VERSION}`;
