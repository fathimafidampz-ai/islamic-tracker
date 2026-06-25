import React, { useState, useEffect } from 'react';
import { Plus, Clock, Trash2, X, Briefcase, BookOpen, Dumbbell, Moon, User, Edit2, Utensils } from 'lucide-react';
import { supabase } from '../lib/supabase';

const CATEGORIES = [
  { id: 'Work', icon: Briefcase, color: '#3b82f6' },
  { id: 'Study', icon: BookOpen, color: '#10b981' },
  { id: 'Fitness', icon: Dumbbell, color: '#f59e0b' },
  { id: 'Worship', icon: Moon, color: '#8b5cf6' },
  { id: 'Personal', icon: User, color: '#ec4899' },
  { id: 'Food', icon: Utensils, color: '#ef4444' },
];

const Routines = ({ session }) => {
  const [routines, setRoutines] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  
  const [formTitle, setFormTitle] = useState('');
  const [formCategory, setFormCategory] = useState('Work');
  const [formStartTime, setFormStartTime] = useState('08:00');
  const [formEndTime, setFormEndTime] = useState('09:00');

  useEffect(() => {
    fetchRoutines();
  }, []);

  // Reset page state/modal when Routine nav is clicked again
  useEffect(() => {
    const handleNavClickEvent = (e) => {
      if (e.detail?.path === '/routines') {
        setIsCreating(false);
        setEditingId(null);
      }
    };
    window.addEventListener('nav-click', handleNavClickEvent);
    return () => window.removeEventListener('nav-click', handleNavClickEvent);
  }, []);

  const sortRoutines = (list) => {
    return [...list].sort((a, b) => (a.start_time || '00:00').localeCompare(b.start_time || '00:00'));
  };

  const fetchRoutines = async () => {
    const userId = session?.user?.id;
    const cacheKey = userId ? `noor_routines_cache_${userId}` : 'noor_routines_cache';
    const cachedStr = localStorage.getItem(cacheKey);
    const cachedRoutines = cachedStr ? JSON.parse(cachedStr) : [];
    
    try {
      if (session?.user?.id && session.user.id !== '00000000-0000-0000-0000-000000000000') {
        const { data, error } = await supabase
          .from('routines')
          .select('*, routine_items(count)');
          
        if (error) throw error;
        const sortedData = sortRoutines(data || []);
        setRoutines(sortedData);
        localStorage.setItem(cacheKey, JSON.stringify(sortedData));
      } else {
        setRoutines(sortRoutines(cachedRoutines));
      }
    } catch (err) {
      console.error(err);
      setRoutines(sortRoutines(cachedRoutines));
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormCategory('Work');
    setFormStartTime('08:00');
    setFormEndTime('09:00');
    setIsCreating(true);
  };

  const openEditForm = (routine) => {
    setEditingId(routine.id);
    setFormTitle(routine.title);
    setFormCategory(routine.category || 'Work');
    setFormStartTime(routine.start_time || '08:00');
    setFormEndTime(routine.end_time || '09:00');
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!formTitle) return;
    
    const catObj = CATEGORIES.find(c => c.id === formCategory);
    let updatedRoutines;

    if (editingId) {
      // Edit existing
      updatedRoutines = routines.map(r => {
        if (r.id === editingId) {
          return { ...r, title: formTitle, category: formCategory, start_time: formStartTime, end_time: formEndTime, color: catObj.color };
        }
        return r;
      });
    } else {
      // Create new
      const newRoutineObj = {
        id: crypto.randomUUID(),
        user_id: session?.user?.id,
        title: formTitle,
        category: formCategory,
        start_time: formStartTime,
        end_time: formEndTime,
        color: catObj.color,
        created_at: new Date().toISOString(),
        routine_items: [{ count: 0 }]
      };
      updatedRoutines = [newRoutineObj, ...routines];
    }

    updatedRoutines = sortRoutines(updatedRoutines);
    setRoutines(updatedRoutines);
    const userId = session?.user?.id;
    const cacheKey = userId ? `noor_routines_cache_${userId}` : 'noor_routines_cache';
    localStorage.setItem(cacheKey, JSON.stringify(updatedRoutines));
    
    setIsCreating(false);
    
    // Try syncing to DB if valid auth
    if (session?.user?.id && session.user.id !== '00000000-0000-0000-0000-000000000000') {
      try {
        if (editingId) {
          await supabase.from('routines').update({
            title: formTitle, color: catObj.color
          }).eq('id', editingId);
        } else {
          await supabase.from('routines').insert({
            user_id: session.user.id, title: formTitle, color: catObj.color
          });
        }
      } catch (err) {
        console.error("DB Save failed, but saved locally:", err);
      }
    }
  };

  const deleteRoutine = async (id) => {
    if (!window.confirm('Delete this routine?')) return;
    const updated = routines.filter(r => r.id !== id);
    setRoutines(updated);
    const userId = session?.user?.id;
    const cacheKey = userId ? `noor_routines_cache_${userId}` : 'noor_routines_cache';
    localStorage.setItem(cacheKey, JSON.stringify(updated));
    
    if (session?.user?.id && session.user.id !== '00000000-0000-0000-0000-000000000000') {
      try {
        await supabase.from('routines').delete().eq('id', id);
      } catch (err) {
        console.error(err);
      }
    }
  };

  return (
    <div className="page-container animate-in">
      <header style={{ marginBottom: '30px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <div>
          <h1 style={{ fontSize: '2rem' }}>Routines</h1>
          <p style={{ color: 'var(--text-muted)' }}>Manage your daily schedules</p>
        </div>
        {!isCreating && (
          <button className="btn-primary" onClick={openCreateForm} style={{ padding: '10px 14px', borderRadius: '50%' }}>
            <Plus size={24} />
          </button>
        )}
      </header>

      {isCreating && (
        <div className="glass-panel animate-in" style={{ marginBottom: '24px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <h3 style={{ fontSize: '1.2rem' }}>{editingId ? 'Edit Routine' : 'Create Routine'}</h3>
            <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)' }}><X size={24}/></button>
          </div>
          
          <input 
            type="text" 
            placeholder="Routine Title (e.g. Morning Focus)" 
            value={formTitle}
            onChange={(e) => setFormTitle(e.target.value)}
            style={{ width: '100%', background: 'var(--bg-darker)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '12px', borderRadius: '8px', outline: 'none' }}
          />

          <div>
            <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Category</label>
            <div className="no-scrollbar" style={{ display: 'flex', gap: '8px', overflowX: 'auto', paddingBottom: '8px' }}>
              {CATEGORIES.map(cat => {
                const isSelected = formCategory === cat.id;
                const Icon = cat.icon;
                return (
                  <button 
                    key={cat.id}
                    onClick={() => setFormCategory(cat.id)}
                    style={{ 
                      display: 'flex', alignItems: 'center', gap: '6px', padding: '8px 12px', borderRadius: '20px',
                      background: isSelected ? `${cat.color}20` : 'var(--bg-darker)',
                      border: `1px solid ${isSelected ? cat.color : 'var(--glass-border)'}`,
                      color: isSelected ? cat.color : 'var(--text-muted)',
                      cursor: 'pointer', whiteSpace: 'nowrap'
                    }}
                  >
                    <Icon size={16} /> {cat.id}
                  </button>
                )
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: '16px' }}>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>Start Time</label>
              <input 
                type="time" 
                value={formStartTime}
                onChange={(e) => setFormStartTime(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-darker)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '12px', borderRadius: '8px', outline: 'none' }}
              />
            </div>
            <div style={{ flex: 1 }}>
              <label style={{ display: 'block', marginBottom: '8px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>End Time</label>
              <input 
                type="time" 
                value={formEndTime}
                onChange={(e) => setFormEndTime(e.target.value)}
                style={{ width: '100%', background: 'var(--bg-darker)', border: '1px solid var(--glass-border)', color: 'var(--text-main)', padding: '12px', borderRadius: '8px', outline: 'none' }}
              />
            </div>
          </div>

          <button className="btn-primary" onClick={handleSave} style={{ padding: '12px', marginTop: '8px' }}>{editingId ? 'Save Changes' : 'Save Routine'}</button>
        </div>
      )}

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {routines.map(routine => {
            const catObj = CATEGORIES.find(c => c.id === routine.category) || CATEGORIES[0];
            const Icon = catObj.icon;
            
            return (
              <div key={routine.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderLeft: `4px solid ${routine.color}` }}>
                <div style={{ display: 'flex', gap: '16px', alignItems: 'center' }}>
                  <div style={{ width: '48px', height: '48px', borderRadius: '12px', background: `${routine.color}20`, display: 'flex', alignItems: 'center', justifyContent: 'center', color: routine.color }}>
                    <Icon size={24} />
                  </div>
                  <div>
                    <h3 style={{ fontSize: '1.2rem', marginBottom: '4px' }}>{routine.title}</h3>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '12px', color: 'var(--text-muted)', fontSize: '0.9rem' }}>
                      <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <Clock size={14} />
                        {routine.start_time || '00:00'} - {routine.end_time || '00:00'}
                      </span>
                    </div>
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button onClick={() => openEditForm(routine)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}>
                    <Edit2 size={18} />
                  </button>
                  <button onClick={() => deleteRoutine(routine.id)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', padding: '8px' }}>
                    <Trash2 size={18} />
                  </button>
                </div>
              </div>
            )
          })}

          {routines.length === 0 && !isCreating && (
            <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <p>No routines created yet.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Tap + to create your first routine!</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default Routines;
