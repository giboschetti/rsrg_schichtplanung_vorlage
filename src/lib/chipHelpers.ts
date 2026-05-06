import type { SdpSection } from '@/types';

/**
 * Display helpers for timeline chips. These are the only functions
 * that map from a resource item to a visual representation.
 * Callers: TimelineChip only.
 */

export function getItemLabel(item: Record<string, unknown>, sectionId: SdpSection): string {
  if (sectionId === 'tasks') return (item.taetigkeit as string) || '–';
  if (sectionId === 'personal') return ((item.name as string) ?? '').trim() || '–';
  if (sectionId === 'inventar') return (item.geraet as string) || '–';
  if (sectionId === 'material') return (item.material as string) || '–';
  if (sectionId === 'fremdleistung') return (item.firma as string) || '–';
  if (sectionId === 'intervalle') {
    return (
      (item.babNr as string) ||
      (item.babTitel as string) ||
      (item.gleissperrungen as string) ||
      (item.status as string) ||
      '–'
    );
  }
  return '–';
}

export function chipClassFromResStatus(item: Record<string, unknown>, sectionId: SdpSection): string {
  if (sectionId === 'intervalle') {
    const v = item.status as string;
    if (v === 'Verständigt') return 'chip-bestaetigt';
    if (v === 'Entwurf' || v === 'Änderung') return 'chip-planung';
    if (v === 'Zusätzlicher Bedarf') return 'chip-anfrage';
    return 'chip-default';
  }
  const v = item.resStatus as string;
  if (v === 'Planung') return 'chip-planung';
  if (v === 'Bestellt') return 'chip-bestellt';
  if (v === 'Bestätigt') return 'chip-bestaetigt';
  if (v === 'Storniert') return 'chip-storniert';
  return 'chip-default';
}

export function chipTitle(item: Record<string, unknown>, sectionId: SdpSection): string {
  if (sectionId === 'tasks')
    return [(item.taetigkeit as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'personal') {
    const fn = ((item.funktion as string) ?? '').trim();
    const nm = ((item.name as string) ?? '').trim();
    const who = fn && nm ? `${fn} – ${nm}` : nm || fn;
    return [who, item.resStatus as string].filter(Boolean).join(' · ');
  }
  if (sectionId === 'inventar')
    return [(item.geraet as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'material')
    return [(item.material as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'fremdleistung')
    return [(item.firma as string), (item.leistung as string), (item.resStatus as string)].filter(Boolean).join(' · ');
  if (sectionId === 'intervalle')
    return [(item.babNr as string), (item.babTitel as string), (item.status as string)].filter(Boolean).join(' · ');
  return '';
}
