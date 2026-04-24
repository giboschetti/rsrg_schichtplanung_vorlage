import type { KalenderWoche } from '@/types';
import { TL_DAYS } from '@/types';

export const TL_MONTH_DE = ['Jan', 'Feb', 'Mär', 'Apr', 'Mai', 'Jun', 'Jul', 'Aug', 'Sep', 'Okt', 'Nov', 'Dez'];

export function parseLocalYMD(s: string | undefined | null): Date | null {
  if (!s || typeof s !== 'string') return null;
  const p = s.split('-');
  if (p.length !== 3) return null;
  const [y, m, d] = p.map(Number);
  if (!y || !m || !d) return null;
  const dt = new Date(y, m - 1, d);
  return isNaN(dt.getTime()) ? null : dt;
}

export function addDaysLocal(date: Date, n: number): Date {
  const x = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  x.setDate(x.getDate() + n);
  return x;
}

export function toYMD(d: Date | null): string {
  if (!d || isNaN(d.getTime())) return '';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

export function fmtDate(s: string | undefined | null): string {
  if (!s) return '';
  const [y, m, d] = s.split('-');
  return `${d}.${m}.${y}`;
}

/** ISO week Monday (local timezone) */
export function isoWeekMondayLocal(year: number, week: number): Date {
  const simple = new Date(year, 0, 1 + (week - 1) * 7);
  const monday = new Date(simple);
  const dow = simple.getDay();
  if (dow <= 4) monday.setDate(simple.getDate() - simple.getDay() + 1);
  else monday.setDate(simple.getDate() + 8 - simple.getDay());
  return monday;
}

export function mondayDateForKw(kw: KalenderWoche | undefined | null): Date | null {
  if (!kw) return null;
  const from = parseLocalYMD(kw.dateFrom);
  if (from) return from;
  if (kw.year != null && kw.num != null) return isoWeekMondayLocal(kw.year, kw.num);
  return null;
}

export function tlDayPlain(kw: KalenderWoche | undefined, dayIdx: number): string {
  const mon = mondayDateForKw(kw);
  if (!mon || dayIdx < 0 || dayIdx > 6) return TL_DAYS[dayIdx] ?? '';
  const d = addDaysLocal(mon, dayIdx);
  return `${TL_DAYS[dayIdx]} ${d.getDate()}.${TL_MONTH_DE[d.getMonth()]}`;
}

export function tlDayHeader(kw: KalenderWoche | undefined, dayIdx: number): { day: string; date: string } {
  const mon = mondayDateForKw(kw);
  const day = TL_DAYS[dayIdx] ?? '';
  if (!mon || dayIdx < 0 || dayIdx > 6) return { day, date: '' };
  const d = addDaysLocal(mon, dayIdx);
  return { day, date: `${d.getDate()}.${TL_MONTH_DE[d.getMonth()]}` };
}
