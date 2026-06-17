import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink } from 'react-router-dom';
import { Moon, CheckSquare, Calendar, PieChart, Users, Settings as SettingsIcon } from 'lucide-react';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import { startNotificationService, stopNotificationService } from './lib/notifications';

import Home from './pages/Home';
import Routines from './pages/Routines';
import Notes from './pages/Notes';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';

const BottomNav = () => {
  const navItems = [
    { path: '/', icon: Moon, label: 'Worship' },
    { path: '/routines', icon: CheckSquare, label: 'Routine' },
    { path: '/notes', icon: Calendar, label: 'Notes' },
    { path: '/analytics', icon: PieChart, label: 'Analytics' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  return (
    <nav className="glass-nav" style={{
      position: 'fixed', bottom: 0, left: 0, right: 0, 
      height: 'var(--nav-height)', display: 'flex', justifyContent: 'space-around', alignItems: 'center',
      paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 50
    }}>
      {navItems.map((item) => (
        <NavLink
          key={item.path}
          to={item.path}
          style={({ isActive }) => ({
            display: 'flex', flexDirection: 'column', alignItems: 'center',
            textDecoration: 'none', gap: '4px',
            color: isActive ? 'var(--primary)' : 'var(--text-muted)',
            transition: 'color 0.2s ease'
          })}
        >
          <item.icon size={22} strokeWidth={2.5} />
          <span style={{ fontSize: '0.65rem', fontWeight: '500' }}>{item.label}</span>
        </NavLink>
      ))}
    </nav>
  );
};

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('noor_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) startNotificationService(session);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) startNotificationService(session);
      else stopNotificationService();
    });

    return () => subscription.unsubscribe();
  }, []);

  if (loading) {
    return <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', color: 'var(--text-muted)' }}>Loading...</div>;
  }

  if (!session) {
    return <Auth onLogin={() => {}} />;
  }

  return (
    <Router>
      <div style={{ minHeight: '100vh', position: 'relative' }}>
        <Routes>
          <Route path="/" element={<Home session={session} />} />
          <Route path="/routines" element={<Routines session={session} />} />
          <Route path="/notes" element={<Notes session={session} />} />
          <Route path="/analytics" element={<Analytics session={session} />} />
          <Route path="/settings" element={<Settings session={session} />} />
        </Routes>
        <BottomNav />
      </div>
    </Router>
  );
}

export default App;
