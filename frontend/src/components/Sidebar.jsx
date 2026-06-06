import React, { useState, useRef } from 'react';
import axios from 'axios';
import { 
  FileText, 
  Upload, 
  Trash2, 
  LogOut, 
  Settings, 
  X, 
  Plus, 
  AlignLeft, 
  Compass, 
  Check 
} from 'lucide-react';

const API_BASE = 'http://localhost:8000/api';

export default function Sidebar({ 
  user, 
  files, 
  onLogout, 
  fetchFiles, 
  token, 
  showToast,
  selectedFileIds,
  setSelectedFileIds,
  groqKey,
  setGroqKey
}) {
  const [uploading, setUploading] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [showSettingsModal, setShowSettingsModal] = useState(false);
  
  // Text note state
  const [noteTitle, setNoteTitle] = useState('');
  const [noteContent, setNoteContent] = useState('');
  const [savingNote, setSavingNote] = useState(false);

  // Settings key state
  const [tempKey, setTempKey] = useState(groqKey);

  const fileInputRef = useRef(null);

  const handleFileUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase();
    if (ext !== '.pdf' && ext !== '.txt') {
      showToast('Unsupported file format. Only PDF and TXT are allowed.', 'warning');
      return;
    }

    setUploading(true);
    const formData = new FormData();
    formData.append('file', file);

    try {
      await axios.post(`${API_BASE}/files/upload`, formData, {
        headers: {
          Authorization: `Bearer ${token}`,
          'Content-Type': 'multipart/form-data'
        }
      });
      showToast('File uploaded and indexed successfully!', 'success');
      fetchFiles();
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Failed to upload file.';
      showToast(errMsg, 'error');
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteFile = async (e, fileId) => {
    e.stopPropagation(); // Avoid selecting the file item when clicking delete
    
    if (!confirm('Are you sure you want to delete this file? This will remove it from search index.')) return;

    try {
      await axios.delete(`${API_BASE}/files/${fileId}`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      showToast('File deleted successfully', 'success');
      
      // Clean up selected items
      setSelectedFileIds(prev => prev.filter(id => id !== fileId));
      fetchFiles();
    } catch (err) {
      console.error(err);
      showToast('Failed to delete file.', 'error');
    }
  };

  const handleSaveTextNote = async (e) => {
    e.preventDefault();
    if (!noteTitle.strip() || !noteContent.strip()) {
      showToast('Please provide both a title and text content.', 'warning');
      return;
    }

    setSavingNote(true);
    try {
      await axios.post(
        `${API_BASE}/files/text`, 
        { title: noteTitle, content: noteContent },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      showToast('Text note successfully indexed!', 'success');
      setNoteTitle('');
      setNoteContent('');
      setShowTextModal(false);
      fetchFiles();
    } catch (err) {
      console.error(err);
      const errMsg = err.response?.data?.detail || 'Failed to save note.';
      showToast(errMsg, 'error');
    } finally {
      setSavingNote(false);
    }
  };

  const handleSaveSettings = (e) => {
    e.preventDefault();
    setGroqKey(tempKey);
    localStorage.setItem('groq_api_key', tempKey);
    showToast('Settings saved successfully!', 'success');
    setShowSettingsModal(false);
  };

  const handleSelectFile = (fileId) => {
    setSelectedFileIds(prev => {
      if (prev.includes(fileId)) {
        return prev.filter(id => id !== fileId);
      } else {
        return [...prev, fileId];
      }
    });
  };

  return (
    <aside className="sidebar">
      {/* Header */}
      <div className="sidebar-header">
        <Compass className="sidebar-logo-icon" size={24} />
        <span className="sidebar-logo-text">AETHER RAG</span>
        
        <button 
          className="settings-toggle" 
          onClick={() => {
            setTempKey(groqKey);
            setShowSettingsModal(true);
          }}
          title="Settings"
          style={{ marginLeft: 'auto' }}
        >
          <Settings size={18} />
        </button>
      </div>

      {/* File Action & Files List */}
      <div className="file-section">
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="section-title">Knowledge Base</span>
          <button 
            className="btn btn-secondary" 
            style={{ padding: '4px 8px', fontSize: '0.8rem', borderRadius: '6px' }}
            onClick={() => setShowTextModal(true)}
          >
            <Plus size={14} /> Add Text
          </button>
        </div>

        {/* Upload box */}
        <div className="upload-box" onClick={() => fileInputRef.current.click()}>
          <Upload className="upload-icon" size={28} />
          <span className="upload-title">
            {uploading ? 'Processing...' : 'Upload Document'}
          </span>
          <span className="upload-subtitle">PDF, TXT up to 10MB</span>
          <input 
            type="file" 
            ref={fileInputRef} 
            onChange={handleFileUpload} 
            style={{ display: 'none' }} 
            accept=".pdf,.txt"
            disabled={uploading}
          />
        </div>

        {/* File list */}
        <div>
          <span className="section-title" style={{ fontSize: '0.7rem', display: 'block', marginBottom: '8px' }}>
            My Files ({files.length})
            {files.length > 0 && <span style={{ textTransform: 'none', color: 'var(--text-muted)', marginLeft: '6px' }}>
              (Select files to filter query)
            </span>}
          </span>
          
          {files.length === 0 ? (
            <div className="empty-files">
              No documents uploaded. Add PDF or paste text to get started.
            </div>
          ) : (
            <div className="file-list">
              {files.map(file => {
                const isSelected = selectedFileIds.includes(file.id);
                return (
                  <div 
                    key={file.id} 
                    className={`file-item ${isSelected ? 'selected' : ''}`}
                    onClick={() => handleSelectFile(file.id)}
                    style={{ 
                      cursor: 'pointer',
                      borderColor: isSelected ? 'var(--primary)' : 'rgba(255,255,255,0.04)',
                      background: isSelected ? 'rgba(99, 102, 241, 0.05)' : 'rgba(255, 255, 255, 0.02)'
                    }}
                  >
                    <div className="file-info">
                      <div 
                        style={{ 
                          width: '18px', 
                          height: '18px', 
                          borderRadius: '4px', 
                          border: '1px solid var(--text-muted)',
                          display: 'flex', 
                          alignItems: 'center', 
                          justifyContent: 'center',
                          backgroundColor: isSelected ? 'var(--primary)' : 'transparent',
                          borderColor: isSelected ? 'var(--primary)' : 'var(--text-muted)',
                          marginRight: '4px',
                          color: 'white'
                        }}
                      >
                        {isSelected && <Check size={12} strokeWidth={3} />}
                      </div>
                      <FileText size={16} className="file-icon" />
                      <span className="file-name" title={file.filename}>
                        {file.filename}
                      </span>
                    </div>
                    
                    <button 
                      className="file-delete-btn"
                      onClick={(e) => handleDeleteFile(e, file.id)}
                      title="Delete document"
                    >
                      <Trash2 size={14} />
                    </button>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* User Section / Footer */}
      <div className="sidebar-footer">
        <div className="user-profile">
          <div className="user-avatar">
            {user?.email?.charAt(0).toUpperCase() || 'U'}
          </div>
          <div className="user-details">
            <p className="user-email">{user?.email || 'user@example.com'}</p>
            <p className="user-role">Knowledge Owner</p>
          </div>
        </div>
        
        <button className="btn btn-danger" onClick={onLogout} style={{ width: '100%' }}>
          <LogOut size={16} /> Sign Out
        </button>
      </div>

      {/* MODAL: Direct Text Ingestion */}
      {showTextModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3 className="modal-title">Index Text Content</h3>
              <button className="modal-close-btn" onClick={() => setShowTextModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveTextNote} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Title / Document Name</label>
                <input 
                  type="text" 
                  className="glass-input" 
                  placeholder="e.g. Project Notes, API Rules" 
                  value={noteTitle}
                  onChange={(e) => setNoteTitle(e.target.value)}
                  required
                />
              </div>
              <div className="form-group">
                <label className="form-label">Text Content</label>
                <textarea 
                  className="glass-input" 
                  style={{ minHeight: '160px', resize: 'vertical' }}
                  placeholder="Paste your text content here. It will be split into chunks and indexed in your vector store." 
                  value={noteContent}
                  onChange={(e) => setNoteContent(e.target.value)}
                  required
                />
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowTextModal(false)}
                  disabled={savingNote}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                  disabled={savingNote}
                >
                  {savingNote ? 'Indexing...' : 'Save & Index'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: Settings */}
      {showSettingsModal && (
        <div className="modal-overlay">
          <div className="modal-content glass-panel">
            <div className="modal-header">
              <h3 className="modal-title">System Settings</h3>
              <button className="modal-close-btn" onClick={() => setShowSettingsModal(false)}>
                <X size={18} />
              </button>
            </div>
            
            <form onSubmit={handleSaveSettings} style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="form-group">
                <label className="form-label">Groq API Key (Optional)</label>
                <input 
                  type="password" 
                  className="glass-input" 
                  placeholder="gsk_..." 
                  value={tempKey}
                  onChange={(e) => setTempKey(e.target.value)}
                />
                <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', lineHeight: '1.4' }}>
                  If provided, this key will be used for your chats (not saved to database, stored in browser local storage). If left blank, the backend will use the default server key.
                </span>
              </div>
              
              <div style={{ display: 'flex', gap: '12px', justifyContent: 'flex-end', marginTop: '8px' }}>
                <button 
                  type="button" 
                  className="btn btn-secondary" 
                  onClick={() => setShowSettingsModal(false)}
                >
                  Cancel
                </button>
                <button 
                  type="submit" 
                  className="btn btn-primary"
                >
                  Save Settings
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </aside>
  );
}

// polyfill string strip for older runtimes
if (!String.prototype.strip) {
  String.prototype.strip = function () {
    return this.replace(/^\s+|\s+$/g, '');
  };
}
