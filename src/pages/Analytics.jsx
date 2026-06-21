import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';
import { format, subDays, parseISO, differenceInDays, startOfWeek } from 'date-fns';
import { Flame, Trophy, Target, X, CheckCircle2, Circle, ListPlus } from 'lucide-react';
import { generateDailyTasks } from '../lib/worshipLogic';
import { motion, AnimatePresence } from 'framer-motion';

const CircularProgress = ({ progress, label }) => (
  <div className="glass-panel" style={{ padding: '16px', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center' }}>
    <div style={{ position: 'relative', width: '64px', height: '64px', marginBottom: '12px' }}>
      <svg viewBox="0 0 36 36" style={{ width: '100%', height: '100%', transform: 'rotate(-90deg)' }}>
        <path d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" fill="none" stroke="var(--glass-border)" strokeWidth="3" />
        <path 
          d="M18 2.0845 a 15.9155 15.9155 0 0 1 0 31.831 a 15.9155 15.9155 0 0 1 0 -31.831" 
          fill="none" stroke="var(--primary)" strokeWidth="3" 
          strokeDasharray={`${progress}, 100`}
          style={{ transition: 'stroke-dasharray 1s ease-out' }}
        />
      </svg>
      <span style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.85rem', fontWeight: 'bold' }}>{progress}%</span>
    </div>
    <span style={{ fontSize: '0.9rem', color: 'var(--text-main)', textAlign: 'center', fontWeight: '500' }}>{label}</span>
  </div>
);

const parseLocalDate = (dateStr) => {
  if (!dateStr) return new Date();
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day);
};

const Analytics = ({ session }) => {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ avgScore: 0, currentStreak: 0, totalPoints: 0 });
  const [selectedDay, setSelectedDay] = useState(null); // Used for displaying the round charts below the graph
  const [detailedDay, setDetailedDay] = useState(null); // Full day object for the detailed checklist modal
  const [triggerRender, setTriggerRender] = useState(0); 
  const [visibleCount, setVisibleCount] = useState(10);
  const [isOffline, setIsOffline] = useState(() => {
    return !import.meta.env.VITE_SUPABASE_URL || import.meta.env.VITE_SUPABASE_URL.includes('placeholder');
  });

  // Broadcast channel
  const [broadcastChannel, setBroadcastChannel] = useState(null);

  useEffect(() => {
    fetchAnalytics();

    const channel = supabase.channel('admin_realtime', {
      config: {
        broadcast: { self: true }
      }
    })
    .on('broadcast', { event: 'task_update' }, () => {
      fetchAnalytics();
    });

    channel.subscribe();
    setBroadcastChannel(channel);

    return () => {
      supabase.removeChannel(channel);
    };
  }, [triggerRender]);

  // Reset sub-state/modal when Analytics nav is clicked again
  useEffect(() => {
    const handleNavClickEvent = (e) => {
      if (e.detail?.path === '/analytics') {
        setDetailedDay(null);
        setSelectedDay(null);
      }
    };
    window.addEventListener('nav-click', handleNavClickEvent);
    return () => window.removeEventListener('nav-click', handleNavClickEvent);
  }, []);

  const fetchAnalytics = async () => {
    const userId = session?.user?.id;
    const prefix = userId ? `worship_cache_${userId}_` : `worship_cache_`;
    try {
      let earliestDate = new Date();
      let dbRecords = [];
      let dbCompletions = [];

      // 1. Fetch from Database if logged in
      if (userId) {
        const { data: rData } = await supabase.from('worship_records').select('*').eq('user_id', userId);
        if (rData && rData.length > 0) {
          dbRecords = rData;
          const recordIds = rData.map(r => r.id);
          
          // Fetch completions in batches if necessary, but usually it's fine for small/medium datasets
          const { data: cData } = await supabase.from('task_completions').select('*').in('worship_record_id', recordIds);
          dbCompletions = cData || [];
          
          // Update earliest date based on DB
          rData.forEach(r => {
            const d = parseLocalDate(r.record_date);
            if (!isNaN(d) && d < earliestDate) earliestDate = d;
          });
        }
      }

      // 2. Also check local storage for earliest date (in case they have offline unsynced data)
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (key && key.startsWith(prefix)) {
          const dateStr = key.replace(prefix, '');
          const d = parseLocalDate(dateStr);
          if (!isNaN(d) && d < earliestDate) {
            earliestDate = d;
          }
        }
      }

      const daysDiff = differenceInDays(new Date(), earliestDate) + 1;
      const allDays = Array.from({ length: daysDiff }).map((_, i) => format(subDays(new Date(), i), 'yyyy-MM-dd')).reverse();
      
      let currentStreak = 0;
      let totalPoints = 0;
      let scoreSum = 0;

      const chartData = allDays.map(dateStr => {
        // Build DB Cache for this specific day
        const dayDbCache = {};
        const dbRecordForDay = dbRecords.find(r => r.record_date === dateStr);
        if (dbRecordForDay) {
          const completionsForDay = dbCompletions.filter(c => c.worship_record_id === dbRecordForDay.id);
          completionsForDay.forEach(c => {
            dayDbCache[c.task_id] = { is_completed: c.is_completed, count_reached: c.count_reached };
          });
        }

        // Get Local Cache for this specific day
        const localCacheKey = userId ? `worship_cache_${userId}_${dateStr}` : `worship_cache_${dateStr}`;
        const localCacheStr = localStorage.getItem(localCacheKey);
        const localCache = localCacheStr ? JSON.parse(localCacheStr) : {};
        
        // Merge them (Local cache overrides DB in case of offline edits, though sync usually handles this)
        const mergedCache = { ...dayDbCache, ...localCache };

        const dayDate = parseLocalDate(dateStr);
        const dayTasksRaw = generateDailyTasks(dayDate);
        
        let completedCount = 0;
        let dayPoints = 0;
        const categoryBreakdown = {};
        
        const enhancedTasks = dayTasksRaw.map(task => {
          const isCompleted = !!mergedCache[task.id]?.is_completed;
          
          if (!categoryBreakdown[task.category]) {
            categoryBreakdown[task.category] = { total: 0, completed: 0 };
          }
          categoryBreakdown[task.category].total++;

          if (isCompleted) {
            completedCount++;
            dayPoints += task.points;
            categoryBreakdown[task.category].completed++;
          }
          return { ...task, isCompleted };
        });

        const totalTaskCount = dayTasksRaw.length;
        const score = totalTaskCount === 0 ? 0 : Math.round((completedCount / totalTaskCount) * 100);

        if (score >= 50) currentStreak++; else currentStreak = 0;
        totalPoints += dayPoints;
        scoreSum += score;

        return {
          name: format(dayDate, 'EEE, d'),
          score: score,
          fullDate: dateStr,
          tasks: enhancedTasks,
          categoryBreakdown,
          completedCount,
          totalTaskCount,
          worship_record_id: dbRecordForDay ? dbRecordForDay.id : null // Store for potential DB updates via modal
        };
      });

      setStats({
        avgScore: Math.round(scoreSum / daysDiff),
        currentStreak,
        totalPoints
      });
      setData(chartData);

      // Keep modal synced
      if (detailedDay) {
        const updatedDay = chartData.find(d => d.fullDate === detailedDay.fullDate);
        if (updatedDay) setDetailedDay(updatedDay);
      }

      setIsOffline(false);
    } catch (err) {
      console.error("Error fetching analytics:", err);
      setIsOffline(true);
    } finally {
      setLoading(false);
    }
  };

  const handleChartClick = (state) => {
    if (state && state.activePayload && state.activePayload.length > 0) {
      setSelectedDay(state.activePayload[0].payload);
    }
  };

  const toggleTaskHistory = async (taskId, currentlyCompleted) => {
    if (!detailedDay) return;
    const dateStr = detailedDay.fullDate;
    const userId = session?.user?.id;
    const localCacheKey = userId ? `worship_cache_${userId}_${dateStr}` : `worship_cache_${dateStr}`;
    const localCacheStr = localStorage.getItem(localCacheKey);
    const localCache = localCacheStr ? JSON.parse(localCacheStr) : {};

    // 1. Update Local Storage
    if (currentlyCompleted) {
      delete localCache[taskId];
    } else {
      localCache[taskId] = { is_completed: true, count_reached: 0 };
    }
    localStorage.setItem(localCacheKey, JSON.stringify(localCache));

    // 2. Update Database if record exists
    if (userId) {
      let recordId = detailedDay.worship_record_id;
      
      // If no record exists for this past day, create one
      if (!recordId) {
        const { data: newRecord } = await supabase.from('worship_records').insert({ user_id: userId, record_date: dateStr }).select().single();
        if (newRecord) recordId = newRecord.id;
      }

      if (recordId) {
        if (currentlyCompleted) {
          await supabase.from('task_completions').delete().eq('worship_record_id', recordId).eq('task_id', taskId);
        } else {
          await supabase.from('task_completions').upsert({
            worship_record_id: recordId,
            task_id: taskId,
            is_completed: true,
            count_reached: 0,
            completed_at: new Date().toISOString()
          }, { onConflict: 'worship_record_id, task_id' });
        }
      }
    }

    if (broadcastChannel) {
      broadcastChannel.send({
        type: 'broadcast',
        event: 'task_update',
        payload: {}
      }).catch(console.error);
    }

    setTriggerRender(prev => prev + 1); // Trigger full recalculation
  };

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
          <span>Your history and analytics cannot be loaded from the cloud. Please check your internet connection or verify your Vercel Environment Variables.</span>
        </div>
      )}

      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2rem' }}>Analytics</h1>
        <p style={{ color: 'var(--text-muted)' }}>Track your consistency</p>
      </header>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px', marginBottom: '30px' }}>
        <div className="glass-panel" style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Target size={24} color="var(--primary)" style={{ marginBottom: '8px' }} />
          <h2 style={{ fontSize: '1.4rem' }}>{stats.avgScore}%</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Avg Score</p>
        </div>
        <div className="glass-panel" style={{ padding: '16px 12px', textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Trophy size={24} color="#10b981" style={{ marginBottom: '8px' }} />
          <h2 style={{ fontSize: '1.4rem' }}>{stats.totalPoints}</h2>
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Points</p>
        </div>
      </div>

      {/* Chart */}
      <div className="glass-panel" style={{ padding: '20px', height: '300px', marginBottom: '30px', display: 'flex', flexDirection: 'column' }}>
        <h3 style={{ fontSize: '1.1rem', marginBottom: '20px', color: 'var(--text-muted)' }}>Progress Over Time (Since Started)</h3>
        {loading ? (
          <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--text-muted)' }}>Loading...</div>
        ) : (
          <div style={{ flex: 1, width: '100%', minHeight: 0 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={data} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.1)" vertical={false} />
                <XAxis dataKey="name" stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} />
                <YAxis domain={[0, 100]} ticks={[0, 25, 50, 75, 100]} stroke="var(--text-muted)" fontSize={12} tickLine={false} axisLine={false} tickFormatter={(value) => `${value}%`} />
                <Tooltip 
                  contentStyle={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white' }} 
                  formatter={(value) => [`${value}%`, 'Average Score']}
                />
                <Line 
                  type="monotone" 
                  dataKey="score" 
                  stroke="var(--primary)" 
                  strokeWidth={3} 
                  dot={{ fill: 'var(--bg-card)', stroke: 'var(--primary)', strokeWidth: 2, r: 4 }} 
                  activeDot={{ r: 6, fill: '#10b981', stroke: '#10b981' }}
                />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
      </div>

      {/* All Days List */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', marginBottom: '40px' }}>
        <h3 style={{ fontSize: '1.2rem', color: 'var(--text-muted)' }}>Activity History</h3>
        {data.slice().reverse().slice(0, visibleCount).map(day => (
          <div key={day.fullDate} className="animate-in glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <div>
              <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{format(parseISO(day.fullDate), 'EEEE, MMM do')}</h3>
              <span style={{ color: day.score === 100 ? '#10b981' : 'var(--primary)', fontWeight: 'bold', fontSize: '1.1rem' }}>{day.score}% Total</span>
            </div>

            <button 
              className="btn-primary" 
              style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', borderRadius: '30px' }}
              onClick={() => setDetailedDay(day)}
            >
              <ListPlus size={20} />
              Details
            </button>
          </div>
        ))}
        
        {visibleCount < data.length && (
          <button 
            className="glass-panel" 
            style={{ 
              padding: '16px', 
              width: '100%', 
              borderRadius: '16px', 
              fontWeight: 'bold', 
              marginTop: '8px',
              background: 'rgba(255, 255, 255, 0.05)',
              color: 'var(--text-main)',
              cursor: 'pointer',
              border: '1px solid var(--glass-border)'
            }}
            onClick={() => setVisibleCount(prev => prev + 10)}
          >
            Show More
          </button>
        )}
      </div>

      {/* FULL SCREEN DETAILED EDIT MODAL */}
      <AnimatePresence>
        {detailedDay && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--bg-darker)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '24px', paddingBottom: '100px', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <div>
                <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{format(parseLocalDate(detailedDay.fullDate), 'EEEE, MMM do')}</h2>
                <p style={{ color: 'var(--text-muted)' }}>{detailedDay.score}% Completed • {detailedDay.completedCount}/{detailedDay.totalTaskCount} Tasks</p>
              </div>
              <button onClick={() => setDetailedDay(null)} style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                <X size={24}/>
              </button>
            </div>
            
            {/* Circular Progress Grid INSIDE the Modal */}
            <div style={{ marginBottom: '30px' }}>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '16px', color: 'var(--text-muted)' }}>Category Breakdown</h3>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(100px, 1fr))', gap: '12px' }}>
                {Object.entries(detailedDay.categoryBreakdown).map(([category, info]) => {
                  const percentage = info.total === 0 ? 0 : Math.round((info.completed / info.total) * 100);
                  return (
                    <CircularProgress key={category} progress={percentage} label={category} />
                  );
                })}
              </div>
            </div>
            
            <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
              {/* Missing / Pending Tasks */}
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#ef4444', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Pending / Missing ({detailedDay.totalTaskCount - detailedDay.completedCount})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {detailedDay.tasks.filter(t => !t.isCompleted).map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => toggleTaskHistory(task.id, false)}
                      className="glass-panel" 
                      style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', borderLeft: '4px solid #ef4444' }}
                    >
                      <Circle size={24} color="var(--text-muted)" />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.05rem', margin: 0 }}>{task.title}</h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{task.category}</span>
                      </div>
                    </div>
                  ))}
                  {detailedDay.tasks.filter(t => !t.isCompleted).length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>All tasks completed! Incredible job.</p>
                  )}
                </div>
              </div>

              {/* Completed Tasks */}
              <div>
                <h3 style={{ fontSize: '1.1rem', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                  Completed ({detailedDay.completedCount})
                </h3>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                  {detailedDay.tasks.filter(t => t.isCompleted).map(task => (
                    <div 
                      key={task.id} 
                      onClick={() => toggleTaskHistory(task.id, true)}
                      className="glass-panel" 
                      style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', cursor: 'pointer', borderLeft: '4px solid #10b981', opacity: 0.8 }}
                    >
                      <CheckCircle2 size={24} color="#10b981" />
                      <div style={{ flex: 1 }}>
                        <h4 style={{ fontSize: '1.05rem', margin: 0, textDecoration: 'line-through', color: 'var(--text-muted)' }}>{task.title}</h4>
                        <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{task.category}</span>
                      </div>
                    </div>
                  ))}
                  {detailedDay.tasks.filter(t => t.isCompleted).length === 0 && (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No tasks completed yet.</p>
                  )}
                </div>
              </div>
            </div>
            
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default Analytics;
