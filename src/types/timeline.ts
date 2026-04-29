import type { SdpSection, ShiftId } from './index';

export type TlRowKind =
  | 'group-header'
  | 'fachdienst'
  | 'bauteil'
  | 'funktion'
  | 'simple';

/** One resource row in the timeline label column (matches `TimelineGrid` meta). */
export interface TlRowMeta {
  kind: TlRowKind;
  sectionId: SdpSection;
  groupId: string;
  label: string;
  fachdienst?: string;
  bauteil?: string;
  funktion?: string;
}

/** Stable reference to one badge (chip) in the grid. */
export interface TlBadgeRef {
  kwId: string;
  dayIdx: number;
  shift: ShiftId;
  sectionId: SdpSection;
  rowKind: TlRowKind;
  itemId: string;
  fachdienst?: string;
  bauteil?: string;
  funktion?: string;
}
