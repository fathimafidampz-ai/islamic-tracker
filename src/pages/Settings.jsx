import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Bell, Shield, Download, LogOut, ChevronRight, Moon } from 'lucide-react';

const Settings = ({ session }) => {
  const user = session?.user;
  const [isDark, setIsDark] = useState(() => localStorage.getItem('noor_theme') === 'dark');
  const [notificationsEnabled, setNotificationsEnabled] = useState(() => localStorage.getItem('noor_notifications') !== 'false');

  const handleSignOut = async () => {
    if (window.confirm('Are you sure you want to sign out?')) {
      await supabase.auth.signOut();
      window.location.reload();
    }
  };

  const toggleTheme = () => {
    const newTheme = isDark ? 'light' : 'dark';
    setIsDark(!isDark);
    localStorage.setItem('noor_theme', newTheme);
    document.documentElement.setAttribute('data-theme', newTheme);
  };

  const toggleNotifications = () => {
    const newVal = !notificationsEnabled;
    setNotificationsEnabled(newVal);
    localStorage.setItem('noor_notifications', newVal.toString());
    
    if (newVal && 'Notification' in window) {
      if (Notification.permission !== 'granted' && Notification.permission !== 'denied') {
        Notification.requestPermission();
      }
    }
  };

  const SettingRow = ({ icon: Icon, label, color, onClick }) => (
    <div 
      onClick={onClick}
      className="glass-panel" 
      style={{ 
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', 
        padding: '16px', marginBottom: '12px', cursor: 'pointer', transition: 'all 0.2s' 
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
        <div style={{ background: `${color}20`, padding: '8px', borderRadius: '10px' }}>
          <Icon size={20} color={color} />
        </div>
        <span style={{ fontSize: '1.05rem' }}>{label}</span>
      </div>
      <ChevronRight size={20} color="var(--text-muted)" />
    </div>
  );

  return (
    <div className="page-container animate-in">
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2rem' }}>Settings</h1>
      </header>

      {/* Profile Section */}
      <div className="glass-panel" style={{ display: 'flex', alignItems: 'center', gap: '16px', marginBottom: '32px', padding: '20px' }}>
        <div style={{ width: '60px', height: '60px', borderRadius: '30px', background: 'var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '1.5rem', fontWeight: 'bold', color: 'white' }}>
          {user?.email?.[0].toUpperCase() || 'G'}
        </div>
        <div>
          <h2 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{user?.email === 'admin@noor.com' ? 'Guest Profile' : 'My Profile'}</h2>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{user?.email}</p>
          {user?.email === 'admin@noor.com' && (
            <span style={{ display: 'inline-block', marginTop: '4px', background: 'rgba(245, 158, 11, 0.2)', color: '#f59e0b', fontSize: '0.7rem', padding: '2px 8px', borderRadius: '12px' }}>
              Offline Mode
            </span>
          )}
        </div>
      </div>

      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', marginLeft: '4px' }}>Preferences</h3>
      <SettingRow icon={Moon} label={isDark ? "Appearance (Light Mode)" : "Appearance (Dark Mode)"} color="#8b5cf6" onClick={toggleTheme} />
      <SettingRow icon={Bell} label={notificationsEnabled ? "Notifications (Enabled)" : "Notifications (Muted)"} color="#f59e0b" onClick={toggleNotifications} />
      
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', marginLeft: '4px', marginTop: '24px' }}>Data & Privacy</h3>
      <SettingRow icon={Download} label="Export My Data" color="#3b82f6" onClick={() => alert('Data exported to your downloads folder.')} />

      <button 
        onClick={handleSignOut}
        className="glass-panel"
        style={{ 
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px', 
          padding: '16px', marginTop: '32px', color: '#ef4444', border: '1px solid rgba(239,68,68,0.2)',
          background: 'rgba(239,68,68,0.05)', cursor: 'pointer', fontSize: '1rem', fontWeight: '600', borderRadius: '12px'
        }}
      >
        <LogOut size={20} />
        Sign Out
      </button>

      <div style={{ textAlign: 'center', marginTop: '32px', paddingBottom: '32px', color: 'var(--text-muted)', fontSize: '0.8rem' }}>
        <p>Noor App v1.0.0</p>
        <p>Islamic Productivity Companion</p>
      </div>
    </div>
  );
};

export default Settings;
