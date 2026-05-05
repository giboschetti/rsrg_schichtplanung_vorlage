import { TL_DAYS, TL_SHIFTS, type SdpSection } from '@/types';

/** Which groups appear in the timeline label column (order + default labels). */
export const TL_RESOURCE_GROUPS: { id: SdpSection; label: string }[] = [
  { id: 'intervalle', label: 'Intervalle' },
  { id: 'tasks', label: 'Tätigkeiten' },
  { id: 'personal', label: 'Personal' },
  { id: 'inventar', label: 'Inventar' },
  { id: 'material', label: 'Material' },
  { id: 'fremdleistung', label: 'Fremdleistung' },
];

export const COLS_PER_KW = TL_DAYS.length * TL_SHIFTS.length;
