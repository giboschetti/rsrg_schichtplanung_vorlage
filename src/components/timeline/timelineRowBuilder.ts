import { getBauteileInUseForFachdienst } from '@/lib/workItemHelpers';
import type { TlFilterState } from '@/stores/uiStore';
import type { WorkItems, FachdienstBauteile } from '@/types';
import type { TlRowMeta } from '@/types/timeline';
import { TL_RESOURCE_GROUPS } from './timelineConstants';

export interface BuildTimelineRowsInput {
  tlFilter: TlFilterState;
  fachdienstTlFilter: Record<string, boolean>;
  tlCollapsed: Record<string, boolean>;
  usedFachdienste: string[];
  usedFunktionen: string[];
  workItems: WorkItems;
  fachdienstBauteile: FachdienstBauteile;
}

/**
 * Derives flattened label-column rows from filters + Stammdaten + aggregated work-items usage.
 * Pure — no hooks; callers supply memoised `used*` lists from `workItemHelpers`.
 */
export function buildTimelineRows(input: BuildTimelineRowsInput): TlRowMeta[] {
  const {
    tlFilter,
    fachdienstTlFilter,
    tlCollapsed,
    usedFachdienste,
    usedFunktionen,
    workItems,
    fachdienstBauteile,
  } = input;

  const result: TlRowMeta[] = [];

  TL_RESOURCE_GROUPS.forEach(({ id, label }) => {
    if (!tlFilter[id]) return;

    const collapsed = !!tlCollapsed[id];
    const hasChildren = id === 'tasks' || id === 'personal';

    if (hasChildren) {
      result.push({ kind: 'group-header', sectionId: id, groupId: id, label });
      if (!collapsed) {
        if (id === 'tasks') {
          usedFachdienste.forEach((fd) => {
            if (fachdienstTlFilter[fd] === false) return;
            result.push({
              kind: 'fachdienst',
              sectionId: 'tasks',
              groupId: id,
              label: fd,
              fachdienst: fd,
            });
            const bauteile = getBauteileInUseForFachdienst(
              workItems,
              fd,
              fachdienstBauteile[fd] ?? [],
            );
            bauteile.forEach((bt) => {
              result.push({
                kind: 'bauteil',
                sectionId: 'tasks',
                groupId: id,
                label: bt,
                fachdienst: fd,
                bauteil: bt,
              });
            });
          });
        }
        if (id === 'personal') {
          usedFunktionen.forEach((fn) => {
            result.push({
              kind: 'funktion',
              sectionId: 'personal',
              groupId: id,
              label: fn,
              funktion: fn,
            });
          });
        }
      }
    } else {
      result.push({ kind: 'simple', sectionId: id, groupId: id, label });
    }
  });

  return result;
}
