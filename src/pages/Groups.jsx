import React, { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Users, UserPlus, ShieldPlus, ChevronRight } from 'lucide-react';

const Groups = ({ session }) => {
  const [myGroups, setMyGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const [showJoin, setShowJoin] = useState(false);
  const [showCreate, setShowCreate] = useState(false);
  
  const [inviteCode, setInviteCode] = useState('');
  const [newGroupName, setNewGroupName] = useState('');

  useEffect(() => {
    fetchMyGroups();
  }, []);

  const fetchMyGroups = async () => {
    try {
      const { data: memberRecords, error } = await supabase
        .from('group_members')
        .select('group_id, groups(*)')
        .eq('user_id', session.user.id);
        
      if (error) throw error;
      
      const groups = memberRecords?.map(record => record.groups) || [];
      setMyGroups(groups);
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleCreateGroup = async () => {
    if (!newGroupName) return;
    try {
      // Generate random 6 character code
      const code = Math.random().toString(36).substring(2, 8).toUpperCase();
      
      const { data: newGroup, error: groupError } = await supabase
        .from('groups')
        .insert({ name: newGroupName, invite_code: code, created_by: session.user.id })
        .select().single();
        
      if (groupError) throw groupError;
      
      // Auto join the group we just created
      await supabase.from('group_members').insert({ group_id: newGroup.id, user_id: session.user.id });
      
      setMyGroups([...myGroups, newGroup]);
      setShowCreate(false);
      setNewGroupName('');
      alert(`Group created! Invite code is: ${code}`);
    } catch (err) {
      console.error(err);
      alert('Error creating group');
    }
  };

  const handleJoinGroup = async () => {
    if (!inviteCode) return;
    try {
      // Find the group
      const { data: group, error: findError } = await supabase
        .from('groups')
        .select('*')
        .eq('invite_code', inviteCode.toUpperCase())
        .single();
        
      if (findError || !group) throw new Error('Group not found');
      
      // Join it
      const { error: joinError } = await supabase
        .from('group_members')
        .insert({ group_id: group.id, user_id: session.user.id });
        
      if (joinError) {
        if (joinError.code === '23505') throw new Error('You are already in this group');
        throw joinError;
      }
      
      setMyGroups([...myGroups, group]);
      setShowJoin(false);
      setInviteCode('');
    } catch (err) {
      console.error(err);
      alert(err.message || 'Error joining group');
    }
  };

  return (
    <div className="page-container animate-in">
      <header style={{ marginBottom: '30px' }}>
        <h1 style={{ fontSize: '2rem' }}>Accountability Groups</h1>
        <p style={{ color: 'var(--text-muted)' }}>Grow together with friends and family</p>
      </header>

      {/* Action Buttons */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px', marginBottom: '32px' }}>
        <button 
          onClick={() => { setShowJoin(true); setShowCreate(false); }}
          className="glass-panel" 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px', border: showJoin ? '1px solid var(--primary)' : '1px solid var(--glass-border)' }}
        >
          <UserPlus size={28} color="var(--primary)" />
          <span style={{ fontWeight: '600' }}>Join Group</span>
        </button>
        <button 
          onClick={() => { setShowCreate(true); setShowJoin(false); }}
          className="glass-panel" 
          style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '12px', padding: '20px', border: showCreate ? '1px solid var(--success)' : '1px solid var(--glass-border)' }}
        >
          <ShieldPlus size={28} color="var(--success)" />
          <span style={{ fontWeight: '600' }}>Create Group</span>
        </button>
      </div>

      {/* Dynamic Forms */}
      {showJoin && (
        <div className="glass-panel animate-in" style={{ marginBottom: '32px', display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="Enter 6-digit Invite Code" 
            value={inviteCode}
            onChange={e => setInviteCode(e.target.value)}
            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '8px', outline: 'none', textTransform: 'uppercase' }}
          />
          <button className="btn-primary" onClick={handleJoinGroup}>Join</button>
        </div>
      )}

      {showCreate && (
        <div className="glass-panel animate-in" style={{ marginBottom: '32px', display: 'flex', gap: '12px' }}>
          <input 
            type="text" 
            placeholder="New Group Name" 
            value={newGroupName}
            onChange={e => setNewGroupName(e.target.value)}
            style={{ flex: 1, background: 'rgba(0,0,0,0.2)', border: '1px solid var(--glass-border)', color: 'white', padding: '12px', borderRadius: '8px', outline: 'none' }}
          />
          <button className="btn-primary" onClick={handleCreateGroup} style={{ background: 'var(--success)', boxShadow: '0 4px 14px rgba(16, 185, 129, 0.4)' }}>Create</button>
        </div>
      )}

      {/* Groups List */}
      <h3 style={{ fontSize: '1.2rem', marginBottom: '16px' }}>My Groups</h3>
      {loading ? (
        <div style={{ color: 'var(--text-muted)' }}>Loading groups...</div>
      ) : myGroups.length === 0 ? (
        <div className="glass-panel" style={{ textAlign: 'center', padding: '40px 20px', color: 'var(--text-muted)' }}>
          <Users size={40} style={{ margin: '0 auto 16px', opacity: 0.5 }} />
          <p>You haven't joined any groups yet.</p>
          <p style={{ fontSize: '0.9rem', marginTop: '8px' }}>Create one or ask a friend for an invite code!</p>
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
          {myGroups.map(group => (
            <div key={group.id} className="glass-panel" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}>
              <div>
                <h4 style={{ fontSize: '1.1rem', marginBottom: '4px' }}>{group.name}</h4>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>Code: <strong style={{ color: 'var(--primary)', letterSpacing: '1px' }}>{group.invite_code}</strong></p>
              </div>
              <ChevronRight size={20} color="var(--text-muted)" />
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default Groups;
