import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ToastContainer } from '@/components/Toast';
import { useProject } from '@/hooks/useProject';
import { useUiStore } from '@/stores/uiStore';

// Lazy-loaded tab content — implemented in later units
function UebersichtTab() {
  return (
    <div style={{ padding: 24, color: '#71717a', fontSize: 14 }}>
      Timeline wird geladen…
    </div>
  );
}

function StammdatenTab() {
  return (
    <div style={{ padding: 24, color: '#71717a', fontSize: 14 }}>
      Stammdaten werden geladen…
    </div>
  );
}

const TABS = [
  { id: 'uebersicht', label: 'Übersicht' },
  { id: 'stammdaten', label: 'Stammdaten' },
];

export default function PlannerPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { loading, error, save, saving } = useProject(projectId);
  const activeTab = useUiStore((s) => s.activeTab);
  const setActiveTab = useUiStore((s) => s.setActiveTab);

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-zinc-400">
        Projekt wird geladen…
      </div>
    );
  }

  if (error) {
    return (
      <div className="flex items-center justify-center min-h-screen text-red-500">
        {error}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', minHeight: '100vh', background: '#f8f8f9' }}>
      <AppHeader onSave={save} saving={saving} />

      {/* Tab bar */}
      <div style={{
        background: '#fafafa',
        borderBottom: '1px solid #e4e4e7',
        display: 'flex',
        padding: '0 20px',
        gap: 4,
        flexShrink: 0,
      }}>
        {TABS.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            style={{
              padding: '10px 16px',
              border: 'none',
              background: 'none',
              fontSize: 13,
              fontWeight: activeTab === tab.id ? 600 : 400,
              color: activeTab === tab.id ? '#FF6300' : '#71717a',
              borderBottom: activeTab === tab.id ? '2px solid #FF6300' : '2px solid transparent',
              cursor: 'pointer',
              fontFamily: 'inherit',
              transition: 'color 0.15s',
              marginBottom: -1,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      <div style={{ flex: 1, overflow: 'auto' }}>
        {activeTab === 'uebersicht' && <UebersichtTab />}
        {activeTab === 'stammdaten' && <StammdatenTab />}
      </div>

      <ToastContainer />
    </div>
  );
}
