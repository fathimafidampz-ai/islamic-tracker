import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { UploadCloud, FileAudio, FileText, Image as ImageIcon, Users, Activity, Loader2 } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

const AdminDashboard = ({ session }) => {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({ totalUsers: 0, totalWorshipLogs: 0 });
  const navigate = useNavigate();

  // Upload Form State
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState('Tajweed');
  const [fileType, setFileType] = useState('pdf');
  const [fileUrl, setFileUrl] = useState('');
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    // Bypassing real admin check for now
    setIsAdmin(true);
    setLoading(false);
    fetchStats();
  }, []);

  const fetchStats = async () => {
    try {
      // Very basic stats logic since count() across all tables requires admin privileges anyway
      const { count: recordCount } = await supabase.from('worship_records').select('*', { count: 'exact', head: true });
      setStats({ totalUsers: 'N/A', totalWorshipLogs: recordCount || 0 }); // total users requires auth admin api
    } catch (err) {
      console.error(err);
    }
  };

  const handleUpload = async (e) => {
    e.preventDefault();
    if (!title || !fileUrl) return;
    setUploading(true);
    
    try {
      const { error } = await supabase.from('app_content').insert({
        title, category, file_type: fileType, file_url: fileUrl
      });
      if (error) throw error;
      
      alert('Content uploaded successfully!');
      setTitle(''); setFileUrl('');
    } catch (err) {
      alert('Upload failed: ' + err.message);
    } finally {
      setUploading(false);
    }
  };

  if (loading) return <div className="page-container" style={{ display: 'flex', justifyContent: 'center', paddingTop: '50px' }}><Loader2 className="animate-spin" /></div>;
  if (!isAdmin) return null;

  return (
    <div className="page-container animate-in" style={{ paddingBottom: '100px' }}>
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2rem', color: 'var(--primary)' }}>Admin Portal</h1>
        <p style={{ color: 'var(--text-muted)' }}>Manage app content and view statistics</p>
      </header>

      {/* Stats Row */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Users size={32} color="#3b82f6" style={{ marginBottom: '12px' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.totalUsers}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Total Users</span>
        </div>
        <div className="glass-panel" style={{ padding: '20px', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
          <Activity size={32} color="#10b981" style={{ marginBottom: '12px' }} />
          <span style={{ fontSize: '1.5rem', fontWeight: 'bold' }}>{stats.totalWorshipLogs}</span>
          <span style={{ color: 'var(--text-muted)', fontSize: '0.9rem' }}>Worship Logs</span>
        </div>
      </div>

      {/* Upload Form */}
      <div className="glass-panel">
        <h2 style={{ fontSize: '1.2rem', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '8px' }}>
          <UploadCloud size={20} color="var(--primary)" /> Publish New Content
        </h2>
        
        <form onSubmit={handleUpload} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <input 
            type="text" 
            placeholder="Content Title (e.g., Morning Adhkar Audio)" 
            value={title} onChange={(e) => setTitle(e.target.value)}
            style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
            required
          />
          
          <div style={{ display: 'flex', gap: '16px' }}>
            <select 
              value={category} onChange={(e) => setCategory(e.target.value)}
              style={{ flex: 1, padding: '14px', background: 'var(--bg-darker)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
            >
              <option value="Tajweed">Tajweed Lesson</option>
              <option value="Dua">Dua Collection</option>
            </select>
            
            <select 
              value={fileType} onChange={(e) => setFileType(e.target.value)}
              style={{ flex: 1, padding: '14px', background: 'var(--bg-darker)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
            >
              <option value="pdf">Document (.pdf)</option>
              <option value="image">Image (.jpg)</option>
            </select>
          </div>

          <input 
            type="url" 
            placeholder="Paste File URL here (from Supabase Storage)" 
            value={fileUrl} onChange={(e) => setFileUrl(e.target.value)}
            style={{ width: '100%', padding: '14px', background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', borderRadius: '8px', color: 'white', outline: 'none' }}
            required
          />
          
          <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Note: For the MVP, please upload the physical file to your Supabase Storage bucket, and paste the public URL link here.</p>

          <button type="submit" className="btn-primary" disabled={uploading}>
            {uploading ? 'Publishing...' : 'Publish Content'}
          </button>
        </form>
      </div>
    </div>
  );
};

export default AdminDashboard;
