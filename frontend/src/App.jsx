import React, { useState } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './features/auth/AuthContext';

// Pages
import Login from './pages/Login';
import Dashboard from './pages/Dashboard';
import History from './pages/History';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import SearchResults from './pages/Search';
import EngineeringReport from './pages/Report';

// Public Onboarding
import Welcome from './pages/Welcome';
import ProfileSetup from './pages/ProfileSetup';

// Repositories & Workspace
import RepositoryPage from './features/repositories/Repository';
import RepositoryDetail from './features/repositories/RepositoryDetail';

// Shell components
import AppShell from './components/AppShell';
import CommandPalette from './components/CommandPalette';
import NotificationsPanel from './components/NotificationsPanel';

import { useAuth } from './features/auth/AuthContext';

// Mock Auth wrapper for now, assuming we use AppShell for authenticated routes
function AuthenticatedLayout({ children }) {
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [notificationsOpen, setNotificationsOpen] = useState(false);
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex flex-col items-center justify-center gap-4">
        <img src="/optimus-logo.png" alt="OPTIMUS" className="w-12 h-12 object-contain animate-pulse" />
        <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin"></div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" replace />;
  }

  return (
    <AppShell 
      onOpenCommandPalette={() => setPaletteOpen(true)}
      onOpenNotifications={() => setNotificationsOpen(true)}
    >
      {children}
      <CommandPalette isOpen={paletteOpen} onClose={() => setPaletteOpen(false)} />
      <NotificationsPanel isOpen={notificationsOpen} onClose={() => setNotificationsOpen(false)} />
    </AppShell>
  );
}

function App() {
  return (
    <AuthProvider>
      <Router>
        <Routes>
          {/* Public & Onboarding */}
          <Route path="/" element={<Welcome />} />
          <Route path="/login" element={<Login />} />
          <Route path="/setup" element={<ProfileSetup />} />

          {/* Authenticated Routes wrapped in Shell */}
          <Route path="/dashboard" element={<AuthenticatedLayout><Dashboard /></AuthenticatedLayout>} />
          <Route path="/repositories" element={<AuthenticatedLayout><RepositoryPage /></AuthenticatedLayout>} />
          <Route path="/repositories/:id" element={<AuthenticatedLayout><RepositoryDetail /></AuthenticatedLayout>} />
          <Route path="/search" element={<AuthenticatedLayout><SearchResults /></AuthenticatedLayout>} />
          
          <Route path="/history" element={<AuthenticatedLayout><History /></AuthenticatedLayout>} />
          <Route path="/report/:id" element={<AuthenticatedLayout><EngineeringReport /></AuthenticatedLayout>} />
          <Route path="/analytics" element={<AuthenticatedLayout><Analytics /></AuthenticatedLayout>} />
          <Route path="/settings" element={<AuthenticatedLayout><Settings /></AuthenticatedLayout>} />
          
          {/* Catch all */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </Router>
    </AuthProvider>
  );
}

export default App;
