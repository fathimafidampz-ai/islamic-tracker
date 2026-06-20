import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { generateDailyTasks } from '../lib/worshipLogic';
import { format } from 'date-fns';
import { CheckCircle2, Circle, ChevronRight, X, RefreshCw, Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

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

  const todayStr = format(new Date(), 'yyyy-MM-dd');

  // Auto-complete counter when target is reached
  useEffect(() => {
    if (activeTask && activeTask.type === 'counter' && counterValue >= activeTask.target) {
      const timer = setTimeout(() => {
        submitModalTask();
      }, 500); // 500ms delay so user sees they hit the goal
      return () => clearTimeout(timer);
    }
  }, [counterValue, activeTask]);

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

      const merged = generatedTasks.map(task => {
        const dbState = completions?.find(c => c.task_id === task.id);
        const isCompleted = dbState ? dbState.is_completed : (cachedData[task.id]?.is_completed || false);
        const countReached = dbState ? dbState.count_reached : (cachedData[task.id]?.count_reached || 0);
        
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
    const channel = supabase.channel('admin_realtime');
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
    if (task.worship_record_id) {
      if (newVal) {
        await supabase.from('task_completions').upsert({
          worship_record_id: task.worship_record_id,
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
          .eq('worship_record_id', task.worship_record_id)
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

    if (task.type === 'checkbox') {
      toggleTask(task);
    } else if (task.type === 'content') {
      window.open(task.contentUrl, '_blank');
      toggleTask(task, true);
    } else {
      setActiveTask(task);
      setCounterValue(task.count_reached || 0);
    }
  };

  const updateCounterProgress = (newCount) => {
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
      if (newCount === 0 && !existingEntry.is_completed) {
        supabase.from('task_completions').delete()
          .eq('worship_record_id', activeTask.worship_record_id)
          .eq('task_id', activeTask.id)
          .catch(() => {});
      } else {
        supabase.from('task_completions').upsert({
          worship_record_id: activeTask.worship_record_id,
          task_id: activeTask.id,
          count_reached: newCount,
          is_completed: existingEntry.is_completed // Preserve existing completion status
        }, { onConflict: 'worship_record_id, task_id' }).catch(() => {});
      }
      broadcastUpdate();
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
              ))}
            </div>
          </div>
        ))}
      </div>

      {/* OVERLAY MODAL */}
      <AnimatePresence>
        {activeTask && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--bg-darker)', zIndex: 100, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2 style={{ fontSize: '1.5rem', color: 'var(--text-main)' }}>{activeTask.title}</h2>
              <button onClick={() => setActiveTask(null)} style={{ background: 'none', border: 'none', color: 'var(--text-main)', padding: '8px', cursor: 'pointer' }}><X size={28} /></button>
            </div>

            {/* COUNTER UI */}
            {activeTask.type === 'counter' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
                {activeTask.imageUrl && (
                  <div style={{ width: '100%', height: '180px', background: 'var(--bg-card)', borderRadius: '16px', marginBottom: '30px', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }}>
                    <img 
                      src={activeTask.imageUrl} 
                      alt={activeTask.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain' }} 
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
                
                <button 
                  onClick={submitModalTask}
                  disabled={counterValue < activeTask.target}
                  className="btn-primary" 
                  style={{ marginTop: 'auto', width: '100%', opacity: counterValue >= activeTask.target ? 1 : 0.5 }}
                >
                  {counterValue >= activeTask.target ? 'Complete Task' : 'Reach target to complete'}
                </button>
              </div>
            )}

            {/* CONTENT UI */}
            {activeTask.type === 'content' && (
              <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
                <div style={{ 
                  flex: 1, 
                  borderRadius: '24px', 
                  background: 'var(--bg-card)', 
                  border: '1px solid var(--glass-border)',
                  display: 'flex', 
                  flexDirection: 'column', 
                  alignItems: 'center', 
                  justifyContent: 'center',
                  padding: '40px 24px',
                  textAlign: 'center',
                  marginBottom: '24px'
                }}>
                  {activeTask.contentUrl.endsWith('.pdf') ? (
                    <>
                      <div style={{ 
                        width: '80px', 
                        height: '80px', 
                        borderRadius: '50%', 
                        background: 'rgba(59, 130, 246, 0.1)', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center',
                        marginBottom: '24px',
                        color: 'var(--primary)'
                      }}>
                        {/* BookOpen Icon */}
                        <svg xmlns="http://www.w3.org/2000/svg" width="36" height="36" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M2 3h6a4 4 0 0 1 4 4v14a3 3 0 0 0-3-3H2z"/><path d="M22 3h-6a4 4 0 0 0-4 4v14a3 3 0 0 1 3-3h7z"/></svg>
                      </div>
                      <h3 style={{ fontSize: '1.4rem', marginBottom: '8px', color: 'var(--text-main)' }}>Read {activeTask.title}</h3>
                      <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: '32px', maxWidth: '300px', lineHeight: '1.5' }}>
                        Open the Surah PDF in a new tab to read it with zoom and search support.
                      </p>
                      <button 
                        className="btn-primary" 
                        style={{ 
                          background: 'var(--text-main)', 
                          color: 'var(--bg-darker)',
                          boxShadow: 'none',
                          padding: '12px 28px',
                          borderRadius: '14px',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '8px',
                          fontWeight: '600'
                        }} 
                        onClick={() => window.open(activeTask.contentUrl, '_blank')}
                      >
                        Open PDF Document
                        <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"><path d="M18 13v6a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h6"/><polyline points="15 3 21 3 21 9"/><line x1="10" y1="14" x2="21" y2="3"/></svg>
                      </button>
                    </>
                  ) : (
                    <img 
                      src={activeTask.contentUrl} 
                      alt={activeTask.title} 
                      style={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: '16px' }} 
                    />
                  )}
                </div>
                
                <button className="btn-primary" style={{ width: '100%', padding: '16px' }} onClick={submitModalTask}>
                  Mark as Read & Completed
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Home;
