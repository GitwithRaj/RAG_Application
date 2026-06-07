import React, { useState } from 'react';
import axios from 'axios';
import { Mail, Lock, UserPlus, LogIn, Sparkles } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE;

export default function Auth({ onAuthSuccess, showToast }) {
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) {
      showToast('Please fill in all fields', 'warning');
      return;
    }

    setLoading(true);
    try {
      if (isLogin) {
        // Form urlencoded request for OAuth2PasswordRequestForm
        const params = new URLSearchParams();
        params.append('username', email);
        params.append('password', password);

        const res = await axios.post(`${API_BASE}/api/auth/login`, params, {
          headers: { 'Content-Type': 'application/x-www-form-urlencoded' }
        });
        
        const token = res.data.access_token;
        localStorage.setItem('token', token);
        
        // Get user info
        const meRes = await axios.get(`${API_BASE}/api/auth/me`, {
          headers: { Authorization: `Bearer ${token}` }
        });
        
        showToast('Login successful!', 'success');
        onAuthSuccess(token, meRes.data);
      } else {
        await axios.post(`${API_BASE}/api/auth/register`, { email, password });
        showToast('Registration successful! Please login.', 'success');
        setIsLogin(true);
        setPassword('');
      }
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'An error occurred. Please try again.';
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="auth-container">
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>
      
      <div className="auth-card glass-panel">
        <div style={{ display: 'flex', justifyContent: 'center', marginBottom: '12px' }}>
          <Sparkles className="welcome-icon" size={40} />
        </div>
        <h1 className="auth-logo">Aether RAG</h1>
        <p className="auth-subtitle">
          {isLogin 
            ? 'Sign in to access your secure knowledge base' 
            : 'Create a new secure knowledge base account'}
        </p>

        <form className="auth-form" onSubmit={handleSubmit}>
          <div className="form-group">
            <label className="form-label">Email Address</label>
            <div style={{ position: 'relative' }}>
              <Mail 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)' 
                }} 
              />
              <input
                type="email"
                className="glass-input"
                placeholder="you@example.com"
                style={{ width: '100%', paddingLeft: '44px' }}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <div className="form-group">
            <label className="form-label">Password</label>
            <div style={{ position: 'relative' }}>
              <Lock 
                size={18} 
                style={{ 
                  position: 'absolute', 
                  left: '14px', 
                  top: '50%', 
                  transform: 'translateY(-50%)', 
                  color: 'var(--text-muted)' 
                }} 
              />
              <input
                type="password"
                className="glass-input"
                placeholder="••••••••"
                style={{ width: '100%', paddingLeft: '44px' }}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={loading}
              />
            </div>
          </div>

          <button 
            type="submit" 
            className="btn btn-primary" 
            style={{ width: '100%', padding: '14px', marginTop: '10px' }}
            disabled={loading}
          >
            {loading ? (
              <span className="skeleton-line" style={{ width: '50px', height: '14px' }}></span>
            ) : isLogin ? (
              <>
                <LogIn size={18} /> Sign In
              </>
            ) : (
              <>
                <UserPlus size={18} /> Register Account
              </>
            )}
          </button>
        </form>

        <div className="auth-footer">
          {isLogin ? (
            <p>
              Don't have an account?{' '}
              <span className="auth-link" onClick={() => setIsLogin(false)}>
                Register here
              </span>
            </p>
          ) : (
            <p>
              Already have an account?{' '}
              <span className="auth-link" onClick={() => setIsLogin(true)}>
                Sign in here
              </span>
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
