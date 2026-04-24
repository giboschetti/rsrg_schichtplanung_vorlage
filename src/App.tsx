import { lazy, Suspense } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuthContext } from '@/context/AuthContext';

const DashboardPage = lazy(() => import('@/pages/DashboardPage'));
const PlannerPage = lazy(() => import('@/pages/PlannerPage'));

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthContext();
  if (loading) return <div className="flex items-center justify-center min-h-screen text-zinc-400">Laden…</div>;
  if (!user) return <Navigate to="/" replace />;
  return <>{children}</>;
}

function AppRoutes() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center min-h-screen text-zinc-400">Laden…</div>}>
      <Routes>
        <Route path="/" element={<DashboardPage />} />
        <Route
          path="/project/:projectId"
          element={
            <ProtectedRoute>
              <PlannerPage />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </Suspense>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </BrowserRouter>
  );
}
