import React, { useState, useCallback } from 'react';
import axios from 'axios';
import Layout from './Layout';
import '../styles/Dashboard.css';
import { FiRefreshCw, FiTrash2, FiUserPlus } from 'react-icons/fi';
import usePolling from '../utils/usePolling';

export default function Users() {
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [lastUpdated, setLastUpdated] = useState(null);

  // Delete flow state
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [deleteStep, setDeleteStep] = useState('confirm');
  const [deleteCode, setDeleteCode] = useState('');
  const [deleteLoading, setDeleteLoading] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [sendingCode, setSendingCode] = useState(false);

  // Add user flow state
  const [showAddModal, setShowAddModal] = useState(false);
  const [addStep, setAddStep] = useState('form'); // 'form' | 'code'
  const [addForm, setAddForm] = useState({ username: '', email: '', password: '', role: 'user' });
  const [addCode, setAddCode] = useState('');
  const [addLoading, setAddLoading] = useState(false);
  const [addError, setAddError] = useState('');
  const [addSuccess, setAddSuccess] = useState('');
  const [sendingAddCode, setSendingAddCode] = useState(false);

  const fetchUsers = useCallback(async () => {
    try {
      const res = await axios.get('/users');
      setUsers(res.data || []);
      setLastUpdated(new Date());
      setError('');
    } catch (err) {
      setError('Could not load users');
    } finally {
      setLoading(false);
    }
  }, []);

  usePolling(fetchUsers, 20000);

  const openDeleteModal = (user) => {
    setDeleteTarget(user);
    setDeleteStep('confirm');
    setDeleteCode('');
    setDeleteError('');
  };

  const closeDeleteModal = () => {
    setDeleteTarget(null);
    setDeleteCode('');
    setDeleteError('');
    setDeleteStep('confirm');
  };

  const handleSendCode = async () => {
    setSendingCode(true);
    setDeleteError('');
    try {
      await axios.post('/users/me/2fa/send', { type: 'delete-user' });
      setDeleteStep('code');
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Failed to send code');
    } finally {
      setSendingCode(false);
    }
  };

  const handleDeleteConfirm = async () => {
    if (!deleteCode) return setDeleteError('Enter the verification code');
    setDeleteLoading(true);
    setDeleteError('');
    try {
      await axios.delete(`/users/${deleteTarget._id}`, { data: { code: deleteCode } });
      setUsers(prev => prev.filter(u => u._id !== deleteTarget._id));
      closeDeleteModal();
    } catch (err) {
      setDeleteError(err.response?.data?.message || 'Delete failed');
    } finally {
      setDeleteLoading(false);
    }
  };

  // ── Add User handlers ──
  const openAddModal = () => {
    setShowAddModal(true);
    setAddStep('form');
    setAddForm({ username: '', email: '', password: '', role: 'user' });
    setAddCode('');
    setAddError('');
    setAddSuccess('');
  };

  const closeAddModal = () => {
    setShowAddModal(false);
    setAddCode('');
    setAddError('');
    setAddSuccess('');
  };

  const handleAddSendCode = async () => {
    if (!addForm.username || !addForm.email || !addForm.password) {
      return setAddError('Please fill in all fields first');
    }
    setSendingAddCode(true);
    setAddError('');
    try {
      await axios.post('/users/me/2fa/send', { type: 'add-user' });
      setAddStep('code');
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to send code');
    } finally {
      setSendingAddCode(false);
    }
  };

  const handleAddConfirm = async () => {
    if (!addCode) return setAddError('Enter the verification code');
    setAddLoading(true);
    setAddError('');
    try {
      const res = await axios.post('/users/admin/add-user', { ...addForm, code: addCode });
      setUsers(prev => [...prev, res.data.user]);
      setAddSuccess(`User "${addForm.username}" created successfully!`);
      setTimeout(() => closeAddModal(), 2000);
    } catch (err) {
      setAddError(err.response?.data?.message || 'Failed to create user');
    } finally {
      setAddLoading(false);
    }
  };

  return (
    <Layout>
        <div className="dashboard-content">
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
            <div className="page-heading" style={{ margin: 0 }}>
              <h2>Users</h2>
              <p>Manage user accounts and roles.</p>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {lastUpdated && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#94a3b8', fontSize: 12 }}>
                  <FiRefreshCw size={12} /> Updated {lastUpdated.toLocaleTimeString()}
                </div>
              )}
              <button className="add-btn" onClick={openAddModal}>
                <FiUserPlus /> Add User
              </button>
            </div>
          </div>

          <div className="assets-table-section">
            <h3>Registered Users ({users.length})</h3>
            {loading ? (
              <p style={{ color: '#aaa' }}>Loading users...</p>
            ) : error ? (
              <p style={{ color: 'red' }}>{error}</p>
            ) : users.length === 0 ? (
              <p>No users found.</p>
            ) : (
              <div className="assets-table">
                <table>
                  <thead>
                    <tr>
                      <th>Username</th>
                      <th>Email</th>
                      <th>Phone</th>
                      <th>Role</th>
                      <th>2FA</th>
                      <th>Joined</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {users.map(u => (
                      <tr key={u._id || u.id}>
                        <td>{u.username}</td>
                        <td>{u.email}</td>
                        <td>{u.phone || '—'}</td>
                        <td>
                          <span className={`status ${u.role === 'admin' ? 'active' : u.role === 'manager' ? 'maintenance' : 'inactive'}`}>
                            {u.role || 'user'}
                          </span>
                        </td>
                        <td>{u.twoFactorEnabled ? '✅' : '—'}</td>
                        <td>{u.joinedAt ? new Date(u.joinedAt).toLocaleDateString() : '—'}</td>
                        <td>
                          <button
                            className="delete-btn"
                            title="Delete user"
                            onClick={() => openDeleteModal(u)}
                            style={{ padding: '6px 10px' }}
                          >
                            <FiTrash2 />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        {/* ── ADD USER MODAL ── */}
        {showAddModal && (
          <div style={M.overlay}>
            <div style={M.modal}>
              <h3 style={{ margin: '0 0 16px', color: '#0f172a', fontSize: 18 }}>
                {addStep === 'form' ? '👤 Add New User' : '🔐 Verify Identity'}
              </h3>

              {addSuccess ? (
                <p style={{ color: '#16a34a', fontWeight: 600, fontSize: 15 }}>{addSuccess}</p>
              ) : addStep === 'form' ? (
                <>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: 12, marginBottom: 16 }}>
                    <div>
                      <label style={M.label}>Username *</label>
                      <input style={M.input} type="text" placeholder="Enter username"
                        value={addForm.username} onChange={e => setAddForm(f => ({ ...f, username: e.target.value }))} />
                    </div>
                    <div>
                      <label style={M.label}>Email *</label>
                      <input style={M.input} type="email" placeholder="Enter email"
                        value={addForm.email} onChange={e => setAddForm(f => ({ ...f, email: e.target.value }))} />
                    </div>
                    <div>
                      <label style={M.label}>Password *</label>
                      <input style={M.input} type="password" placeholder="Enter password"
                        value={addForm.password} onChange={e => setAddForm(f => ({ ...f, password: e.target.value }))} />
                    </div>
                  </div>
                  {addError && <p style={M.err}>{addError}</p>}
                  <div style={M.btnRow}>
                    <button style={M.cancelBtn} onClick={closeAddModal}>Cancel</button>
                    <button style={M.primaryBtn} onClick={handleAddSendCode} disabled={sendingAddCode}>
                      {sendingAddCode ? 'Sending...' : 'Send Code & Continue'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={M.text}>Enter the 6-digit code sent to your email to confirm creating <strong>{addForm.username}</strong>.</p>
                  <input style={{ ...M.input, letterSpacing: 4, textAlign: 'center', fontSize: 18 }}
                    type="text" maxLength={6} placeholder="000000"
                    value={addCode} onChange={e => setAddCode(e.target.value)} autoFocus />
                  {addError && <p style={M.err}>{addError}</p>}
                  <div style={M.btnRow}>
                    <button style={M.cancelBtn} onClick={() => { setAddStep('form'); setAddCode(''); setAddError(''); }}>← Back</button>
                    <button style={M.primaryBtn} onClick={handleAddConfirm} disabled={addLoading}>
                      {addLoading ? 'Creating...' : 'Create User'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ── DELETE MODAL ── */}
        {deleteTarget && (
          <div style={M.overlay}>
            <div style={M.modal}>
              <h3 style={{ margin: '0 0 8px', color: '#0f172a', fontSize: 18 }}>
                {deleteStep === 'confirm' ? '🗑️ Delete User' : '🔐 Verify Identity'}
              </h3>

              {deleteStep === 'confirm' ? (
                <>
                  <p style={M.text}>
                    You are about to delete <strong>{deleteTarget.username}</strong> ({deleteTarget.email}).
                    This action <strong>cannot be undone</strong>.
                  </p>
                  <p style={M.text}>A verification code will be sent to your email to confirm.</p>
                  {deleteError && <p style={M.err}>{deleteError}</p>}
                  <div style={M.btnRow}>
                    <button style={M.cancelBtn} onClick={closeDeleteModal}>Cancel</button>
                    <button style={M.dangerBtn} onClick={handleSendCode} disabled={sendingCode}>
                      {sendingCode ? 'Sending...' : 'Send Code & Continue'}
                    </button>
                  </div>
                </>
              ) : (
                <>
                  <p style={M.text}>
                    Enter the 6-digit code sent to your email to confirm deletion of <strong>{deleteTarget.username}</strong>.
                  </p>
                  <input
                    type="text"
                    maxLength={6}
                    placeholder="Enter 6-digit code"
                    value={deleteCode}
                    onChange={e => setDeleteCode(e.target.value)}
                    style={{ ...M.input, letterSpacing: 4, textAlign: 'center', fontSize: 18, marginBottom: 14 }}
                    autoFocus
                  />
                  {deleteError && <p style={M.err}>{deleteError}</p>}
                  <div style={M.btnRow}>
                    <button style={M.cancelBtn} onClick={closeDeleteModal}>Cancel</button>
                    <button style={M.dangerBtn} onClick={handleDeleteConfirm} disabled={deleteLoading}>
                      {deleteLoading ? 'Deleting...' : 'Confirm Delete'}
                    </button>
                  </div>
                </>
              )}
            </div>
          </div>
        )}
    </Layout>
  );
}

const M = {
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.5)', display: 'flex',
    alignItems: 'center', justifyContent: 'center', zIndex: 1000,
  },
  modal: {
    background: '#fff', borderRadius: 14, padding: '28px 24px',
    width: '100%', maxWidth: 420, boxShadow: '0 20px 60px rgba(0,0,0,0.3)',
  },
  label: { display: 'block', fontSize: 13, fontWeight: 500, color: '#374151', marginBottom: 4 },
  text: { color: '#475569', fontSize: 14, margin: '0 0 12px', lineHeight: 1.6 },
  err: { color: '#dc2626', fontSize: 13, margin: '0 0 10px' },
  input: {
    width: '100%', padding: '11px 14px', border: '1px solid #e2e8f0',
    borderRadius: 8, fontSize: 14, outline: 'none',
    boxSizing: 'border-box',
  },
  btnRow: { display: 'flex', gap: 10, justifyContent: 'flex-end', marginTop: 8 },
  cancelBtn: {
    padding: '9px 18px', borderRadius: 8, border: '1px solid #e2e8f0',
    background: '#f8fafc', color: '#475569', cursor: 'pointer', fontSize: 14,
  },
  primaryBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#3b82f6', color: '#fff', cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  },
  dangerBtn: {
    padding: '9px 18px', borderRadius: 8, border: 'none',
    background: '#dc2626', color: '#fff', cursor: 'pointer',
    fontSize: 14, fontWeight: 600,
  },
};
