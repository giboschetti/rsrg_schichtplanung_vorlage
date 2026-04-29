import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isHttpUrl(s: string | undefined | null): boolean {
  if (!s || typeof s !== 'string') return false;
  return /^https?:\/\//i.test(s.trim());
}

/** Prefer BAB-Datei; many projects store the PDF URL in BAB Titel instead. */
export function intervallePdfUrl(row: Record<string, unknown>): string {
  const d = typeof row.babDatei === 'string' ? row.babDatei.trim() : '';
  const t = typeof row.babTitel === 'string' ? row.babTitel.trim() : '';
  if (isHttpUrl(d)) return d;
  if (isHttpUrl(t)) return t;
  return '';
}
