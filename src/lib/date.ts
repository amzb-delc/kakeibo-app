// JST(Asia/Tokyo) でユーザーの「日付」を解釈する。
// MVP対象が日本ユーザーのため、サーバTZに依存しない計算をここに集約。

const JST_OFFSET_HOURS = 9;

export function jstMonthRange(year: number, month: number) {
  // JST 00:00 を UTC で表すと -9h 補正
  return {
    gte: new Date(Date.UTC(year, month - 1, 1, -JST_OFFSET_HOURS, 0, 0)),
    lt: new Date(Date.UTC(year, month, 1, -JST_OFFSET_HOURS, 0, 0)),
  };
}

const JST_FORMATTER = new Intl.DateTimeFormat("sv-SE", {
  timeZone: "Asia/Tokyo",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

export function formatJstDate(date: Date): string {
  // sv-SE ロケールは YYYY-MM-DD 形式
  return JST_FORMATTER.format(date);
}

export function todayJst(): string {
  return formatJstDate(new Date());
}

// "YYYY-MM-DD"（JST日付）を、その日の JST 00:00 を表す Date に変換
export function parseJstDate(value: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!m) return null;
  const [, y, mo, d] = m;
  return new Date(Date.UTC(Number(y), Number(mo) - 1, Number(d), -JST_OFFSET_HOURS, 0, 0));
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function formatJstDateLabel(date: Date): string {
  const s = formatJstDate(date);
  const day = new Date(`${s}T00:00:00+09:00`).getUTCDay();
  const [, mo, d] = s.split("-");
  return `${Number(mo)}/${Number(d)}(${WEEKDAYS_JA[day]})`;
}
