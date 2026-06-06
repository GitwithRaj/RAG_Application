import React, { useState, useEffect, useCallback } from 'react';
import axios from 'axios';
import Auth from './components/Auth';
import Sidebar from './components/Sidebar';
import ChatArea from './components/ChatArea';
import { Sparkles, Compass } from 'lucide-react';

const API_BASE = import.meta.env.VITE_API_BASE;

export default function App() {
  const [token, setToken] = useState(localStorage.getItem('token') || '');
  const [user, setUser] = useState(null);
  const [files, setFiles] = useState([]);
  const [selectedFileIds, setSelectedFileIds] = useState([]);
  const [messages, setMessages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [appInitializing, setAppInitializing] = useState(true);

  // Custom API key from UI
  const [groqKey, setGroqKey] = useState(localStorage.getItem('groq_api_key') || '');

  // Toast notifications
  const [toast, setToast] = useState({ show: false, message: '', type: 'success' });

  const showToast = useCallback((message, type = 'success') => {
    setToast({ show: true, message, type });
    // auto-dismiss toast after 4s
    setTimeout(() => {
      setToast(prev => ({ ...prev, show: false }));
    }, 4000);
  }, []);

  const fetchFiles = useCallback(async (authToken = token) => {
    if (!authToken) return;
    try {
      const res = await axios.get(`${API_BASE}/files`, {
        headers: { Authorization: `Bearer ${authToken}` }
      });
      setFiles(res.data);
    } catch (err) {
      console.error('Failed to fetch files:', err);
    }
  }, [token]);

  const initSession = useCallback(async () => {
    const storedToken = localStorage.getItem('token');
    if (!storedToken) {
      setAppInitializing(false);
      return;
    }

    try {
      const meRes = await axios.get(`${API_BASE}/auth/me`, {
        headers: { Authorization: `Bearer ${storedToken}` }
      });
      setToken(storedToken);
      setUser(meRes.data);
      await fetchFiles(storedToken);
    } catch (err) {
      console.error('Session expired or invalid:', err);
      // clean up stale token
      localStorage.removeItem('token');
      setToken('');
      setUser(null);
    } finally {
      setAppInitializing(false);
    }
  }, [fetchFiles]);

  useEffect(() => {
    initSession();
  }, [initSession]);

  const handleAuthSuccess = (newToken, userData) => {
    setToken(newToken);
    setUser(userData);
    fetchFiles(newToken);
  };

  const handleLogout = () => {
    localStorage.removeItem('token');
    setToken('');
    setUser(null);
    setFiles([]);
    setMessages([]);
    setSelectedFileIds([]);
    showToast('Signed out successfully.', 'info');
  };

  const handleSendMessage = async (text) => {
    const userMsg = { role: 'user', content: text };
    setMessages(prev => [...prev, userMsg]);
    setLoading(true);

    try {
      const headers = {
        Authorization: `Bearer ${token}`
      };

      // If user provided custom key in settings, pass it in headers
      if (groqKey) {
        headers['X-Groq-Api-Key'] = groqKey;
      }

      const res = await axios.post(
        `${API_BASE}/chat/query`,
        {
          question: text,
          file_ids: selectedFileIds.length > 0 ? selectedFileIds : null
        },
        { headers }
      );

      const assistantMsg = {
        role: 'assistant',
        content: res.data.answer,
        sources: res.data.sources
      };
      setMessages(prev => [...prev, assistantMsg]);
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Failed to get answer. Please check if backend is running or your Groq API key is valid.';
      setMessages(prev => [...prev, {
        role: 'assistant',
        content: `⚠️ Error: ${errMsg}`,
        sources: []
      }]);
      showToast(errMsg, 'error');
    } finally {
      setLoading(false);
    }
  };

  if (appInitializing) {
    return (
      <div style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        minHeight: '100vh',
        backgroundColor: 'var(--bg-base)',
        color: 'var(--text-primary)',
        fontFamily: 'var(--font-heading)',
        gap: '16px'
      }}>
        <Compass className="welcome-icon" size={48} style={{ animation: 'spin 3s linear infinite' }} />
        <h2 style={{ fontWeight: 600 }}>Initializing RAG Session...</h2>
      </div>
    );
  }

  return (
    <>
      {/* Background glow templates */}
      <div className="ambient-glow-1"></div>
      <div className="ambient-glow-2"></div>

      {!token ? (
        <Auth onAuthSuccess={handleAuthSuccess} showToast={showToast} />
      ) : (
        <div className="dashboard-container">
          <Sidebar
            user={user}
            files={files}
            token={token}
            fetchFiles={fetchFiles}
            onLogout={handleLogout}
            showToast={showToast}
            selectedFileIds={selectedFileIds}
            setSelectedFileIds={setSelectedFileIds}
            groqKey={groqKey}
            setGroqKey={setGroqKey}
          />
          <ChatArea
            messages={messages}
            loading={loading}
            onSendMessage={handleSendMessage}
            filesCount={files.length}
            selectedFileIds={selectedFileIds}
          />
        </div>
      )}

      {/* Global Toast Alert */}
      {toast.show && (
        <div className={`toast-notification ${toast.type}`}>
          {toast.message}
        </div>
      )}
    </>
  );
}
