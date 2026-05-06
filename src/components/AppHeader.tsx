import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import { usePlannerStore } from '@/stores/plannerStore';
import { exportXlsx } from '@/lib/exportXlsx';
import { exportPdf } from '@/lib/exportPdf';

interface AppHeaderProps {
  syncing: boolean;
}

export function AppHeader({ syncing }: AppHeaderProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();
  const projectName = usePlannerStore((s) => s.projectName);
  const kwList = usePlannerStore((s) => s.kwList);
  const workItems = usePlannerStore((s) => s.workItems);

  return (
    <header style={{
      height: 56,
      background: '#fff',
      boxShadow: '0 2px 0 #FF6300',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'space-between',
      padding: '0 20px',
      position: 'sticky',
      top: 0,
      zIndex: 50,
      flexShrink: 0,
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
        <button
          type="button"
          onClick={() => navigate('/')}
          style={{
            width: 112,
            height: 32,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'flex-start',
            padding: 0,
            border: 'none',
            background: 'transparent',
            cursor: 'pointer',
          }}
          aria-label="Zurück zur Projektübersicht"
        >
          <img
            src="https://raw.githubusercontent.com/giboschetti/rsrg_schichtplanung_vorlage/main/assets/logo-rhomberg-sersa.jpg"
            alt=""
            style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
            onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
          />
        </button>
        <div style={{ width: 1, height: 24, background: '#e4e4e7' }} />
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, color: '#09090b' }}>
          {projectName || 'Schichtplanung'}
        </div>
        {syncing && (
          <span style={{ fontSize: 11, color: '#71717a', display: 'flex', alignItems: 'center', gap: 4 }}>
            <span style={{
              display: 'inline-block',
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: '#FF6300',
              opacity: 0.7,
              animation: 'pulse 1.2s ease-in-out infinite',
            }} />
            Speichern…
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={() => exportXlsx(projectName, kwList, workItems)}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e4e4e7', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#09090b' }}
        >
          XLSX
        </button>
        <button
          onClick={() => exportPdf(projectName, kwList, workItems)}
          style={{ padding: '5px 12px', borderRadius: 6, border: '1px solid #e4e4e7', background: '#fff', fontSize: 12, cursor: 'pointer', color: '#09090b' }}
        >
          PDF
        </button>
        {user && (
          <span style={{ fontSize: 12, color: '#71717a' }}>{user.displayName ?? user.email}</span>
        )}
        <button
          onClick={() => signOut()}
          style={{
            padding: '5px 12px', borderRadius: 6, border: '1px solid #e4e4e7',
            background: '#fff', fontSize: 12, cursor: 'pointer', color: '#09090b',
          }}
        >
          Abmelden
        </button>
      </div>
    </header>
  );
}
