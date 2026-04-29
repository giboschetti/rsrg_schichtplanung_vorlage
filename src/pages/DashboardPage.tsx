import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuthContext } from '@/context/AuthContext';
import { listUserProjects, createProject, deleteProject } from '@/services/firestoreService';
import type { Project } from '@/types';

export default function DashboardPage() {
  const { user, loading: authLoading, signIn, signOut } = useAuthContext();
  const navigate = useNavigate();
  const [projects, setProjects] = useState<Project[]>([]);
  const [newName, setNewName] = useState('');
  const [status, setStatus] = useState('');
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!user) return;
    setLoading(true);
    listUserProjects(user.uid)
      .then(setProjects)
      .catch(() => setStatus('Fehler beim Laden der Projekte'))
      .finally(() => setLoading(false));
  }, [user]);

  async function handleCreate() {
    if (!user || !newName.trim()) return;
    setLoading(true);
    try {
      const p = await createProject(newName.trim(), user.uid);
      setProjects((prev) => [...prev, p]);
      setNewName('');
    } catch {
      setStatus('Fehler beim Erstellen');
    } finally {
      setLoading(false);
    }
  }

  async function handleDelete(id: string, name: string) {
    if (!confirm(`Projekt "${name}" löschen?`)) return;
    await deleteProject(id);
    setProjects((prev) => prev.filter((p) => p.id !== id));
  }

  if (authLoading) {
    return (
      <div className="flex items-center justify-center min-h-screen text-zinc-400">
        Laden…
      </div>
    );
  }

  return (
    <div className="min-h-screen" style={{ background: 'var(--color-bg, #f8f8f9)', fontFamily: 'var(--font-body, Inter, sans-serif)' }}>
      {/* Header */}
      <header style={{
        height: 56,
        background: '#fff',
        borderBottom: '2px solid #FF6300',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 24px',
        position: 'sticky',
        top: 0,
        zIndex: 50,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <div
            style={{
              width: 120,
              height: 32,
              flexShrink: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'flex-start',
            }}
          >
            <img
              src="https://raw.githubusercontent.com/giboschetti/rsrg_schichtplanung_vorlage/main/assets/logo-rhomberg-sersa.jpg"
              alt="RSRG"
              style={{ maxWidth: '100%', maxHeight: '100%', width: 'auto', height: 'auto', objectFit: 'contain', display: 'block' }}
              onError={(e) => { (e.target as HTMLImageElement).style.display = 'none'; }}
            />
          </div>
          <div style={{ width: 1, height: 28, background: '#e4e4e7' }} />
          <div>
            <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 16, color: '#09090b', lineHeight: 1.2 }}>
              Schichtplanung
            </div>
            <div style={{ fontSize: 11, color: '#71717a' }}>Projektübersicht</div>
          </div>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {user && (
            <span style={{ fontSize: 13, color: '#71717a' }}>{user.displayName ?? user.email}</span>
          )}
          {user && (
            <button
              onClick={() => signOut()}
              style={{
                padding: '6px 14px', borderRadius: 6, border: '1px solid #e4e4e7',
                background: '#fff', fontSize: 13, cursor: 'pointer', color: '#09090b',
              }}
            >
              Abmelden
            </button>
          )}
        </div>
      </header>

      <main style={{ maxWidth: 720, margin: '40px auto', padding: '0 24px' }}>
        {!user ? (
          <div style={{
            background: '#fff', borderRadius: 12, border: '1px solid #e4e4e7',
            padding: '40px 32px', textAlign: 'center',
          }}>
            <h2 style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 700, fontSize: 22, marginBottom: 8 }}>
              Willkommen bei RSRG Schichtplanung
            </h2>
            <p style={{ color: '#71717a', marginBottom: 24 }}>
              Bitte melden Sie sich an, um auf Ihre Projekte zuzugreifen.
            </p>
            <button
              onClick={() => signIn()}
              style={{
                padding: '10px 24px', borderRadius: 6, border: 'none',
                background: '#FF6300', color: '#fff', fontSize: 14, fontWeight: 600, cursor: 'pointer',
              }}
            >
              Mit Google anmelden
            </button>
          </div>
        ) : (
          <div style={{ background: '#fff', borderRadius: 12, border: '1px solid #e4e4e7', overflow: 'hidden' }}>
            <div style={{ padding: '16px 24px', borderBottom: '1px solid #e4e4e7' }}>
              <div style={{ fontFamily: 'Space Grotesk, sans-serif', fontWeight: 600, fontSize: 16 }}>
                Meine Projekte
              </div>
            </div>
            <div style={{ padding: '16px 24px' }}>
              <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
                <input
                  value={newName}
                  onChange={(e) => setNewName(e.target.value)}
                  onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
                  placeholder="Neues Projekt, z. B. SZU Zürich Los 1"
                  style={{
                    flex: 1, padding: '8px 12px', borderRadius: 6, border: '1px solid #e4e4e7',
                    fontSize: 14, outline: 'none', fontFamily: 'inherit',
                  }}
                />
                <button
                  onClick={handleCreate}
                  disabled={!newName.trim() || loading}
                  style={{
                    padding: '8px 16px', borderRadius: 6, border: 'none',
                    background: '#FF6300', color: '#fff', fontSize: 13, fontWeight: 600,
                    cursor: !newName.trim() || loading ? 'not-allowed' : 'pointer',
                    opacity: !newName.trim() || loading ? 0.6 : 1,
                  }}
                >
                  Erstellen
                </button>
              </div>
              {status && <div style={{ fontSize: 13, color: '#DC002E', marginBottom: 12 }}>{status}</div>}
              {loading && <div style={{ fontSize: 13, color: '#71717a' }}>Laden…</div>}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {projects.map((p) => (
                  <div
                    key={p.id}
                    style={{
                      display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                      padding: '12px 16px', borderRadius: 8, border: '1px solid #e4e4e7',
                      background: '#fafafa', cursor: 'pointer',
                    }}
                    onClick={() => navigate(`/project/${p.id}`)}
                  >
                    <div>
                      <div style={{ fontWeight: 500, fontSize: 14 }}>{p.name}</div>
                      <div style={{ fontSize: 11, color: '#71717a', marginTop: 2 }}>
                        {p.createdAt ? new Date(p.createdAt).toLocaleDateString('de-CH') : ''}
                      </div>
                    </div>
                    <button
                      onClick={(e) => { e.stopPropagation(); handleDelete(p.id, p.name); }}
                      style={{
                        padding: '4px 10px', borderRadius: 4, border: '1px solid #e4e4e7',
                        background: '#fff', fontSize: 12, color: '#DC002E', cursor: 'pointer',
                      }}
                    >
                      Löschen
                    </button>
                  </div>
                ))}
                {!loading && projects.length === 0 && (
                  <div style={{ fontSize: 13, color: '#71717a', textAlign: 'center', padding: '24px 0' }}>
                    Noch keine Projekte vorhanden.
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}
