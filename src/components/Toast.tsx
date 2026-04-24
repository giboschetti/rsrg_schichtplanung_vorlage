import { useUiStore } from '@/stores/uiStore';

export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const dismiss = useUiStore((s) => s.dismissToast);

  if (!toasts.length) return null;

  return (
    <div style={{
      position: 'fixed', bottom: 80, right: 20, zIndex: 200,
      display: 'flex', flexDirection: 'column', gap: 8,
    }}>
      {toasts.map((t) => (
        <div
          key={t.id}
          onClick={() => dismiss(t.id)}
          style={{
            background: '#09090b', color: '#fff',
            padding: '10px 16px', borderRadius: 8,
            fontSize: 13, cursor: 'pointer', maxWidth: 320,
            boxShadow: '0 4px 12px rgba(0,0,0,0.2)',
          }}
        >
          {t.message}
        </div>
      ))}
    </div>
  );
}
