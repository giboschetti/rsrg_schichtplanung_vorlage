import { useParams } from 'react-router-dom';
import { AppHeader } from '@/components/AppHeader';
import { ToastContainer } from '@/components/Toast';
import { ShiftDetailPanel } from '@/components/sdp/ShiftDetailPanel';
import { TimelineGrid } from '@/components/timeline/TimelineGrid';
import { TimelineFilterBar, KwToolbar } from '@/components/timeline/TimelineControls';
import { useProject } from '@/hooks/useProject';
import { useUiStore } from '@/stores/uiStore';
import { StammdatenPanel } from '@/components/StammdatenPanel';

function UebersichtTab() {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', padding: 16, gap: 12, overflow: 'hidden' }}>
      <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap', alignItems: 'flex-start' }}>
        <KwToolbar />
      </div>
      <TimelineFilterBar />
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column' }}>
        <TimelineGrid />
      </div>
    </div>
  );
}

function StammdatenTab() {
  return <StammdatenPanel />;
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

      <ShiftDetailPanel />
      <ToastContainer />
    </div>
  );
}
