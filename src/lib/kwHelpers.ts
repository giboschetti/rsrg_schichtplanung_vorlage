import type { KalenderWoche } from '@/types';
import { isoWeekMondayLocal, toYMD, addDaysLocal } from './dateHelpers';

export function generateKwId(year: number, num: number): string {
  return `kw-${year}-${String(num).padStart(2, '0')}`;
}

export function buildKw(year: number, num: number): KalenderWoche {
  const monday = isoWeekMondayLocal(year, num);
  const sunday = addDaysLocal(monday, 6);
  return {
    id: generateKwId(year, num),
    label: `KW ${num}/${year}`,
    year,
    num,
    dateFrom: toYMD(monday),
    dateTo: toYMD(sunday),
  };
}

export function getCurrentIsoWeek(): { year: number; num: number } {
  const now = new Date();
  const jan4 = new Date(now.getFullYear(), 0, 4);
  const startOfWeek = new Date(jan4);
  startOfWeek.setDate(jan4.getDate() - jan4.getDay() + 1);
  const diff = now.getTime() - startOfWeek.getTime();
  const week = Math.floor(diff / (7 * 24 * 60 * 60 * 1000)) + 1;
  return { year: now.getFullYear(), num: week };
}
