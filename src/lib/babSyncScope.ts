import type { KalenderWoche } from '@/types';

const SHIFTS = ['T', 'N'] as const;
const DAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/** All canonical shift cell keys (`kwId__dayIdx__shiftId`) for one calendar week column set. */
export function enumerateCanonicalShiftKeys(kwId: string): string[] {
  const keys: string[] = [];
  for (const d of DAYS) {
    for (const s of SHIFTS) {
      keys.push(`${kwId}__${d}__${s}`);
    }
  }
  return keys;
}

/**
 * KW filter used by BAB sync / clear (same semantics as `bab_sync_firebase.py` CLI).
 */
export function filterKwListForBabSync(
  kwList: KalenderWoche[],
  kwFrom: number | null | undefined,
  kwTo: number | null | undefined,
): KalenderWoche[] {
  if (!kwFrom && !kwTo) return [...kwList];
  return kwList.filter((kw) => {
    const n = kw.num;
    if (kwFrom != null && kwFrom !== undefined && n < kwFrom) return false;
    if (kwTo != null && kwTo !== undefined && n > kwTo) return false;
    return true;
  });
}

/** Total canonical planner cells touched when clearing all shifts for the filtered weeks. */
export function countPlannerCellsForBabClear(kwSubset: KalenderWoche[]): number {
  const perKw = DAYS.length * SHIFTS.length;
  return kwSubset.length * perKw;
}
