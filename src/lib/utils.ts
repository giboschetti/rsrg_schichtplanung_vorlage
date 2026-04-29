import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isHttpUrl(s: string | undefined | null): boolean {
  if (!s || typeof s !== 'string') return false;
  return /^https?:\/\//i.test(s.trim());
}
