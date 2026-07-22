import React, { useEffect, useState } from 'react';
import axios from 'axios';
import Layout from './Layout';
import {
  FiUser, FiShield, FiBell, FiLock, FiUsers, FiDatabase,
  FiSettings, FiChevronRight, FiCamera, FiSave
} from 'react-icons/fi';

const NAV_ITEMS = [
  { key: 'general',       label: 'General',          icon: FiUser     },
  { key: 'password',      label: 'Change Password',  icon: FiLock     },
  { key: 'security',      label: 'Security',         icon: FiShield   },
  { key: 'notifications', label: 'Notifications',    icon: FiBell     },
  { key: 'users',         label: 'Users & Roles',    icon: FiUsers    },
  { key: 'backup',        label: 'Backup & Restore', icon: FiDatabase },
];

export default function Settings() {
  const [activeTab, setActiveTab] = useState('general');
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState('');
  const [messageType, setMessageType] = useState('success');

  // General form
  const [form, setForm] = useState({ username: '', email: '', phone: '', role: '' });

  // Security
  const [prefs, setPrefs] = useState({ twoFactorEnabled: false });
  const [showVerify, setShowVerify] = useState(false);
  const [code, setCode] = useState('');
  const [sending, setSending] = useState(false);
  const [verifying, setVerifying] = useState(false);

  // Change password
  const [pwForm, setPwForm] = useState({ current: '', newPw: '', confirm: '' });
  const [changingPw, setChangingPw] = useState(false);

  // Notifications
  const [notifs, setNotifs] = useState({ email: false, sms: false, push: false });

  const showMsg = (msg, type = 'success') => {
    setMessage(msg); setMessageType(type);
    setTimeout(() => setMessage(''), 4000);
  };

  useEffect(() => {
    const load = async () => {
      try {
        const res = await axios.get('/users/me');
        setUser(res.data);
        setForm({
          username: res.data.username || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
          role: res.data.role || 'user',
        });
        setPrefs({ twoFactorEnabled: !!res.data.twoFactorEnabled });
        setNotifs({
          email: !!res.data.notificationPrefs?.email,
          sms:   !!res.data.notificationPrefs?.sms,
          push:  !!res.data.notificationPrefs?.push,
        });
      } catch (e) { console.error(e); }
      finally { setLoading(false); }
    };
    load();
  }, []);

  const saveGeneral = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/users/me', { phone: form.phone });
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      showMsg('Changes saved successfully');
    } catch (e) { showMsg(e.response?.data?.message || 'Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const saveNotifs = async () => {
    setSaving(true);
    try {
      const res = await axios.put('/users/me', { notificationPrefs: notifs });
      setUser(res.data);
      localStorage.setItem('user', JSON.stringify(res.data));
      showMsg('Notification preferences saved');
    } catch (e) { showMsg('Save failed', 'error'); }
    finally { setSaving(false); }
  };

  const changePassword = async () => {
    if (!pwForm.current || !pwForm.newPw || !pwForm.confirm) return showMsg('All fields are required', 'error');
    if (pwForm.newPw !== pwForm.confirm) return showMsg('New passwords do not match', 'error');
    if (pwForm.newPw.length < 4) return showMsg('Password must be at least 4 characters', 'error');
    setChangingPw(true);
    try {
      await axios.post('/users/me/change-password', { currentPassword: pwForm.current, newPassword: pwForm.newPw });
      setPwForm({ current: '', newPw: '', confirm: '' });
      showMsg('Password changed successfully');
    } catch (e) { showMsg(e.response?.data?.message || 'Failed to change password', 'error'); }
    finally { setChangingPw(false); }
  };

  const send2fa = async () => {
    setSending(true);
    try {
      await axios.post('/users/me/2fa/send', { type: 'enable' });
      setShowVerify(true);
      showMsg('Verification code sent to your email');
    } catch (e) { showMsg(e.response?.data?.message || 'Failed to send code', 'error'); }
    finally { setSending(false); }
  };

  const verify2fa = async () => {
    setVerifying(true);
    try {
      const res = await axios.post('/users/me/2fa/verify', { code, type: 'enable' });
      setUser(res.data.user || res.data);
      setPrefs({ twoFactorEnabled: true });
      setShowVerify(false); setCode('');
      localStorage.setItem('user', JSON.stringify(res.data.user || res.data));
      showMsg('Two-factor authentication enabled');
    } catch (e) { showMsg(e.response?.data?.message || 'Verification failed', 'error'); }
    finally { setVerifying(false); }
  };

  const avatarSrc = user?.profilePic || null;
  const initials = (user?.username || 'U').slice(0, 2).toUpperCase();

  return (
    <Layout>
      <div style={S.page}>

        {/* Header */}
        <div style={S.header}>
          <div>
            <h2 style={S.title}>Settings</h2>
            <p style={S.subtitle}>Manage your account and application preferences</p>
          </div>
          <button style={S.saveBtn} onClick={activeTab === 'notifications' ? saveNotifs : saveGeneral} disabled={saving}>
            <FiSave size={16} /> {saving ? 'Saving...' : 'Save Changes'}
          </button>
        </div>

        {message && (
          <div style={{ ...S.toast, background: messageType === 'error' ? '#fee2e2' : '#dcfce7', color: messageType === 'error' ? '#991b1b' : '#166534' }}>
            {message}
          </div>
        )}

        <div style={S.body}>
          {/* Left Nav */}
          <aside style={S.nav}>
            {NAV_ITEMS.map(item => {
              const Icon = item.icon;
              return (
                <button
                  key={item.key}
                  style={{ ...S.navItem, ...(activeTab === item.key ? S.navItemActive : {}) }}
                  onClick={() => setActiveTab(item.key)}
                >
                  <Icon size={18} />
                  <span>{item.label}</span>
                </button>
              );
            })}
          </aside>

          {/* Content */}
          <div style={S.content}>
            {loading ? (
              <p style={{ color: '#888' }}>Loading...</p>
            ) : (
              <>
                {/* ── GENERAL ── */}
                {activeTab === 'general' && (
                  <div>
                    {/* Profile Information */}
                    <div style={S.section}>
                      <h3 style={S.sectionTitle}><FiUser size={18} /> Profile Information</h3>
                      <div style={S.profileRow}>
                        {/* Avatar */}
                        <div style={S.avatarWrap}>
                          <div style={S.avatar}>
                            {avatarSrc
                              ? <img src={avatarSrc} alt="Avatar" style={{ width: '100%', height: '100%', borderRadius: '50%', objectFit: 'cover' }} />
                              : <span style={{ fontSize: 28, fontWeight: 700, color: '#fff' }}>{initials}</span>
                            }
                          </div>
                          <div style={S.cameraBtn}><FiCamera size={14} color="#fff" /></div>
                        </div>

                        {/* Fields */}
                        <div style={S.fields}>
                          <div style={S.fieldRow}>
                            <div style={S.fieldGroup}>
                              <label style={S.label}>Full Name</label>
                              <input style={S.input} value={form.username} readOnly />
                            </div>
                            <div style={S.fieldGroup}>
                              <label style={S.label}>Email Address</label>
                              <input style={S.input} value={form.email} readOnly />
                            </div>
                          </div>
                          <div style={S.fieldRow}>
                            <div style={S.fieldGroup}>
                              <label style={S.label}>Phone Number</label>
                              <input
                                style={S.input}
                                value={form.phone}
                                onChange={e => setForm(f => ({ ...f, phone: e.target.value }))}
                                placeholder="+91 00000 00000"
                              />
                            </div>
                            <div style={S.fieldGroup}>
                              <label style={S.label}>Role</label>
                              <input style={S.input} value={form.role} readOnly />
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {/* ── PASSWORD ── */}
                {activeTab === 'password' && (
                  <div style={S.section}>
                    <h3 style={S.sectionTitle}><FiLock size={18} /> Change Password</h3>
                    <div style={{ maxWidth: 400, display: 'flex', flexDirection: 'column', gap: 16 }}>
                      <div style={S.fieldGroup}>
                        <label style={S.label}>Current Password</label>
                        <input type="password" style={S.input} value={pwForm.current}
                          onChange={e => setPwForm(f => ({ ...f, current: e.target.value }))}
                          placeholder="Enter current password" />
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.label}>New Password</label>
                        <input type="password" style={S.input} value={pwForm.newPw}
                          onChange={e => setPwForm(f => ({ ...f, newPw: e.target.value }))}
                          placeholder="Enter new password" />
                      </div>
                      <div style={S.fieldGroup}>
                        <label style={S.label}>Confirm New Password</label>
                        <input type="password" style={S.input} value={pwForm.confirm}
                          onChange={e => setPwForm(f => ({ ...f, confirm: e.target.value }))}
                          placeholder="Confirm new password" />
                      </div>
                      <button style={S.saveBtn} onClick={changePassword} disabled={changingPw}>
                        <FiLock size={15} /> {changingPw ? 'Changing...' : 'Change Password'}
                      </button>
                    </div>
                  </div>
                )}

                {/* ── SECURITY ── */}
                {activeTab === 'security' && (
                  <div style={S.section}>
                    <h3 style={S.sectionTitle}><FiShield size={18} /> Security Settings</h3>
                    <div style={S.toggleRow}>
                      <div>
                        <p style={{ fontWeight: 600, margin: 0 }}>Two-Factor Authentication</p>
                        <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>Add an extra layer of security to your account</p>
                      </div>
                      <label style={S.toggle}>
                        <input type="checkbox" checked={prefs.twoFactorEnabled}
                          onChange={e => { if (e.target.checked) send2fa(); else setPrefs({ twoFactorEnabled: false }); }}
                          style={{ display: 'none' }}
                        />
                        <div style={{ ...S.toggleTrack, background: prefs.twoFactorEnabled ? '#3b82f6' : '#d1d5db' }}>
                          <div style={{ ...S.toggleThumb, left: prefs.twoFactorEnabled ? 22 : 2 }} />
                        </div>
                      </label>
                    </div>
                    {showVerify && (
                      <div style={{ marginTop: 16 }}>
                        <p style={{ fontSize: 14, marginBottom: 8 }}>Enter the code sent to your email:</p>
                        <input value={code} onChange={e => setCode(e.target.value)} placeholder="123456" style={{ ...S.input, width: 180 }} />
                        <div style={{ marginTop: 8, display: 'flex', gap: 8 }}>
                          <button style={S.saveBtn} onClick={verify2fa} disabled={verifying}>{verifying ? 'Verifying...' : 'Verify'}</button>
                          <button style={{ ...S.saveBtn, background: '#9ca3af' }} onClick={() => { setShowVerify(false); setCode(''); }}>Cancel</button>
                        </div>
                      </div>
                    )}
                  </div>
                )}

                {/* ── NOTIFICATIONS ── */}
                {activeTab === 'notifications' && (
                  <div style={S.section}>
                    <h3 style={S.sectionTitle}><FiBell size={18} /> Notification Settings</h3>
                    {[
                      { key: 'email', label: 'Email Alerts',        desc: 'Receive alerts via email' },
                      { key: 'sms',   label: 'SMS Alerts',          desc: 'Receive alerts via SMS' },
                      { key: 'push',  label: 'Push Notifications',  desc: 'Browser push notifications' },
                    ].map(({ key, label, desc }) => (
                      <div key={key} style={S.toggleRow}>
                        <div>
                          <p style={{ fontWeight: 600, margin: 0 }}>{label}</p>
                          <p style={{ color: '#888', fontSize: 13, margin: '4px 0 0' }}>{desc}</p>
                        </div>
                        <label style={S.toggle}>
                          <input type="checkbox" checked={notifs[key]}
                            onChange={e => setNotifs(n => ({ ...n, [key]: e.target.checked }))}
                            style={{ display: 'none' }}
                          />
                          <div style={{ ...S.toggleTrack, background: notifs[key] ? '#3b82f6' : '#d1d5db' }}>
                            <div style={{ ...S.toggleThumb, left: notifs[key] ? 22 : 2 }} />
                          </div>
                        </label>
                      </div>
                    ))}
                  </div>
                )}

                {/* ── USERS ── */}
                {activeTab === 'users' && (
                  <div style={S.section}>
                    <h3 style={S.sectionTitle}><FiUsers size={18} /> Users & Roles</h3>
                    <p style={{ color: '#888', fontSize: 14 }}>Manage users and their roles from the <a href="/users" style={{ color: '#3b82f6' }}>Users page</a>.</p>
                  </div>
                )}

                {/* ── BACKUP ── */}
                {activeTab === 'backup' && (
                  <div style={S.section}>
                    <h3 style={S.sectionTitle}><FiDatabase size={18} /> Backup & Restore</h3>
                    <p style={{ color: '#888', fontSize: 14 }}>Backup and restore functionality coming soon.</p>
                  </div>
                )}
              </>
            )}
          </div>
        </div>

        {/* Bottom Quick-Action Cards */}
        <div style={S.cards}>
          {[
            { icon: FiLock,     color: '#6366f1', label: 'Change Password',       desc: 'Update your account password',          tab: 'password'       },
            { icon: FiBell,     color: '#22c55e', label: 'Notification Settings', desc: 'Manage how you receive notifications',  tab: 'notifications'  },
            { icon: FiShield,   color: '#3b82f6', label: 'Security Settings',     desc: 'Two-factor auth and login activity',    tab: 'security'       },
            { icon: FiDatabase, color: '#f59e0b', label: 'Backup & Restore',      desc: 'Manage system backups',                 tab: 'backup'         },
          ].map(({ icon: Icon, color, label, desc, tab }) => (
            <button key={label} style={S.card} onClick={() => setActiveTab(tab)}>
              <div style={{ ...S.cardIcon, background: color }}>
                <Icon size={20} color="#fff" />
              </div>
              <div style={{ flex: 1, textAlign: 'left' }}>
                <p style={{ fontWeight: 600, margin: 0, fontSize: 14 }}>{label}</p>
                <p style={{ color: '#888', fontSize: 12, margin: '3px 0 0' }}>{desc}</p>
              </div>
              <FiChevronRight size={18} color="#94a3b8" />
            </button>
          ))}
        </div>

      </div>
    </Layout>
  );
}

const S = {
  page: { padding: '30px', fontFamily: "'Segoe UI', sans-serif", background: '#f8fafc', minHeight: '100vh' },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 24 },
  title: { fontSize: 26, fontWeight: 700, color: '#0f172a', margin: 0 },
  subtitle: { color: '#64748b', fontSize: 14, margin: '4px 0 0' },
  saveBtn: { display: 'flex', alignItems: 'center', gap: 8, background: '#3b82f6', color: '#fff', border: 'none', borderRadius: 8, padding: '10px 20px', fontSize: 14, fontWeight: 600, cursor: 'pointer' },
  toast: { padding: '12px 16px', borderRadius: 8, marginBottom: 16, fontSize: 14, fontWeight: 500 },
  body: { display: 'flex', gap: 20, marginBottom: 24 },
  nav: { width: 200, background: '#fff', borderRadius: 12, padding: '12px 0', boxShadow: '0 1px 4px rgba(0,0,0,0.08)', flexShrink: 0, height: 'fit-content' },
  navItem: { display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '12px 20px', border: 'none', background: 'none', cursor: 'pointer', fontSize: 14, color: '#475569', fontWeight: 500, textAlign: 'left' },
  navItemActive: { background: '#eff6ff', color: '#3b82f6', borderLeft: '3px solid #3b82f6' },
  content: { flex: 1, background: '#fff', borderRadius: 12, padding: 24, boxShadow: '0 1px 4px rgba(0,0,0,0.08)' },
  section: {},
  sectionTitle: { display: 'flex', alignItems: 'center', gap: 8, fontSize: 16, fontWeight: 700, color: '#0f172a', marginBottom: 20, paddingBottom: 12, borderBottom: '1px solid #f1f5f9' },
  profileRow: { display: 'flex', gap: 24, alignItems: 'flex-start' },
  avatarWrap: { position: 'relative', flexShrink: 0 },
  avatar: { width: 90, height: 90, borderRadius: '50%', background: 'linear-gradient(135deg, #667eea, #764ba2)', display: 'flex', alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  cameraBtn: { position: 'absolute', bottom: 2, right: 2, background: '#3b82f6', borderRadius: '50%', width: 26, height: 26, display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' },
  fields: { flex: 1 },
  fieldRow: { display: 'flex', gap: 16, marginBottom: 16 },
  fieldGroup: { flex: 1, display: 'flex', flexDirection: 'column', gap: 6 },
  label: { fontSize: 13, fontWeight: 500, color: '#374151' },
  input: { padding: '10px 12px', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 14, color: '#0f172a', outline: 'none', background: '#f8fafc' },
  toggleRow: { display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 0', borderBottom: '1px solid #f1f5f9' },
  toggle: { cursor: 'pointer' },
  toggleTrack: { position: 'relative', width: 44, height: 24, borderRadius: 12, transition: 'background 0.2s' },
  toggleThumb: { position: 'absolute', top: 2, width: 20, height: 20, borderRadius: '50%', background: '#fff', boxShadow: '0 1px 3px rgba(0,0,0,0.2)', transition: 'left 0.2s' },
  cards: { display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 16 },
  card: { display: 'flex', alignItems: 'center', gap: 14, background: '#fff', border: '1px solid #e2e8f0', borderRadius: 12, padding: '16px', cursor: 'pointer', transition: 'box-shadow 0.2s', textDecoration: 'none' },
  cardIcon: { width: 44, height: 44, borderRadius: 10, display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
};
