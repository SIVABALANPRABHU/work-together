import React, { useState } from 'react';

const API_BASE = 'http://localhost:5000';

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', avatar: '👨' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const avatars = ['👨', '👩', '👦', '👧', '🧑', '👴', '👵', '🤖'];

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value });
  };

  const submit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const res = await fetch(`${API_BASE}/api/auth/${mode}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          email: form.email,
          password: form.password,
          avatar: form.avatar,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed');
      localStorage.setItem('token', data.token);
      localStorage.setItem('user_name', data.user?.name || '');
      onAuthSuccess?.();
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="controls" style={{ maxWidth: 380, margin: '12% auto' }}>
      <h3 style={{ marginBottom: 12 }}>{mode === 'login' ? 'Login' : 'Create account'}</h3>
      {error && (
        <div style={{ color: '#ff6b6b', marginBottom: 8 }}>{error}</div>
      )}
      <form onSubmit={submit}>
        {mode === 'register' && (
          <div className="control-group">
            <label htmlFor="name">Name</label>
            <input id="name" name="name" value={form.name} onChange={handleChange} required />
          </div>
        )}
        <div className="control-group">
          <label htmlFor="email">Email</label>
          <input id="email" type="email" name="email" value={form.email} onChange={handleChange} required />
        </div>
        <div className="control-group">
          <label htmlFor="password">Password</label>
          <input id="password" type="password" name="password" value={form.password} onChange={handleChange} required />
        </div>
        {mode === 'register' && (
          <div className="control-group">
            <label htmlFor="avatar">Avatar</label>
            <select id="avatar" name="avatar" value={form.avatar} onChange={handleChange}>
              {avatars.map((a) => (
                <option key={a} value={a}>{a}</option>
              ))}
            </select>
          </div>
        )}
        <button type="submit" className="btn" disabled={loading}>
          {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}
        </button>
      </form>
      <div style={{ marginTop: 10, fontSize: 12 }}>
        {mode === 'login' ? (
          <span>
            Need an account?{' '}
            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setMode('register')}>Register</button>
          </span>
        ) : (
          <span>
            Have an account?{' '}
            <button className="btn" style={{ padding: '4px 8px' }} onClick={() => setMode('login')}>Login</button>
          </span>
        )}
      </div>
    </div>
  );
}


