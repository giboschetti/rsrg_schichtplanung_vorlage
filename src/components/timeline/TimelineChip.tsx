import type { MouseEvent } from 'react';
import {
  chipClassFromResStatus,
  chipTitle,
  getItemLabel,
} from '@/lib/workItemHelpers';
import type { SdpSection } from '@/types';

export function TimelineChip({
  item,
  section,
  selected,
  onIntervalleClick,
  onSelectMouseDown,
}: {
  item: unknown;
  section: SdpSection;
  selected?: boolean;
  onIntervalleClick?: (e: MouseEvent) => void;
  onSelectMouseDown?: (e: MouseEvent) => void;
}) {
  const it = item as Record<string, unknown>;
  const cls = chipClassFromResStatus(it, section);
  const label = getItemLabel(it, section).substring(0, 14);
  const tip = chipTitle(it, section) || label;
  const interactive = !!(onIntervalleClick || onSelectMouseDown);
  return (
    <span
      className={cls}
      title={tip}
      role={interactive ? 'button' : undefined}
      onMouseDown={(e) => {
        if (onSelectMouseDown) {
          e.stopPropagation();
          onSelectMouseDown(e);
        } else if (onIntervalleClick) {
          e.stopPropagation();
        }
      }}
      onClick={
        onIntervalleClick
          ? (e) => {
              e.stopPropagation();
              onIntervalleClick(e);
            }
          : onSelectMouseDown
            ? (e) => e.stopPropagation()
            : undefined
      }
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        padding: '1px 5px',
        borderRadius: 9999,
        fontSize: 10,
        fontWeight: 500,
        whiteSpace: 'nowrap',
        overflow: 'hidden',
        maxWidth: '100%',
        margin: '1px 0',
        cursor: interactive ? 'pointer' : undefined,
        boxShadow: selected ? '0 0 0 2px #FF6300' : undefined,
      }}
    >
      <span
        className="chip-dot"
        style={{ width: 5, height: 5, borderRadius: '50%', flexShrink: 0 }}
      />
      {label}
    </span>
  );
}
