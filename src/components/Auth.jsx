import React, { useState } from 'react';

const API_BASE = 'http://localhost:5000';

export default function Auth({ onAuthSuccess }) {
  const [mode, setMode] = useState('login');
  const [form, setForm] = useState({ name: '', email: '', password: '', avatar: '👨' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const avatars = ['👨', '👩', '👦', '👧', '🧑', '👴', '👵', '🤖'];

  const handleChange = (e) => {
    const { name, value } = e.target;
    setForm({ ...form, [name]: value });
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
      if (data.user?.avatar) localStorage.setItem('user_avatar', data.user.avatar);
      onAuthSuccess?.();
      window.location.reload();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-wrapper">
      <div className="auth-card">
        <div className="auth-header">
          <div className="auth-title">{mode === 'login' ? 'Welcome back' : 'Create your account'}</div>
          <div className="auth-subtitle">Virtual Office</div>
        </div>
        {error && (
          <div className="auth-error">{error}</div>
        )}
        <form onSubmit={submit} className="auth-form">
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
              <div className="avatar-grid">
                {avatars.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className={`avatar-item ${form.avatar === a ? 'selected' : ''}`}
                    onClick={() => setForm({ ...form, avatar: a })}
                    aria-pressed={form.avatar === a}
                  >
                    <span className="avatar-emoji" role="img" aria-label="avatar">{a}</span>
                  </button>
                ))}
              </div>
            </div>
          )}
          <button type="submit" className="btn auth-submit" disabled={loading}>
            {loading ? 'Please wait…' : mode === 'login' ? 'Login' : 'Register'}
          </button>
        </form>
        <div className="auth-switch">
          {mode === 'login' ? (
            <span>
              Need an account?
              <button className="link-btn" onClick={() => setMode('register')}>Register</button>
            </span>
          ) : (
            <span>
              Have an account?
              <button className="link-btn" onClick={() => setMode('login')}>Login</button>
            </span>
          )}
        </div>
      </div>
    </div>
  );
}


