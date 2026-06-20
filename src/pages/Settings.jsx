import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { User, Bell, Shield, Download, LogOut, ChevronRight, Moon, Send } from 'lucide-react';
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { generateDailyTasks } from '../lib/worshipLogic';
import { parseISO, format, subDays, differenceInDays } from 'date-fns';
import { sendNotification } from '../lib/notifications';

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

  const toggleNotifications = async () => {
    const newVal = !notificationsEnabled;
    
    if (newVal) {
      if (!('Notification' in window)) {
        alert('Notifications are not supported by this browser.');
        return;
      }
      
      const permission = await Notification.requestPermission();
      if (permission === 'granted') {
        setNotificationsEnabled(true);
        localStorage.setItem('noor_notifications', 'true');
        sendNotification('Notifications Activated 🌙', {
          body: 'Alhamdulillah, you will receive reminders for prayer times and daily recitations.'
        });
      } else {
        alert('Notification permission denied. Please allow notifications in your browser/PWA settings.');
        setNotificationsEnabled(false);
        localStorage.setItem('noor_notifications', 'false');
      }
    } else {
      setNotificationsEnabled(false);
      localStorage.setItem('noor_notifications', 'false');
    }
  };

  const sendTestNotification = () => {
    if (!('Notification' in window)) {
      alert('Notifications are not supported by this browser.');
      return;
    }
    if (Notification.permission !== 'granted') {
      alert(`Notification permission is currently "${Notification.permission}". Please toggle Notifications to request permission.`);
      return;
    }
    
    sendNotification('Test Notification 🌙', {
      body: 'Alhamdulillah, your notifications are working perfectly! You will receive daily worship reminders here.'
    });
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

  const handleExportData = () => {
    const doc = new jsPDF('landscape');
    doc.setFontSize(16);
    doc.text("Noor App - Detailed Activity Report", 14, 15);
    doc.setFontSize(10);
    doc.setTextColor(100);
    doc.text(`Generated on: ${new Date().toLocaleDateString()}`, 14, 22);

    const userId = session?.user?.id;
    const prefix = userId ? `worship_cache_${userId}_` : `worship_cache_`;
    let earliestDate = new Date();
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (key && key.startsWith(prefix)) {
        const dateStr = key.replace(prefix, '');
        const d = parseISO(dateStr);
        if (!isNaN(d) && d < earliestDate) {
          earliestDate = d;
        }
      }
    }

    const daysDiff = Math.max(0, differenceInDays(new Date(), earliestDate));
    const allDays = Array.from({ length: daysDiff + 1 }).map((_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd'));

    const tableData = [];
    const categories = ['Tahajjud', 'Fajr', 'Duha', 'Dhuhr', 'Asr', 'Maghrib', 'Isha', 'Recitation'];

    allDays.forEach(dateStr => {
      let localCache = {};
      try {
        const localCacheKey = userId ? `worship_cache_${userId}_${dateStr}` : `worship_cache_${dateStr}`;
        localCache = JSON.parse(localStorage.getItem(localCacheKey)) || {};
      } catch (e) {}
      
      const dayTasksRaw = generateDailyTasks(parseISO(dateStr));
      
      let overallCompleted = 0;
      let overallTotal = dayTasksRaw.length;
      
      const catStats = {};
      categories.forEach(c => catStats[c] = { comp: 0, tot: 0 });

      dayTasksRaw.forEach(task => {
        const isComp = localCache && localCache[task.id]?.is_completed;
        if (isComp) overallCompleted++;
        
        if (catStats[task.category]) {
          catStats[task.category].tot++;
          if (isComp) catStats[task.category].comp++;
        }
      });
      
      const overallScore = overallTotal === 0 ? 0 : Math.round((overallCompleted / overallTotal) * 100);
      
      const row = [
        dateStr,
        `${overallScore}%`
      ];

      categories.forEach(c => {
        const stats = catStats[c];
        const score = stats.tot === 0 ? '-' : `${Math.round((stats.comp / stats.tot) * 100)}%`;
        row.push(score);
      });

      tableData.push(row);
    });

    if (tableData.length === 0) {
      tableData.push(["No data recorded yet", "-", "-", "-", "-", "-", "-", "-", "-", "-"]);
    }

    autoTable(doc, {
      startY: 30,
      head: [['Date', 'Overall', ...categories]],
      body: tableData,
      theme: 'grid',
      styles: { fontSize: 9, cellPadding: 3, halign: 'center' },
      columnStyles: { 0: { halign: 'left' } },
      headStyles: { fillColor: [59, 130, 246] }
    });

    const exportFileDefaultName = `noor_detailed_report_${new Date().toISOString().split('T')[0]}.pdf`;
    doc.save(exportFileDefaultName);
  };

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
      {notificationsEnabled && (
        <SettingRow icon={Send} label="Send Test Notification" color="#10b981" onClick={sendTestNotification} />
      )}
      <p style={{ color: 'var(--text-muted)', fontSize: '0.75rem', padding: '0 8px', marginTop: '-4px', marginBottom: '16px', lineHeight: '1.4' }}>
        * Note: For notifications to work on mobile, please ensure you have added Noor to your Home Screen. On iOS, notifications are only supported when running as an installed PWA.
      </p>
      
      <h3 style={{ fontSize: '0.9rem', color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '1px', marginBottom: '12px', marginLeft: '4px', marginTop: '24px' }}>Data & Privacy</h3>
      <SettingRow icon={Download} label="Export My Data" color="#3b82f6" onClick={handleExportData} />

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
