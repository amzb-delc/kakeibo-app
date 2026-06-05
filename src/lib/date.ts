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

// 数値を2桁ゼロ詰め（例: 3 → "03"）。
export const pad2 = (n: number) => String(n).padStart(2, "0");

// 指定月（month は 1-12）の末日。Date.UTC の day=0 は前月末＝当月末日になる。
export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

// 月を delta だけずらす（month は 1-12）。年跨ぎを正規化して返す。
export function shiftMonth(year: number, month: number, delta: number) {
  let y = year;
  let m = month + delta;
  while (m <= 0) {
    m += 12;
    y -= 1;
  }
  while (m > 12) {
    m -= 12;
    y += 1;
  }
  return { year: y, month: m };
}

// "YYYY-MM" 形式の月キー（month は 1-12）。
export function ymKey(year: number, month: number): string {
  return `${year}-${pad2(month)}`;
}

const WEEKDAYS_JA = ["日", "月", "火", "水", "木", "金", "土"];

export function formatJstDateLabel(date: Date): string {
  const s = formatJstDate(date); // JST の YYYY-MM-DD
  const [y, mo, d] = s.split("-").map(Number);
  // 曜日は JST の暦日から算出する。UTC midnight として扱えば曜日はその暦日と一致する
  // （`new Date("...T00:00:00+09:00").getUTCDay()` だと UTC では前日になり曜日が1日ずれる）。
  const day = new Date(Date.UTC(y, mo - 1, d)).getUTCDay();
  return `${mo}/${d}(${WEEKDAYS_JA[day]})`;
}
