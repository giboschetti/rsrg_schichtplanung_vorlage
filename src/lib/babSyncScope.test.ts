import { describe, expect, it } from 'vitest';
import {
  countPlannerCellsForBabClear,
  enumerateCanonicalShiftKeys,
  filterKwListForBabSync,
} from '@/lib/babSyncScope';
import type { KalenderWoche } from '@/types';

describe('babSyncScope', () => {
  it('enumerates 14 shift keys per KW (7 days × Tag/Nacht)', () => {
    const keys = enumerateCanonicalShiftKeys('kw_2026_32');
    expect(keys).toHaveLength(14);
    expect(keys).toContain('kw_2026_32__0__T');
    expect(keys).toContain('kw_2026_32__6__N');
  });

  it('filters KW list by numeric range like the Python sync CLI', () => {
    const kwList: KalenderWoche[] = [
      { id: 'kw_a', label: 'KW31', num: 31, year: 2026, dateFrom: '2026-07-27', dateTo: '2026-08-02' },
      { id: 'kw_b', label: 'KW32', num: 32, year: 2026, dateFrom: '2026-08-03', dateTo: '2026-08-09' },
      { id: 'kw_c', label: 'KW33', num: 33, year: 2026, dateFrom: '2026-08-10', dateTo: '2026-08-16' },
    ];
    expect(filterKwListForBabSync(kwList, 32, 32).map((k) => k.id)).toEqual(['kw_b']);
    expect(filterKwListForBabSync(kwList, undefined, undefined)).toHaveLength(3);
  });

  it('counts cells for clear scope (for progress / logging)', () => {
    const two = [
      { id: 'a', label: '', num: 1, year: 2026, dateFrom: '', dateTo: '' },
      { id: 'b', label: '', num: 2, year: 2026, dateFrom: '', dateTo: '' },
    ] satisfies KalenderWoche[];
    expect(countPlannerCellsForBabClear(two)).toBe(28);
  });
});
