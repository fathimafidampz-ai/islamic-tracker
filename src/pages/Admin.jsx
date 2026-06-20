import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Shield, User as UserIcon, ChevronLeft, ListPlus, X, CheckCircle2, Circle } from 'lucide-react';
import { format, parseISO, eachDayOfInterval } from 'date-fns';
import { generateDailyTasks } from '../lib/worshipLogic';
import { motion, AnimatePresence } from 'framer-motion';

const Admin = ({ session }) => {
  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState([]);
  const [error, setError] = useState(null);

  // Navigation states
  const [activeUser, setActiveUser] = useState(null); // string (email)
  const [detailedDay, setDetailedDay] = useState(null); // record object

  useEffect(() => {
    if (session?.user?.email === 'fathimafidampz@gmail.com') {
      fetchAdminData();

      // Fallback polling every 3 seconds in case Supabase Realtime RLS blocks events
      const pollInterval = setInterval(() => {
        fetchAdminData();
      }, 3000);

      // Realtime listener for immediate updates when a user clicks a task
      const subscription = supabase.channel('admin_realtime', {
        config: {
          broadcast: { self: true }
        }
      })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'task_completions' }, () => {
          fetchAdminData();
        })
        .on('postgres_changes', { event: '*', schema: 'public', table: 'worship_records' }, () => {
          fetchAdminData();
        })
        .on('broadcast', { event: 'task_update' }, () => {
          fetchAdminData();
        })
        .subscribe();

      return () => {
        clearInterval(pollInterval);
        supabase.removeChannel(subscription);
      };
    } else {
      setError('You are not authorized to view this page.');
      setLoading(false);
    }
  }, [session]);

  const fetchAdminData = async () => {
    try {
      const { data, error } = await supabase.rpc('get_admin_dashboard_data');
      if (error) throw error;
      setUserData(data || []);
    } catch (err) {
      console.error(err);
      setError(`Error: ${err.message || 'Could not fetch data. Did you run the SQL script?'}`);
    } finally {
      setLoading(false);
    }
  };

  if (session?.user?.email !== 'fathimafidampz@gmail.com') {
    return (
      <div className="page-container" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', textAlign: 'center' }}>
        <div>
          <Shield size={48} color="var(--text-muted)" style={{ marginBottom: '16px' }} />
          <h2>Access Denied</h2>
          <p style={{ color: 'var(--text-muted)' }}>Only the administrator can view this page.</p>
        </div>
      </div>
    );
  }

  // Group data by user email
  const groupedData = userData.reduce((acc, row) => {
    if (!acc[row.user_email]) acc[row.user_email] = [];
    acc[row.user_email].push(row);
    return acc;
  }, {});

  // Keep the detailed modal completely up-to-date with realtime changes
  useEffect(() => {
    if (detailedDay && activeUser) {
      const records = groupedData[activeUser] || [];
      const updatedRecord = records.find(r => r.record_date === detailedDay.record_date);
      if (updatedRecord) {
        // Only update if the tasks changed
        if (JSON.stringify(updatedRecord.completed_task_ids) !== JSON.stringify(detailedDay.completed_task_ids)) {
          setDetailedDay({ ...detailedDay, completed_tasks: updatedRecord.completed_tasks, completed_task_ids: updatedRecord.completed_task_ids });
        }
      } else {
        // If the record no longer exists in dbRecords, it means 0 tasks are completed for this day.
        if (detailedDay.completed_tasks > 0) {
          setDetailedDay({ ...detailedDay, completed_tasks: 0, completed_task_ids: [] });
        }
      }
    }
  }, [userData]);

  // Generate full task dictionary and categories once
  const allTasksTemplate = generateDailyTasks();

  const renderUsersList = () => (
    <div className="animate-in">
      <header style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '12px' }}>
        <div style={{ padding: '12px', background: 'rgba(245, 158, 11, 0.1)', borderRadius: '12px', color: '#f59e0b' }}>
          <Shield size={28} />
        </div>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Admin Dashboard</h1>
          <p style={{ color: 'var(--text-muted)' }}>Select a user to view their history</p>
        </div>
      </header>

      {error && (
        <div className="glass-panel" style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', color: '#fca5a5', marginBottom: '24px' }}>
          {error}
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)', marginTop: '40px' }}>Loading user data...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {Object.entries(groupedData).length === 0 && !error && (
            <p style={{ color: 'var(--text-muted)' }}>No user data found.</p>
          )}

          {Object.entries(groupedData)
            .map(([email, records]) => {
            records.sort((a, b) => new Date(b.record_date) - new Date(a.record_date));
            const latestRecord = records[0];
            const totalLifetimeTasks = records.reduce((sum, r) => sum + r.completed_tasks, 0);

            return (
              <div 
                key={email} 
                className="glass-panel" 
                style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer', transition: 'all 0.2s' }}
                onClick={() => setActiveUser(email)}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: '16px' }}>
                  <div style={{ background: 'rgba(255,255,255,0.1)', padding: '12px', borderRadius: '50%' }}>
                    <UserIcon size={24} color="var(--primary)" />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{email.split('@')[0]}</h3>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{email}</p>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Active {format(new Date(latestRecord.record_date), 'MMM d')}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );

  const renderUserHistory = () => {
    const dbRecords = groupedData[activeUser] || [];
    const totalPossibleTasks = allTasksTemplate.length;

    // Fill missing days using eachDayOfInterval
    const sortedRecords = [...dbRecords].sort((a, b) => new Date(a.record_date) - new Date(b.record_date));
    const firstRecord = sortedRecords.length > 0 ? sortedRecords[0] : null;

    let fullHistory = [];
    if (firstRecord) {
      const startDate = parseISO(firstRecord.record_date);
      const endDate = new Date();
      
      const dateRange = eachDayOfInterval({ start: startDate, end: endDate });
      
      fullHistory = dateRange.map(date => {
        const dateStr = format(date, 'yyyy-MM-dd');
        const record = dbRecords.find(r => r.record_date === dateStr);
        return {
          record_date: dateStr,
          completed_tasks: record ? record.completed_tasks : 0,
          completed_task_ids: record ? (record.completed_task_ids || []) : []
        };
      }).reverse();
    }
    
    return (
      <div className="animate-in" style={{ paddingBottom: '100px' }}>
        <header style={{ marginBottom: '30px', display: 'flex', alignItems: 'center', gap: '16px' }}>
          <button 
            onClick={() => setActiveUser(null)} 
            style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', padding: '8px', borderRadius: '50%', color: 'var(--text-main)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <ChevronLeft size={24} />
          </button>
          <div>
            <h1 style={{ fontSize: '1.6rem', marginBottom: '2px', wordBreak: 'break-all' }}>{activeUser}</h1>
            <p style={{ color: 'var(--text-muted)' }}>Activity History</p>
          </div>
        </header>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {fullHistory.map(record => {
            const dailyScore = Math.round((record.completed_tasks / totalPossibleTasks) * 100);
            return (
              <div key={record.record_date} className="glass-panel" style={{ padding: '20px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <div>
                  <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{format(parseISO(record.record_date), 'EEEE, MMM do')}</h3>
                  <span style={{ color: dailyScore >= 50 ? '#10b981' : (dailyScore === 0 ? 'var(--text-muted)' : 'var(--primary)'), fontWeight: 'bold', fontSize: '1.1rem' }}>{dailyScore}% Total</span>
                </div>
                <button 
                  className="btn-primary" 
                  style={{ padding: '12px 20px', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: 'bold', borderRadius: '30px' }}
                  onClick={() => setDetailedDay(record)}
                >
                  <ListPlus size={20} />
                  Details
                </button>
              </div>
            );
          })}
        </div>

        {/* FULL SCREEN DETAILED VIEW MODAL */}
        <AnimatePresence>
          {detailedDay && (
            <motion.div 
              initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
              style={{ position: 'fixed', inset: 0, background: 'var(--bg-darker)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '24px', paddingBottom: '100px', overflowY: 'auto' }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
                <div>
                  <h2 style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{format(parseISO(detailedDay.record_date), 'EEEE, MMM do')}</h2>
                  <p style={{ color: 'var(--text-muted)' }}>{detailedDay.completed_tasks}/{totalPossibleTasks} Tasks Completed</p>
                </div>
                <button onClick={() => setDetailedDay(null)} style={{ background: 'var(--bg-card)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '8px', borderRadius: '50%', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                  <X size={24}/>
                </button>
              </div>

              {(() => {
                const completedIds = detailedDay.completed_task_ids || [];
                const parsedTasks = allTasksTemplate.map(t => ({ ...t, isCompleted: completedIds.includes(t.id) }));
                const missingTasks = parsedTasks.filter(t => !t.isCompleted);
                const completedTasks = parsedTasks.filter(t => t.isCompleted);

                return (
                  <div style={{ display: 'flex', flexDirection: 'column', gap: '30px' }}>
                    
                    {/* Missing / Pending Tasks */}
                    <div>
                      <h3 style={{ fontSize: '1.1rem', color: '#ef4444', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Pending / Missing ({missingTasks.length})
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {missingTasks.map(task => (
                          <div 
                            key={task.id} 
                            className="glass-panel" 
                            style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #ef4444' }}
                          >
                            <Circle size={24} color="var(--text-muted)" />
                            <div style={{ flex: 1 }}>
                              <h4 style={{ fontSize: '1.05rem', margin: 0 }}>{task.title}</h4>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{task.category}</span>
                            </div>
                          </div>
                        ))}
                        {missingTasks.length === 0 && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>All tasks completed! Incredible job.</p>
                        )}
                      </div>
                    </div>

                    {/* Completed Tasks */}
                    <div>
                      <h3 style={{ fontSize: '1.1rem', color: '#10b981', marginBottom: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        Completed ({completedTasks.length})
                      </h3>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                        {completedTasks.map(task => (
                          <div 
                            key={task.id} 
                            className="glass-panel" 
                            style={{ padding: '16px', display: 'flex', alignItems: 'center', gap: '16px', borderLeft: '4px solid #10b981', background: 'rgba(16, 185, 129, 0.05)' }}
                          >
                            <CheckCircle2 size={24} color="#10b981" />
                            <div style={{ flex: 1 }}>
                              <h4 style={{ fontSize: '1.05rem', margin: 0, textDecoration: 'line-through', opacity: 0.8 }}>{task.title}</h4>
                              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{task.category}</span>
                            </div>
                          </div>
                        ))}
                        {completedTasks.length === 0 && (
                          <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>No tasks completed yet.</p>
                        )}
                      </div>
                    </div>

                  </div>
                );
              })()}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    );
  };

  return (
    <div className="page-container">
      {!activeUser ? renderUsersList() : renderUserHistory()}
    </div>
  );
};

export default Admin;
