import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useUiStore } from '@/stores/uiStore';

const MIN_W = 280;
const MIN_H = 200;
const HEADER_H = 40;

function clamp(n: number, min: number, max: number) {
  return Math.min(max, Math.max(min, n));
}

/**
 * Draggable, resizable floating window with an embedded PDF (BAB Datei URL).
 * Does not use a blocking backdrop so the timeline remains usable.
 */
export function IntervallePdfDialog() {
  const intervallePdf = useUiStore((s) => s.intervallePdf);
  const closeIntervallePdf = useUiStore((s) => s.closeIntervallePdf);

  const dragState = useRef<{
    active: 'drag' | 'resize' | null;
    startX: number;
    startY: number;
    origX: number;
    origY: number;
    origW: number;
    origH: number;
  }>({ active: null, startX: 0, startY: 0, origX: 0, origY: 0, origW: 0, origH: 0 });

  const [pos, setPos] = useState({ x: 60, y: 72 });
  const [size, setSize] = useState({ w: 520, h: 640 });

  useEffect(() => {
    if (!intervallePdf?.url) return;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    const w = 520;
    setPos({ x: clamp(vw - w - 32, 16, Math.max(16, vw - MIN_W - 8)), y: clamp(64, 16, vh - MIN_H) });
  }, [intervallePdf?.url]);

  useEffect(() => {
    if (!intervallePdf) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') closeIntervallePdf();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [intervallePdf, closeIntervallePdf]);

  const onMove = useCallback((e: MouseEvent) => {
    const st = dragState.current;
    if (!st.active) return;
    const dx = e.clientX - st.startX;
    const dy = e.clientY - st.startY;
    const vw = window.innerWidth;
    const vh = window.innerHeight;

    if (st.active === 'drag') {
      setPos({
        x: clamp(st.origX + dx, 0, vw - 64),
        y: clamp(st.origY + dy, 0, vh - HEADER_H),
      });
    } else if (st.active === 'resize') {
      setSize({
        w: clamp(st.origW + dx, MIN_W, vw - st.origX - 8),
        h: clamp(st.origH + dy, MIN_H, vh - st.origY - 8),
      });
    }
  }, []);

  const onUp = useCallback(() => {
    dragState.current.active = null;
    document.body.style.cursor = '';
    window.removeEventListener('mousemove', onMove);
    window.removeEventListener('mouseup', onUp);
  }, [onMove]);

  const startDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      active: 'drag',
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      origW: size.w,
      origH: size.h,
    };
    document.body.style.cursor = 'grabbing';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    dragState.current = {
      active: 'resize',
      startX: e.clientX,
      startY: e.clientY,
      origX: pos.x,
      origY: pos.y,
      origW: size.w,
      origH: size.h,
    };
    document.body.style.cursor = 'nwse-resize';
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  if (!intervallePdf) return null;

  const { url, label } = intervallePdf;
  const title = label?.trim() || 'BAB PDF';

  return createPortal(
    <div
      role="dialog"
      aria-label={title}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: size.h,
        zIndex: 180,
        display: 'flex',
        flexDirection: 'column',
        background: '#fff',
        borderRadius: 10,
        border: '1px solid #e4e4e7',
        boxShadow: '0 12px 40px rgba(0,0,0,0.18)',
        overflow: 'hidden',
        pointerEvents: 'auto',
        touchAction: 'none',
      }}
    >
      <div
        onMouseDown={startDrag}
        style={{
          height: HEADER_H,
          flexShrink: 0,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 8px 0 12px',
          background: 'linear-gradient(180deg, #fafafa, #f4f4f5)',
          borderBottom: '1px solid #e4e4e7',
          cursor: 'grab',
          userSelect: 'none',
        }}
      >
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: '#18181b',
            fontFamily: 'Space Grotesk, sans-serif',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            flex: 1,
            minWidth: 0,
          }}
          title={title}
        >
          {title}
        </span>
        <a
          href={url}
          target="_blank"
          rel="noopener noreferrer"
          onClick={(e) => e.stopPropagation()}
          style={{ fontSize: 11, color: '#2563eb', marginRight: 8, whiteSpace: 'nowrap' }}
        >
          Neuer Tab
        </a>
        <button
          type="button"
          onMouseDown={(e) => e.stopPropagation()}
          onClick={() => closeIntervallePdf()}
          style={{
            border: 'none',
            background: 'none',
            fontSize: 20,
            lineHeight: 1,
            cursor: 'pointer',
            color: '#71717a',
            padding: '2px 6px',
          }}
          title="Schließen (Esc)"
        >
          ×
        </button>
      </div>
      <div style={{ position: 'relative', flex: 1, minHeight: 0, background: '#e4e4e7' }}>
        <iframe
          title={title}
          src={url}
          style={{
            width: '100%',
            height: '100%',
            border: 'none',
            display: 'block',
            background: '#fff',
          }}
        />
        <div
          onMouseDown={startResize}
          style={{
            position: 'absolute',
            right: 0,
            bottom: 0,
            width: 18,
            height: 18,
            cursor: 'nwse-resize',
            zIndex: 2,
            background: 'linear-gradient(135deg, transparent 50%, #d4d4d8 50%)',
          }}
          title="Größe ändern"
          aria-hidden
        />
      </div>
    </div>,
    document.body,
  );
}
