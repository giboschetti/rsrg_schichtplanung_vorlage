import type { ShiftId } from '@/types';

/** Stable TanStack column id for one logical shift cell. */
export function timelineColId(kwId: string, dayIdx: number, shiftId: ShiftId): string {
  return `kw:${kwId}:d:${dayIdx}:s:${shiftId}`;
}
