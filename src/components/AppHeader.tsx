import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import { usePlannerStore } from '@/stores/plannerStore';

interface AppHeaderProps {
  onSave: () => void;
  saving: boolean;
}

export function AppHeader({ onSave, saving }: AppHeaderProps) {
  const navigate = useNavigate();
  const { user, signOut } = useAuthContext();
  const projectName = usePlannerStore((s) => s.projectName);
  const dirty = usePlannerStore((s) => s.dirty);

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
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <img
          src="https://raw.githubusercontent.com/giboschetti/rsrg_schichtplanung_vorlage/main/assets/logo-rhomberg-sersa.jpg"
          alt="RSRG"
          height={28}
          style={{ display: 'block', objectFit: 'contain', cursor: 'pointer' }}
          onClick={() => navigate('/')}
          onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
        />
        <div style={{ width: 1, height: 24, background: '#e4e4e7' }} />
        <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 15, color: '#09090b' }}>
          {projectName || 'Schichtplanung'}
        </div>
        {dirty && (
          <span style={{ fontSize: 11, color: '#a16207', background: '#fef9c3', borderRadius: 9999, padding: '2px 8px' }}>
            Ungespeichert
          </span>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <button
          onClick={onSave}
          disabled={saving || !dirty}
          style={{
            padding: '5px 14px', borderRadius: 6, border: 'none',
            background: dirty ? '#FF6300' : '#e4e4e7',
            color: dirty ? '#fff' : '#71717a',
            fontSize: 13, fontWeight: 600, cursor: saving || !dirty ? 'default' : 'pointer',
          }}
        >
          {saving ? 'Speichern…' : 'Speichern'}
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
