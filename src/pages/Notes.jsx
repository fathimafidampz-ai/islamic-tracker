import React, { useState, useEffect } from 'react';
import { Plus, Search, Pin, Trash2, X, Edit2 } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { motion, AnimatePresence } from 'framer-motion';

const Notes = ({ session }) => {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  
  const [isCreating, setIsCreating] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [formTitle, setFormTitle] = useState('');
  const [formContent, setFormContent] = useState('');

  useEffect(() => {
    fetchNotes();
  }, []);

  // Reset page state/modal when Notes nav is clicked again
  useEffect(() => {
    const handleNavClickEvent = (e) => {
      if (e.detail?.path === '/notes') {
        setIsCreating(false);
        setEditingId(null);
      }
    };
    window.addEventListener('nav-click', handleNavClickEvent);
    return () => window.removeEventListener('nav-click', handleNavClickEvent);
  }, []);

  const fetchNotes = async () => {
    const userId = session?.user?.id;
    const cacheKey = userId ? `noor_notes_cache_${userId}` : 'noor_notes_cache';
    const cachedStr = localStorage.getItem(cacheKey);
    const cachedNotes = cachedStr ? JSON.parse(cachedStr) : [];

    try {
      if (session?.user?.id && session.user.id !== '00000000-0000-0000-0000-000000000000') {
        const { data, error } = await supabase
          .from('notes')
          .select('*')
          .order('is_pinned', { ascending: false })
          .order('created_at', { ascending: false });
          
        if (error) throw error;
        setNotes(data || []);
        localStorage.setItem(cacheKey, JSON.stringify(data));
      } else {
        setNotes(cachedNotes.sort((a,b) => b.is_pinned - a.is_pinned));
      }
    } catch (err) {
      console.error(err);
      setNotes(cachedNotes.sort((a,b) => b.is_pinned - a.is_pinned));
    } finally {
      setLoading(false);
    }
  };

  const openCreateForm = () => {
    setEditingId(null);
    setFormTitle('');
    setFormContent('');
    setIsCreating(true);
  };

  const openEditForm = (note) => {
    setEditingId(note.id);
    setFormTitle(note.title || '');
    setFormContent(note.content || '');
    setIsCreating(true);
  };

  const handleSave = async () => {
    if (!formTitle && !formContent) {
      setIsCreating(false);
      return;
    }
    
    let updatedNotes;

    if (editingId) {
      updatedNotes = notes.map(n => 
        n.id === editingId ? { ...n, title: formTitle, content: formContent } : n
      );
    } else {
      const newNote = {
        id: crypto.randomUUID(),
        user_id: session?.user?.id,
        title: formTitle,
        content: formContent,
        color: ['var(--note-1)', 'var(--note-2)', 'var(--note-3)'][Math.floor(Math.random() * 3)],
        is_pinned: false,
        created_at: new Date().toISOString()
      };
      updatedNotes = [newNote, ...notes];
    }

    setNotes(updatedNotes.sort((a,b) => b.is_pinned - a.is_pinned));
    const userId = session?.user?.id;
    const cacheKey = userId ? `noor_notes_cache_${userId}` : 'noor_notes_cache';
    localStorage.setItem(cacheKey, JSON.stringify(updatedNotes));
    
    setIsCreating(false);

    if (session?.user?.id && session.user.id !== '00000000-0000-0000-0000-000000000000') {
      try {
        if (editingId) {
          await supabase.from('notes').update({ title: formTitle, content: formContent }).eq('id', editingId);
        } else {
          const noteObj = updatedNotes[0];
          await supabase.from('notes').insert({
            user_id: session.user.id, title: formTitle, content: formContent, color: noteObj.color
          });
        }
      } catch (err) {
        console.error("DB Save failed, but saved locally:", err);
      }
    }
  };

  const togglePin = async (id, currentVal) => {
    const newVal = !currentVal;
    const updated = notes.map(n => n.id === id ? { ...n, is_pinned: newVal } : n).sort((a,b) => b.is_pinned - a.is_pinned);
    setNotes(updated);
    const userId = session?.user?.id;
    const cacheKey = userId ? `noor_notes_cache_${userId}` : 'noor_notes_cache';
    localStorage.setItem(cacheKey, JSON.stringify(updated));
    
    if (session?.user?.id && session.user.id !== '00000000-0000-0000-0000-000000000000') {
      try {
        await supabase.from('notes').update({ is_pinned: newVal }).eq('id', id);
      } catch (err) {}
    }
  };

  const deleteNote = async (id) => {
    if (!window.confirm('Delete this note?')) return;
    const updated = notes.filter(n => n.id !== id);
    setNotes(updated);
    const userId = session?.user?.id;
    const cacheKey = userId ? `noor_notes_cache_${userId}` : 'noor_notes_cache';
    localStorage.setItem(cacheKey, JSON.stringify(updated));
    
    if (session?.user?.id && session.user.id !== '00000000-0000-0000-0000-000000000000') {
      try {
        await supabase.from('notes').delete().eq('id', id);
      } catch (err) {}
    }
  };

  const filteredNotes = notes.filter(n => 
    (n.title?.toLowerCase().includes(search.toLowerCase())) || 
    (n.content?.toLowerCase().includes(search.toLowerCase()))
  );

  const getNoteBackground = (color) => {
    if (color === '#1e293b') return 'var(--note-1)';
    if (color === '#334155') return 'var(--note-2)';
    if (color === '#0f172a') return 'var(--note-3)';
    return color || 'var(--bg-card)';
  };

  return (
    <div className="page-container animate-in">
      <header style={{ marginBottom: '24px' }}>
        <h1 style={{ fontSize: '2rem' }}>Smart Notes</h1>
      </header>

      <div style={{ position: 'relative', marginBottom: '24px' }}>
        <Search size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
        <input 
          type="text" 
          placeholder="Search notes..." 
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', padding: '14px 16px 14px 48px',
            background: 'var(--bg-card)', border: '1px solid var(--glass-border)',
            borderRadius: '12px', color: 'var(--text-main)', fontSize: '1rem', outline: 'none'
          }}
        />
      </div>

      {loading ? (
        <div style={{ textAlign: 'center', color: 'var(--text-muted)' }}>Loading...</div>
      ) : (
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
          {filteredNotes.map(note => (
            <div 
              key={note.id} 
              className="glass-panel" 
              onClick={() => openEditForm(note)}
              style={{ background: getNoteBackground(note.color), padding: '16px', position: 'relative', minHeight: '120px', display: 'flex', flexDirection: 'column', cursor: 'pointer', transition: 'transform 0.2s' }}
            >
              <div style={{ position: 'absolute', top: '12px', right: '12px', display: 'flex', gap: '4px' }}>
                <button onClick={(e) => { e.stopPropagation(); togglePin(note.id, note.is_pinned); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <Pin size={16} color={note.is_pinned ? 'var(--primary)' : 'var(--text-muted)'} />
                </button>
                <button onClick={(e) => { e.stopPropagation(); deleteNote(note.id); }} style={{ background: 'none', border: 'none', cursor: 'pointer', padding: '4px' }}>
                  <Trash2 size={16} color="var(--text-muted)" />
                </button>
              </div>
              <h3 style={{ fontSize: '1.1rem', marginBottom: '8px', paddingRight: '50px' }}>{note.title || 'Untitled'}</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', flex: 1, whiteSpace: 'pre-wrap', overflow: 'hidden', textOverflow: 'ellipsis', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical' }}>
                {note.content}
              </p>
            </div>
          ))}

          {filteredNotes.length === 0 && !isCreating && (
            <div style={{ gridColumn: '1 / -1', textAlign: 'center', padding: '40px 0', color: 'var(--text-muted)' }}>
              <p>No notes found.</p>
              <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Tap + to write your first smart note!</p>
            </div>
          )}
        </div>
      )}

      {/* FULL SCREEN MODAL FOR VIEWING / EDITING */}
      <AnimatePresence>
        {isCreating && (
          <motion.div 
            initial={{ opacity: 0, y: 100 }} animate={{ opacity: 1, y: 0 }} exit={{ opacity: 0, y: 100 }}
            style={{ position: 'fixed', inset: 0, background: 'var(--bg-darker)', zIndex: 9999, display: 'flex', flexDirection: 'column', padding: '24px', overflowY: 'auto' }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '24px' }}>
              <button onClick={() => setIsCreating(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '8px' }}>
                <X size={24}/> <span style={{ fontSize: '1rem' }}>Close</span>
              </button>
              <button className="btn-primary" onClick={handleSave} style={{ padding: '8px 20px' }}>Save</button>
            </div>
            
            <input 
              type="text" 
              placeholder="Note Title..." 
              value={formTitle}
              onChange={(e) => setFormTitle(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '2rem', fontWeight: 'bold', outline: 'none', width: '100%', marginBottom: '16px' }}
            />
            
            <textarea 
              placeholder="Start writing..." 
              value={formContent}
              onChange={(e) => setFormContent(e.target.value)}
              style={{ background: 'transparent', border: 'none', color: 'var(--text-main)', fontSize: '1.1rem', outline: 'none', width: '100%', flex: 1, resize: 'none', lineHeight: '1.6' }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {!isCreating && (
        <button 
          className="btn-primary" 
          onClick={openCreateForm}
          style={{ padding: 0, position: 'fixed', bottom: 'calc(var(--nav-height) + 24px)', right: '24px', width: '56px', height: '56px', borderRadius: '28px', display: 'flex', alignItems: 'center', justifyContent: 'center', boxShadow: '0 4px 20px rgba(59, 130, 246, 0.4)', zIndex: 10 }}>
          <Plus size={28} />
        </button>
      )}
    </div>
  );
};

export default Notes;
