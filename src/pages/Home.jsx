import React, { useState, useEffect, useRef } from 'react';
import { supabase } from '../lib/supabase';
import { generateDailyTasks } from '../lib/worshipLogic';
import { format } from 'date-fns';
import { CheckCircle2, Circle, ChevronRight, X, RefreshCw, Plus, Bell } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import { sendNotification } from '../lib/notifications';
import { getBenefitsForTask } from '../lib/benefitsData';

const Home = ({ session }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [progress, setProgress] = useState(0);
  const [isOffline, setIsOffline] = useState(() => {
    return !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
  });

  // Modal State
  const [activeTask, setActiveTask] = useState(null);
  const [counterValue, setCounterValue] = useState(0);
  const [showBenefits, setShowBenefits] = useState(false);
  const modalRef = useRef(null);

  // Reset modal scroll to top when activeTask changes
  useEffect(() => {
    if (activeTask) {
      const timer = setTimeout(() => {
        if (modalRef.current) {
          modalRef.current.scrollTop = 0;
        }
      }, 50);
      return () => clearTimeout(timer);
    } else {
      setShowBenefits(false);
    }
  }, [activeTask]);
  const [showNotifBanner, setShowNotifBanner] = useState(() => {
    if (!('Notification' in window)) return false;
    if (Notification.permission === 'granted' || Notification.permission === 'denied') return false;
    return localStorage.getItem('noor_dismissed_notif_banner') !== 'true';
  });

  const requestNotifPermission = async () => {
    if (!('Notification' in window)) return;
    const permission = await Notification.requestPermission();
    if (permission === 'granted') {
      localStorage.setItem('noor_notifications', 'true');
      sendNotification('Notifications Activated 🌙', {
        body: 'Alhamdulillah, you will receive reminders for prayer times and daily recitations.'
      });
    } else {
      localStorage.setItem('noor_notifications', 'false');
    }
    setShowNotifBanner(false);
  };

  const todayStr = format(new Date(), 'yyyy-MM-dd');
  const benefits = activeTask ? getBenefitsForTask(activeTask.id) : null;

  // Auto-complete counter when target is reached
  useEffect(() => {
    if (activeTask && activeTask.type === 'counter' && counterValue >= activeTask.target) {
      const timer = setTimeout(() => {
        submitModalTask();
      }, 500); // 500ms delay so user sees they hit the goal
      return () => clearTimeout(timer);
    }
  }, [counterValue, activeTask]);

  // Reset sub-state/modal when Home/Worship nav is clicked again
  useEffect(() => {
    const handleNavClickEvent = (e) => {
      if (e.detail?.path === '/') {
        setActiveTask(null);
      }
    };
    window.addEventListener('nav-click', handleNavClickEvent);
    return () => window.removeEventListener('nav-click', handleNavClickEvent);
  }, []);

  const fetchTodayData = async () => {
    const generatedTasks = generateDailyTasks();
    const userId = session?.user?.id;
    
    // Load from local storage as a primary fallback
    const localCacheKey = userId ? `worship_cache_${userId}_${todayStr}` : `worship_cache_${todayStr}`;
    const cachedDataStr = localStorage.getItem(localCacheKey);
    let cachedData = cachedDataStr ? JSON.parse(cachedDataStr) : {};

    if (!userId || isOffline) {
      // If no user, just use local storage
      const fallbackTasks = generatedTasks.map(task => ({
        ...task,
        is_completed: cachedData[task.id]?.is_completed || false,
        count_reached: cachedData[task.id]?.count_reached || 0
      }));
      setTasks(fallbackTasks);
      calculateProgress(fallbackTasks);
      setLoading(false);
      return;
    }

    try {
      let { data: record, error: selectError } = await supabase.from('worship_records').select('*').eq('user_id', userId).eq('record_date', todayStr).maybeSingle();
      if (selectError) throw selectError;

      if (!record) {
        const { data: newRecord, error: insertError } = await supabase.from('worship_records').insert({ user_id: userId, record_date: todayStr }).select().single();
        if (insertError) throw insertError;
        record = newRecord;
      }

      const { data: completions, error: compError } = await supabase.from('task_completions').select('*').eq('worship_record_id', record.id);
      if (compError) throw compError;

      const tasksToSync = [];
      const tasksToDelete = [];
      const merged = generatedTasks.map(task => {
        const dbState = completions?.find(c => c.task_id === task.id);
        const cacheState = cachedData[task.id];
        
        const cacheIsCompleted = cacheState?.is_completed || false;
        const cacheCountReached = cacheState?.count_reached || 0;
        
        const dbIsCompleted = dbState?.is_completed || false;
        const dbCountReached = dbState?.count_reached || 0;
        
        const isCompleted = cacheState ? cacheIsCompleted : dbIsCompleted;
        const countReached = cacheState ? cacheCountReached : dbCountReached;

        if (cacheState) {
          if (cacheIsCompleted || cacheCountReached > 0) {
            if (!dbState || dbIsCompleted !== cacheIsCompleted || dbCountReached !== cacheCountReached) {
              tasksToSync.push({
                worship_record_id: record.id,
                task_id: task.id,
                is_completed: cacheIsCompleted,
                count_reached: cacheCountReached,
                completed_at: cacheIsCompleted ? (dbState?.completed_at || new Date().toISOString()) : null
              });
            }
          } else {
            if (dbState) {
              tasksToDelete.push(task.id);
            }
          }
        }
        
        return {
          ...task,
          worship_record_id: record.id,
          is_completed: isCompleted,
          count_reached: countReached,
        };
      });

      setTasks(merged);
      calculateProgress(merged);
      setIsOffline(false);

      if (tasksToSync.length > 0) {
        supabase.from('task_completions')
          .upsert(tasksToSync, { onConflict: 'worship_record_id, task_id' })
          .then(() => {
            console.log(`Synced ${tasksToSync.length} cache tasks to DB`);
            broadcastUpdate();
          })
          .catch(err => console.error("Error syncing cache tasks to DB:", err));
      }

      if (tasksToDelete.length > 0) {
        supabase.from('task_completions')
          .delete()
          .eq('worship_record_id', record.id)
          .in('task_id', tasksToDelete)
          .then(() => {
            console.log(`Deleted ${tasksToDelete.length} tasks from DB`);
            broadcastUpdate();
          })
          .catch(err => console.error("Error deleting tasks from DB:", err));
      }
    } catch (err) {
      console.error("DB Error:", err);
      setIsOffline(true);
      // Fallback heavily to local storage if DB fails due to mock auth
      const fallbackTasks = generatedTasks.map(task => ({
        ...task,
        is_completed: cachedData[task.id]?.is_completed || false,
        count_reached: cachedData[task.id]?.count_reached || 0
      }));
      setTasks(fallbackTasks);
      calculateProgress(fallbackTasks);
    } finally {
      setLoading(false);
    }
  };

  const calculateProgress = (currentTasks) => {
    const total = currentTasks.length;
    const completed = currentTasks.filter(t => t.is_completed).length;
    setProgress(total === 0 ? 0 : Math.round((completed / total) * 100));
  };

  // Initialize a broadcast channel
  const [broadcastChannel, setBroadcastChannel] = useState(null);

  useEffect(() => {
    fetchTodayData();

    // Ensure we clean up any pre-existing channel of the same name first
    const existingChannel = supabase.getChannels().find(c => c.topic === 'realtime:admin_realtime');
    if (existingChannel) {
      supabase.removeChannel(existingChannel);
    }

    const channel = supabase.channel('admin_realtime', {
      config: {
        broadcast: { self: true }
      }
    })
    .on('broadcast', { event: 'task_update' }, () => {
      fetchTodayData();
    });
    channel.subscribe();
    setBroadcastChannel(channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const broadcastUpdate = () => {
    if (broadcastChannel) {
      broadcastChannel.send({
        type: 'broadcast',
        event: 'task_update',
        payload: {}
      }).catch(console.error);
    }
  };

  const toggleTask = async (task, forcedValue = null) => {
    const newVal = forcedValue !== null ? forcedValue : !task.is_completed;
    const currentCount = task.type === 'counter' ? (forcedValue ? task.target : 0) : 0;
    
    // Optimistic UI Update
    const newTasks = tasks.map(t => t.id === task.id ? { ...t, is_completed: newVal, count_reached: currentCount } : t);
    setTasks(newTasks);
    calculateProgress(newTasks);

    // Save to LocalStorage immediately
    const userId = session?.user?.id;
    const localCacheKey = userId ? `worship_cache_${userId}_${todayStr}` : `worship_cache_${todayStr}`;
    const existingCache = JSON.parse(localStorage.getItem(localCacheKey) || '{}');
    existingCache[task.id] = { is_completed: newVal, count_reached: currentCount };
    localStorage.setItem(localCacheKey, JSON.stringify(existingCache));

    // Try DB Update
    let recordId = task.worship_record_id;
    if (!recordId && userId && !isOffline) {
      try {
        let { data: record } = await supabase.from('worship_records').select('*').eq('user_id', userId).eq('record_date', todayStr).maybeSingle();
        if (!record) {
          const { data: newRecord } = await supabase.from('worship_records').insert({ user_id: userId, record_date: todayStr }).select().single();
          record = newRecord;
        }
        if (record) {
          recordId = record.id;
          // Update tasks in local state with resolved record id
          setTasks(prev => prev.map(t => ({ ...t, worship_record_id: record.id })));
        }
      } catch (e) {
        console.error("Failed to dynamically create/fetch worship record:", e);
      }
    }

    if (recordId) {
      if (newVal) {
        await supabase.from('task_completions').upsert({
          worship_record_id: recordId,
          task_id: task.id,
          is_completed: newVal,
          count_reached: currentCount,
          completed_at: new Date().toISOString()
        }, { onConflict: 'worship_record_id, task_id' }).catch(err => {
          console.error("UPSERT ERROR:", err);
          alert("DB Error: " + err.message);
        });
      } else {
        await supabase.from('task_completions').delete()
          .eq('worship_record_id', recordId)
          .eq('task_id', task.id)
          .catch(err => console.error("DELETE ERROR:", err));
      }
      broadcastUpdate();
    }
  };

  const handleTaskAction = (task) => {
    if (task.is_completed) {
      toggleTask(task, false); // Allow unchecking directly
      return;
    }

    const hasBenefits = getBenefitsForTask(task.id);

    if (task.type === 'counter' || task.type === 'content' || hasBenefits) {
      setActiveTask(task);
      if (task.type === 'counter') {
        setCounterValue(task.count_reached || 0);
      }
      if (task.type === 'checkbox' && hasBenefits) {
        setShowBenefits(true);
      } else {
        setShowBenefits(false);
      }
    } else {
      toggleTask(task);
    }
  };

  const updateCounterProgress = async (newCount) => {
    setCounterValue(newCount);
    
    // Update local state so background list updates instantly
    const newTasks = tasks.map(t => t.id === activeTask.id ? { ...t, count_reached: newCount } : t);
    setTasks(newTasks);

    // Save to LocalStorage immediately
    const userId = session?.user?.id;
    const localCacheKey = userId ? `worship_cache_${userId}_${todayStr}` : `worship_cache_${todayStr}`;
    const existingCache = JSON.parse(localStorage.getItem(localCacheKey) || '{}');
    const existingEntry = existingCache[activeTask.id] || { is_completed: false };
    existingCache[activeTask.id] = { ...existingEntry, count_reached: newCount };
    localStorage.setItem(localCacheKey, JSON.stringify(existingCache));

    // Try DB Update
    if (activeTask.worship_record_id) {
      try {
        if (newCount === 0 && !existingEntry.is_completed) {
          await supabase.from('task_completions').delete()
            .eq('worship_record_id', activeTask.worship_record_id)
            .eq('task_id', activeTask.id);
        } else {
          await supabase.from('task_completions').upsert({
            worship_record_id: activeTask.worship_record_id,
            task_id: activeTask.id,
            count_reached: newCount,
            is_completed: existingEntry.is_completed // Preserve existing completion status
          }, { onConflict: 'worship_record_id, task_id' });
        }
        broadcastUpdate();
      } catch (err) {
        console.error("Failed to update counter in DB:", err);
      }
    }
  };

  const submitModalTask = () => {
    toggleTask(activeTask, true);
    setActiveTask(null);
  };

  const groupedTasks = tasks.reduce((acc, task) => {
    if (!acc[task.category]) acc[task.category] = [];
    acc[task.category].push(task);
    return acc;
  }, {});

  if (loading) return <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center' }}>Loading...</div>;

  return (
    <div className="page-container animate-in">
      {isOffline && (
        <div style={{
          background: 'rgba(239, 68, 68, 0.1)',
          border: '1px solid rgba(239, 68, 68, 0.2)',
          color: '#fca5a5',
          padding: '12px 16px',
          borderRadius: '12px',
          marginBottom: '20px',
          fontSize: '0.85rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '4px'
        }}>
          <strong>⚠️ Disconnected from Database (Offline Mode)</strong>
          <span>Your progress is saved locally, but cloud sync and Analytics are unavailable. Please check your internet connection or Vercel Environment Variables.</span>
        </div>
      )}
      {showNotifBanner && (
        <div style={{
          background: 'rgba(59, 130, 246, 0.1)',
          border: '1px solid rgba(59, 130, 246, 0.2)',
          color: 'var(--text-main)',
          padding: '16px',
          borderRadius: '16px',
          marginBottom: '20px',
          fontSize: '0.9rem',
          display: 'flex',
          flexDirection: 'column',
          gap: '12px',
          position: 'relative'
        }}>
          <button 
            onClick={() => {
              localStorage.setItem('noor_dismissed_notif_banner', 'true');
              setShowNotifBanner(false);
            }} 
            style={{ position: 'absolute', top: '12px', right: '12px', background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer' }}
          >
            <X size={16} />
          </button>
          <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start', paddingRight: '20px' }}>
            <Bell size={20} color="var(--primary)" style={{ flexShrink: 0, marginTop: '2px' }} />
            <div>
              <strong style={{ display: 'block', marginBottom: '4px' }}>Enable Worship Reminders?</strong>
              <span style={{ color: 'var(--text-muted)', fontSize: '0.8rem', lineHeight: '1.4' }}>
                Receive notifications for prayer times, Surah recitations, and Friday Jumuah prep.
              </span>
            </div>
          </div>
          <button 
            className="btn-primary" 
            style={{ padding: '10px 16px', fontSize: '0.85rem', alignSelf: 'flex-start', boxShadow: 'none' }}
            onClick={requestNotifPermission}
          >
            Enable Notifications
          </button>
        </div>
      )}
      <header style={{ marginBottom: '30px' }}>
        <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{format(new Date(), 'EEEE, dd MMMM')}</p>
        <h1 style={{ fontSize: '2rem', marginTop: '4px' }}>Today's Worship</h1>
      </header>
      
      <div className="glass-panel" style={{ marginBottom: '24px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <div>
          <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>Daily Progress</h3>
          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>{progress === 100 ? 'Alhamdulillah, target met!' : 'Keep going, you\'re doing great!'}</p>
        </div>
        <div style={{ position: 'relative', width: '64px', height: '64px', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
            <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--glass-border)" strokeWidth="3" />
            <motion.path 
              d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
              fill="none" stroke="var(--primary)" strokeWidth="3" 
              strokeDasharray={`${progress}, 100`}
              initial={{ strokeDasharray: "0, 100" }} animate={{ strokeDasharray: `${progress}, 100` }}
              transition={{ duration: 1, ease: "easeOut" }}
            />
          </svg>
          <span style={{ position: 'absolute', fontSize: '0.85rem', fontWeight: 'bold' }}>{progress}%</span>
        </div>
      </div>

      <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
        {Object.entries(groupedTasks).map(([category, catTasks]) => (
          <div key={category}>
            <h2 style={{ fontSize: '1.1rem', marginBottom: '12px', color: 'var(--text-muted)' }}>{category}</h2>
            <div style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              {catTasks.map(task => (
                <div 
                  key={task.id} className="glass-panel" 
                  style={{ 
                    display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '16px', cursor: 'pointer', transition: 'all 0.2s',
                    border: task.is_completed ? '1px solid var(--primary)' : '1px solid var(--glass-border)',
                    background: task.is_completed ? 'rgba(59, 130, 246, 0.05)' : 'var(--bg-card)'
                  }}
                  onClick={() => handleTaskAction(task)}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                    <div onClick={(e) => { e.stopPropagation(); toggleTask(task); }}>
                      {task.is_completed ? <CheckCircle2 color="var(--primary)" size={24} /> : <Circle color="var(--text-muted)" size={24} />}
                    </div>
                    <span style={{ fontSize: '1.05rem', color: 'var(--text-main)', textDecoration: task.is_completed ? 'line-through' : 'none', opacity: task.is_completed ? 0.7 : 1 }}>
                      {task.title}
                    </span>
                  </div>
                  
                  <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
                    {getBenefitsForTask(task.id) && (
                      <button 
                        onClick={(e) => {
                          e.stopPropagation();
                          setActiveTask(task);
                          setShowBenefits(true);
                        }}
                        style={{ 
                          background: 'rgba(59, 130, 246, 0.1)', 
                          border: '1px solid rgba(59, 130, 246, 0.3)', 
                          color: 'var(--primary)', 
                          padding: '4px 10px', 
                          borderRadius: '12px', 
                          fontSize: '0.75rem', 
                          fontWeight: '600', 
                          cursor: 'pointer',
                          whiteSpace: 'nowrap',
                          transition: 'background-color 0.2s'
                        }}
                      >
                        Benefits
                      </button>
                    )}
                    
                    {task.type === 'counter' && !task.is_completed && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        {task.count_reached || 0} / {task.target} <ChevronRight size={16} />
                      </div>
                    )}
                    {task.type === 'content' && !task.is_completed && (
                      <div style={{ fontSize: '0.85rem', color: 'var(--primary)', fontWeight: '600', display: 'flex', alignItems: 'center', gap: '4px' }}>
                        Open <ChevronRight size={16} />
                      </div>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* OVERLAY MODAL */}
      <AnimatePresence>
        {activeTask && (
          <motion.div 
            ref={modalRef}
            initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            style={{ 
              position: 'fixed', 
              inset: 0, 
              background: 'var(--bg-darker)', 
              zIndex: 100, 
              display: 'flex', 
              flexDirection: 'column', 
              padding: '24px', 
              overflowY: activeTask.type === 'content' ? 'hidden' : 'auto' 
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)', maxWidth: '50%', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{activeTask.title}</h2>
              <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                {benefits && (
                  <button 
                    onClick={() => setShowBenefits(true)}
                    className="glass-panel" 
                    style={{ padding: '8px 16px', color: 'var(--primary)', border: '1px solid var(--primary)', cursor: 'pointer', borderRadius: '20px', fontSize: '0.85rem', fontWeight: 'bold' }}
                  >
                    View Benefits / മഹത്വം
                  </button>
                )}
                <button onClick={() => setActiveTask(null)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', padding: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}><X size={28} /></button>
              </div>
            </div>

            {/* COUNTER UI */}
            {activeTask.type === 'counter' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {activeTask.imageUrl && (
                  <div style={{ 
                    width: '100%', 
                    height: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? 'auto' : '180px', 
                    maxHeight: activeTask.id.includes('duha_surah') ? '360px' : '180px',
                    background: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? '#ffffff' : 'var(--bg-card)', 
                    borderRadius: '16px', 
                    marginBottom: '30px', 
                    display: 'flex', 
                    alignItems: activeTask.id.includes('duha_surah') ? 'flex-start' : 'center', 
                    justifyContent: 'center', 
                    padding: '16px',
                    overflowY: activeTask.id.includes('duha_surah') ? 'auto' : 'hidden',
                    border: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? '2px solid var(--primary)' : '1px solid var(--glass-border)'
                  }}>
                    <img 
                      src={activeTask.imageUrl} 
                      alt={activeTask.title} 
                      style={{ 
                        width: '100%', 
                        height: (activeTask.id.includes('duha_surah') || activeTask.id.includes('allahumma')) ? 'auto' : '100%', 
                        objectFit: 'contain' 
                      }} 
                    />
                  </div>
                )}
                
                <div 
                  onClick={() => updateCounterProgress(counterValue + 1)}
                  style={{ width: '220px', height: '220px', borderRadius: '50%', background: 'var(--bg-card)', border: '2px solid var(--primary)', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '5rem', fontWeight: 'bold', color: 'var(--primary)', cursor: 'pointer', userSelect: 'none', boxShadow: '0 0 40px var(--primary-glow)', flexShrink: 0 }}
                >
                  {counterValue}
                </div>
                <p style={{ marginTop: '20px', color: 'var(--text-muted)', fontSize: '1.2rem' }}>Target: {activeTask.target}</p>
                
                <div style={{ display: 'flex', gap: '16px', marginTop: '20px', marginBottom: '20px' }}>
                  <button className="glass-panel" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => updateCounterProgress(Math.max(0, counterValue - 1))}><RefreshCw size={18} /> -1</button>
                  <button className="glass-panel" style={{ padding: '12px 24px', display: 'flex', alignItems: 'center', gap: '8px', color: 'var(--text-main)', cursor: 'pointer' }} onClick={() => updateCounterProgress(0)}>Reset</button>
                </div>

              </div>
            )}

            {/* CONTENT UI */}
            {activeTask.type === 'content' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
                <div style={{ 
                  flex: 1, 
                  borderRadius: '24px', 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--glass-border)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'stretch', 
                  justifyContent: 'stretch',
                  padding: '4px',
                  marginBottom: '16px',
                  overflow: 'hidden'
                }}>
                  {activeTask.contentUrl.endsWith('.pdf') ? (
                    <iframe 
                      src={`${activeTask.contentUrl}#toolbar=0&navpanes=0&view=FitH`}
                      style={{ width: '100%', height: '100%', borderRadius: '18px', border: 'none' }}
                      title={activeTask.title}
                    />
                  ) : (
                    <img 
                      src={activeTask.contentUrl} 
                      alt={activeTask.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '18px' }} 
                    />
                  )}
                </div>
                
                <button className="btn-primary" style={{ width: '100%', padding: '16px' }} onClick={submitModalTask}>
                  Mark as Read & Completed
                </button>
              </div>
            )}

            {/* BENEFITS OVERLAY */}
            <AnimatePresence>
              {showBenefits && benefits && (
                <motion.div
                  initial={{ opacity: 0, scale: 0.95 }}
                  animate={{ opacity: 1, scale: 1 }}
                  exit={{ opacity: 0, scale: 0.95 }}
                  style={{ 
                    position: 'absolute', 
                    inset: 0, 
                    background: '#ffffff', 
                    color: '#000000', 
                    zIndex: 110, 
                    padding: '24px', 
                    display: 'flex', 
                    flexDirection: 'column',
                    overflowY: 'auto'
                  }}
                >
                  {/* Header */}
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px', borderBottom: '1px solid #e5e7eb', paddingBottom: '16px' }}>
                    <h3 style={{ fontSize: '1.3rem', fontWeight: 'bold', color: '#111827', margin: 0 }}>{benefits.title}</h3>
                    <button 
                      onClick={() => {
                        setShowBenefits(false);
                        if (activeTask.type === 'checkbox') {
                          setActiveTask(null);
                        }
                      }} 
                      style={{ background: '#f3f4f6', border: 'none', color: '#374151', padding: '8px 16px', borderRadius: '20px', cursor: 'pointer', fontWeight: 'bold', fontSize: '0.9rem' }}
                    >
                      Close / മടങ്ങുക
                    </button>
                  </div>
                  
                  {/* Content */}
                  <div style={{ flex: 1, fontSize: '1.05rem', lineHeight: '1.7', whiteSpace: 'pre-wrap', color: '#1f2937', fontFamily: 'system-ui, -apple-system, sans-serif' }}>
                    {benefits.content}
                  </div>

                  {/* Mark as Completed button for checkbox tasks inside benefits overlay */}
                  {activeTask.type === 'checkbox' && !activeTask.is_completed && (
                    <button
                      onClick={() => {
                        toggleTask(activeTask, true);
                        setShowBenefits(false);
                        setActiveTask(null);
                      }}
                      style={{
                        marginTop: '20px',
                        width: '100%',
                        padding: '16px',
                        background: 'var(--primary)',
                        color: '#ffffff',
                        border: 'none',
                        borderRadius: '12px',
                        fontSize: '1rem',
                        fontWeight: 'bold',
                        cursor: 'pointer'
                      }}
                    >
                      Mark as Completed / പൂർത്തിയാക്കുക
                    </button>
                  )}
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
