import React, { useState } from 'react';
import { supabase } from '../lib/supabase';
import { Mail, Lock, Loader2 } from 'lucide-react';

const Auth = ({ onLogin }) => {
  const [isSignUp, setIsSignUp] = useState(false);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const handleAuth = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);

    try {
      if (isSignUp) {
        const { error } = await supabase.auth.signUp({ email, password });
        if (error) throw error;
        alert('Check your email for the login link, or if you disabled email confirmation, just click Sign In!');
        setIsSignUp(false);
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        onLogin(); // Trigger app state update
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="page-container" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'center', minHeight: '100vh', paddingBottom: '24px' }}>
      <div style={{ textAlign: 'center', marginBottom: '40px' }} className="animate-in">
        <h1 style={{ fontSize: '2.5rem', color: 'var(--primary)', marginBottom: '8px' }}>Noor</h1>
        <p style={{ color: 'var(--text-muted)' }}>Your Islamic Productivity Companion</p>
      </div>

      <form onSubmit={handleAuth} className="glass-panel animate-in" style={{ animationDelay: '0.1s', display: 'flex', flexDirection: 'column', gap: '20px' }}>
        <h2 style={{ fontSize: '1.5rem', marginBottom: '10px', textAlign: 'center' }}>
          {isSignUp ? 'Create Account' : 'Welcome Back'}
        </h2>

        {error && (
          <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.3)', padding: '12px', borderRadius: '8px', color: '#fca5a5', fontSize: '0.9rem', textAlign: 'center' }}>
            {error}
          </div>
        )}

        <div style={{ position: 'relative' }}>
          <Mail size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="email"
            placeholder="Email address"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            style={{
              width: '100%', padding: '16px 16px 16px 48px',
              background: 'var(--bg-dark)', border: '1px solid var(--glass-border)',
              borderRadius: '12px', color: 'var(--text-main)', fontSize: '1rem', outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
          />
        </div>

        <div style={{ position: 'relative' }}>
          <Lock size={20} style={{ position: 'absolute', left: '16px', top: '50%', transform: 'translateY(-50%)', color: 'var(--text-muted)' }} />
          <input
            type="password"
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            style={{
              width: '100%', padding: '16px 16px 16px 48px',
              background: 'var(--bg-dark)', border: '1px solid var(--glass-border)',
              borderRadius: '12px', color: 'var(--text-main)', fontSize: '1rem', outline: 'none',
              transition: 'border-color 0.2s ease'
            }}
          />
        </div>

        <button type="submit" className="btn-primary" disabled={loading} style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', gap: '8px' }}>
          {loading && <Loader2 size={20} style={{ animation: 'spin 1s linear infinite' }} />}
          {isSignUp ? 'Sign Up' : 'Sign In'}
        </button>
      </form>

      <div style={{ textAlign: 'center', marginTop: '24px' }} className="animate-in">
        <button 
          type="button"
          onClick={() => { setIsSignUp(!isSignUp); setError(null); }} 
          style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '0.9rem', cursor: 'pointer', textDecoration: 'underline' }}
        >
          {isSignUp ? 'Already have an account? Sign In' : "Don't have an account? Sign Up"}
        </button>
      </div>
      
      <style>{`
        @keyframes spin { 100% { transform: rotate(360deg); } }
        input:focus { border-color: var(--primary) !important; }
      `}</style>
    </div>
  );
};

export default Auth;
