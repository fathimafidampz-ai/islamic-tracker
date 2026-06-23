import React, { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, useLocation, useNavigate } from 'react-router-dom';
import { Moon, CheckSquare, Calendar, PieChart, Users, Settings as SettingsIcon, AlertCircle, Shield } from 'lucide-react';
import { format } from 'date-fns';
import { supabase } from './lib/supabase';
import Auth from './pages/Auth';
import { startNotificationService, stopNotificationService } from './lib/notifications';

import Home from './pages/Home';
import Routines from './pages/Routines';
import Notes from './pages/Notes';
import Analytics from './pages/Analytics';
import Settings from './pages/Settings';
import Admin from './pages/Admin';

const BottomNav = ({ session }) => {
  const location = useLocation();
  const navigate = useNavigate();

  const navItems = [
    { path: '/', icon: Moon, label: 'Worship' },
    { path: '/routines', icon: CheckSquare, label: 'Routine' },
    { path: '/notes', icon: Calendar, label: 'Notes' },
    { path: '/analytics', icon: PieChart, label: 'Analytics' },
    { path: '/settings', icon: SettingsIcon, label: 'Settings' },
  ];

  if (session?.user?.email === 'fathimafidampz@gmail.com') {
    navItems.push({ path: '/admin', icon: Shield, label: 'Admin' });
  }

  const checkIncompleteDikrs = () => {
    const todayStr = format(new Date(), 'yyyy-MM-dd');
    const userId = session?.user?.id;
    const localCacheKey = userId ? `worship_cache_${userId}_${todayStr}` : `worship_cache_${todayStr}`;
    const cachedDataStr = localStorage.getItem(localCacheKey);
    if (!cachedDataStr) return false;
    
    const cachedData = JSON.parse(cachedDataStr);
    const prayers = ['fajr', 'dhuhr', 'asr', 'maghrib', 'isha'];
    
    for (const p of prayers) {
      const fardKey = `${p}_fard`;
      if (cachedData[fardKey] && cachedData[fardKey].is_completed) {
        const completedDikrs = Object.keys(cachedData).filter(k => k.startsWith(`${p}_dikr_`) && cachedData[k].is_completed);
        if (completedDikrs.length < 7) {
          return true; // Missing some dikrs!
        }
      }
    }
    return false;
  };

  // Intercept completely going out of the app (tab close, reload, external navigation)
  useEffect(() => {
    const handleBeforeUnload = (e) => {
      if (location.pathname === '/' && checkIncompleteDikrs()) {
        e.preventDefault();
        e.returnValue = ''; // Standard browser confirmation prompt
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => window.removeEventListener('beforeunload', handleBeforeUnload);
  }, [location.pathname, session]);

  const handleNavClick = (e, path) => {
    // Dispatch custom event to let active pages reset their nested/details state to root
    window.dispatchEvent(new CustomEvent('nav-click', { detail: { path } }));

    if (path === '/' && location.pathname !== '/') {
      e.preventDefault();
      if (window.history.state && window.history.state.idx > 0) {
        navigate(-1);
      } else {
        navigate('/', { replace: true });
      }
    }
  };

  return (
    <>
      <nav className="glass-nav" style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, 
        height: 'var(--nav-height)', display: 'flex', justifyContent: 'space-around', alignItems: 'center',
        paddingBottom: 'env(safe-area-inset-bottom)', zIndex: 50
      }}>
        {navItems.map((item) => (
          <NavLink
            key={item.path}
            to={item.path}
            replace={location.pathname !== '/'}
            onClick={(e) => handleNavClick(e, item.path)}
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
    </>
  );
};

import { syncOfflineData } from './lib/worshipLogic';

function App() {
  const [session, setSession] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initialize theme
    const savedTheme = localStorage.getItem('noor_theme') || 'light';
    document.documentElement.setAttribute('data-theme', savedTheme);

    const triggerSyncAndBroadcast = async (userId) => {
      try {
        await syncOfflineData(userId);
        const channel = supabase.channel('admin_realtime');
        channel.subscribe(async (status) => {
          if (status === 'SUBSCRIBED') {
            try {
              await channel.send({
                type: 'broadcast',
                event: 'task_update',
                payload: {}
              });
            } catch (sendErr) {
              console.error("Failed to send startup broadcast:", sendErr);
            } finally {
              supabase.removeChannel(channel);
            }
          }
        });
      } catch (err) {
        console.error("Sync and broadcast error:", err);
      }
    };

    let activeUserId = null;

    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
      if (session) {
        activeUserId = session.user.id;
        startNotificationService(session);
        triggerSyncAndBroadcast(session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      if (session) {
        activeUserId = session.user.id;
        startNotificationService(session);
        triggerSyncAndBroadcast(session.user.id);
      } else {
        activeUserId = null;
        stopNotificationService();
      }
    });

    const handleOnline = () => {
      if (activeUserId) {
        console.log("App came online, triggering sync...");
        triggerSyncAndBroadcast(activeUserId);
      }
    };

    window.addEventListener('online', handleOnline);

    return () => {
      subscription.unsubscribe();
      window.removeEventListener('online', handleOnline);
    };
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
          <Route path="/admin" element={<Admin session={session} />} />
        </Routes>
        <BottomNav session={session} />
      </div>
    </Router>
  );
}

export default App;
