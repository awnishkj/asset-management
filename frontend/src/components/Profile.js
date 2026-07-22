import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import '../styles/Dashboard.css';
import Layout from './Layout';
import '../styles/Profile.css';
import axios from 'axios';

export default function Profile() {
  const [user, setUser] = useState(() => {
    try {
      return JSON.parse(localStorage.getItem('user') || 'null');
    } catch (e) { return null }
  });

  const [stats, setStats] = useState({ totalAssets: 0, activeAssets: 0 });
  const [loadingStats, setLoadingStats] = useState(true);
  const [recentActivity, setRecentActivity] = useState([]);
  const [loadingActivity, setLoadingActivity] = useState(true);
  const [scanSummary, setScanSummary] = useState({ total: 0, successful: 0, failed: 0 });
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState({
    username: user?.username || '',
    email: user?.email || '',
    phone: user?.phone || '',
    location: user?.location || '',
    profilePic: user?.profilePic || '',
    empId: user?.empId || ''
  });
  const [changingPassword, setChangingPassword] = useState(false);
  const [pwd, setPwd] = useState({ currentPassword: '', newPassword: '', confirmPassword: '' });
  const [message, setMessage] = useState('');
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    // Record login time in localStorage if not already set for this session
    if (!sessionStorage.getItem('loginTime')) {
      sessionStorage.setItem('loginTime', new Date().toISOString());
    }

    const fetchStats = async () => {
      try {
        const res = await axios.get('/assets/stats/overview');
        setStats({
          totalAssets: res.data.totalAssets || 0,
          activeAssets: res.data.activeAssets || 0,
        });
      } catch (err) {
        // ignore
      } finally {
        setLoadingStats(false);
      }
    };

    const fetchUser = async () => {
      try {
        const res = await axios.get('/users/me');
        setUser(res.data);
        localStorage.setItem('user', JSON.stringify(res.data));
        setForm({
          username: res.data.username || '',
          email: res.data.email || '',
          phone: res.data.phone || '',
          location: res.data.location || '',
          profilePic: res.data.profilePic || '',
          empId: res.data.empId || ''
        });
      } catch (err) {
        console.error('Failed to load profile', err);
      }
    };

    const fetchActivity = async () => {
      try {
        const activity = [];

        // 1. Login time from sessionStorage
        const loginTime = sessionStorage.getItem('loginTime');
        if (loginTime) {
          activity.push({
            label: 'Logged In',
            time: new Date(loginTime),
          });
        }

        // 2. Profile last updated (joinedAt as proxy if no updatedAt)
        const userData = JSON.parse(localStorage.getItem('user') || '{}');
        const profileUpdated = localStorage.getItem('profileUpdatedAt');
        if (profileUpdated) {
          activity.push({
            label: 'Updated Profile',
            time: new Date(profileUpdated),
          });
        }

        // 3. Recent QR scans from scan history
        const scansRes = await axios.get('/scan-history');
        const scans = scansRes.data || [];
        scans.slice(0, 3).forEach(scan => {
          activity.push({
            label: `Scanned QR — ${scan.assetName || scan.assetId || 'Asset'}`,
            time: new Date(scan.scannedAt),
          });
        });

        // 4. Compute this-week scan summary
        const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);
        const weekScans = scans.filter(s => new Date(s.scannedAt) > weekAgo);
        const failed = weekScans.filter(s => s.status === 'Damaged' || s.status === 'Inactive').length;
        setScanSummary({ total: weekScans.length, successful: weekScans.length - failed, failed });

        // Sort by most recent first
        activity.sort((a, b) => b.time - a.time);
        setRecentActivity(activity.slice(0, 5));
      } catch (err) {
        console.error('Failed to load activity', err);
      } finally {
        setLoadingActivity(false);
      }
    };

    fetchStats();
    fetchUser();
    fetchActivity();
  }, []);

  const displayName = (user && (user.username || user.name)) || 'Guest User';
  const email = (user && user.email) || 'awnish@example.com';
  const avatarSrc = form.profilePic || user?.profilePic;

  const formatActivityTime = (date) => {
    const now = new Date();
    const diff = now - date;
    const mins = Math.floor(diff / 60000);
    const hrs = Math.floor(diff / 3600000);
    const days = Math.floor(diff / 86400000);
    if (mins < 1) return 'Just now';
    if (mins < 60) return `${mins} min ago`;
    if (hrs < 24) return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
    if (days === 1) return 'Yesterday';
    return date.toLocaleDateString([], { day: '2-digit', month: 'short' });
  };

  const resetForm = (source = user) => {
    setForm({
      username: source?.username || '',
      email: source?.email || '',
      phone: source?.phone || '',
      location: source?.location || '',
      profilePic: source?.profilePic || '',
      empId: source?.empId || ''
    });
  };

  const handleProfilePicChange = async (event) => {
    const file = event.target.files?.[0];
    if (!file) return;
    setMessage('');
    setUploadingPhoto(true);
    // show a local preview immediately
    const reader = new FileReader();
    reader.onloadend = () => {
      setForm(prev => ({ ...prev, profilePic: reader.result }));
    };
    reader.onerror = () => {
      setMessage('Could not read selected image');
      setUploadingPhoto(false);
    };
    reader.readAsDataURL(file);

    // upload file as multipart/form-data to avoid large JSON payloads
    try {
      const fd = new FormData();
      fd.append('avatar', file);
      const res = await axios.post('/users/me/avatar', fd, { headers: { 'Content-Type': 'multipart/form-data' } });
      setUser(res.data);
      setForm(prev => ({ ...prev, profilePic: res.data.profilePic || prev.profilePic }));
      localStorage.setItem('user', JSON.stringify(res.data));
    } catch (err) {
      const status = err?.response?.status;
      const serverMsg = err?.response?.data?.message || err?.response?.statusText || err.message || 'Upload failed';
      setMessage(`Error ${status || ''}: ${serverMsg}`.trim());
    } finally {
      setUploadingPhoto(false);
    }
  };

  return (
    <Layout>
        <div className="dashboard-content">
          <div className="page-heading">
            <h2>Profile</h2>
            <p>View and edit your profile information.</p>
          </div>

          <div className="profile-header">
            <div className="profile-avatar">
              {avatarSrc ? (
                <img src={avatarSrc} alt="Profile" />
              ) : (
                displayName.split(' ').map(n=>n[0]).join('').slice(0,2).toUpperCase()
              )}
            </div>
            <div className="profile-main">
              <div className="profile-name">
                <h1>{displayName}</h1>
              </div>
              <div className="profile-meta">
                <div>{email}</div>
                <div style={{marginTop:8}}>Phone: {user?.phone || '+91 98765 43210'} • {user?.location || 'Uttar Pradesh, India'}</div>
              </div>
            </div>
            <div style={{width:320}}>
              <div className="profile-stats">
                <div className="small-card"><div className="label">Total Assets</div><div className="value">{loadingStats ? '...' : stats.totalAssets}</div></div>
                <div className="small-card"><div className="label">Active Assets</div><div className="value">{loadingStats ? '...' : stats.activeAssets}</div></div>
                <div className="small-card"><div className="label">QR Scans Today</div><div className="value">-</div></div>
                <div className="small-card"><div className="label">Pending Issues</div><div className="value">-</div></div>
              </div>
            </div>
            <div style={{marginLeft:12}}>
              <button className="action-btn" onClick={()=>{ resetForm(); setEditing(true); setMessage(''); }}>Edit Profile</button>
              <div style={{height:8}} />
              <button className="action-btn" onClick={()=>{ setChangingPassword(true); setMessage(''); }}>Change Password</button>
            </div>
          </div>

          <div className="profile-grid">
            <div className="card profile-info">
              <h3>Personal Information</h3>
              <div className="info-row"><strong>Full Name</strong><span>{displayName}</span></div>
              <div className="info-row"><strong>Email Address</strong><span>{email}</span></div>
              <div className="info-row"><strong>Phone Number</strong><span>{user?.phone || '+91 98765 43210'}</span></div>
              <div className="info-row"><strong>Location</strong><span>{user?.location || 'Uttar Pradesh, India'}</span></div>
              <div className="info-row"><strong>Joined on</strong><span>{user?.joinedAt ? new Date(user.joinedAt).toLocaleDateString('en-GB',{day:'2-digit',month:'long',year:'numeric'}) : 'N/A'}</span></div>
              <div className="info-row"><strong>EMP ID</strong><span>{user?.empId || 'N/A'}</span></div>
            </div>

            <div className="card">
              <h3>Recent Activity</h3>
              {loadingActivity ? (
                <p style={{ color: '#aaa', fontSize: 13 }}>Loading...</p>
              ) : recentActivity.length === 0 ? (
                <p style={{ color: '#aaa', fontSize: 13 }}>No recent activity found.</p>
              ) : (
                <ul style={{ paddingLeft: 16, margin: 0 }}>
                  {recentActivity.map((item, i) => (
                    <li key={i} style={{ marginBottom: 8, fontSize: 14, color: '#333' }}>
                      <span style={{ fontWeight: 500 }}>{item.label}</span>
                      <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: 12 }}>
                        — {formatActivityTime(item.time)}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="card">
              <h3>Account Settings</h3>
              <div style={{display:'flex',flexDirection:'column',gap:12}}>
                <button className="action-btn" onClick={()=>setChangingPassword(true)}>Change Password</button>
                <button className="action-btn" onClick={()=>navigate('/settings')}>Two-Factor Authentication</button>
                <button className="action-btn" onClick={()=>navigate('/settings')}>Notification Preferences</button>
              </div>
            </div>
          </div>

          <div style={{marginTop:18}} className="card">
            <h3>QR Scan Summary (This Week)</h3>
            <div style={{display:'flex',gap:12, marginTop:12}}>
              <div className="small-card"><div className="label">Total Scans</div><div className="value">{scanSummary.total}</div></div>
              <div className="small-card"><div className="label">Successful Scans</div><div className="value">{scanSummary.successful}</div></div>
              <div className="small-card"><div className="label">Failed Scans</div><div className="value">{scanSummary.failed}</div></div>
            </div>
          </div>

          {/* Edit Profile Modal */}
          {editing && (
            <div className="modal-backdrop">
              <div className="modal">
                <h3>Edit Profile</h3>
                <div className="form-row">
                  <input value={form.username} onChange={e=>setForm({...form, username:e.target.value})} placeholder="Full name" />
                  <input value={form.email} onChange={e=>setForm({...form, email:e.target.value})} placeholder="Email" />
                </div>
                <div className="form-row">
                  <input value={form.phone} onChange={e=>setForm({...form, phone:e.target.value})} placeholder="Phone" />
                  <input value={form.location} onChange={e=>setForm({...form, location:e.target.value})} placeholder="Location" />
                </div>
                <div className="form-row">
                  <input value={form.empId} onChange={e=>setForm({...form, empId:e.target.value})} placeholder="EMP ID" />
                </div>
                <div className="form-row file-input-row">
                  <label className="file-label">
                    {form.profilePic ? 'Change Profile Picture' : 'Upload Profile Picture'}
                    <input type="file" accept="image/*" onChange={handleProfilePicChange} />
                  </label>
                </div>
                {form.profilePic && (
                  <div style={{ marginBottom: 12 }}>
                    <img src={form.profilePic} alt="Preview" className="profile-pic-preview" />
                  </div>
                )}
                {uploadingPhoto && <p style={{ marginBottom: 12 }}>Reading image...</p>}
                <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
                  <button className="save-btn" disabled={uploadingPhoto} onClick={async ()=>{
                    try{
                      const res = await axios.put('/users/me', form);
                      setUser(res.data);
                      resetForm(res.data);
                      localStorage.setItem('user', JSON.stringify(res.data));
                      localStorage.setItem('profileUpdatedAt', new Date().toISOString());
                      setEditing(false);
                      setMessage('Profile updated');
                    } catch (err) {
                      const status = err?.response?.status;
                      const serverMsg = err?.response?.data?.message || err?.response?.statusText || err.message || 'Update failed';
                      setMessage(`Error ${status || ''}: ${serverMsg}`.trim());
                    }
                  }}>Save</button>
                  <button onClick={()=>{ resetForm(); setEditing(false); setMessage(''); }}>Cancel</button>
                </div>
                {message && <p style={{marginTop:8}}>{message}</p>}
              </div>
            </div>
          )}

          {/* Change Password Modal */}
          {changingPassword && (
            <div className="modal-backdrop">
              <div className="modal">
                <h3>Change Password</h3>
                <div className="form-row">
                  <input type="password" value={pwd.currentPassword} onChange={e=>setPwd({...pwd, currentPassword:e.target.value})} placeholder="Current password" />
                </div>
                <div className="form-row">
                  <input type="password" value={pwd.newPassword} onChange={e=>setPwd({...pwd, newPassword:e.target.value})} placeholder="New password" />
                  <input type="password" value={pwd.confirmPassword} onChange={e=>setPwd({...pwd, confirmPassword:e.target.value})} placeholder="Confirm password" />
                </div>
                <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
                  <button className="save-btn" onClick={async ()=>{
                    try{
                      if(pwd.newPassword !== pwd.confirmPassword) { setMessage('Passwords do not match'); return }
                      await axios.post('/users/me/change-password', { currentPassword: pwd.currentPassword, newPassword: pwd.newPassword });
                      setChangingPassword(false);
                      setMessage('Password changed successfully');
                    }catch(err){ const status = err?.response?.status; const serverMsg = err?.response?.data?.message || err?.response?.statusText || err.message || 'Password change failed'; setMessage(`Error ${status || ''}: ${serverMsg}`.trim()) }
                  }}>Change</button>
                  <button onClick={()=>setChangingPassword(false)}>Cancel</button>
                </div>
                {message && <p style={{marginTop:8}}>{message}</p>}
              </div>
            </div>
          )}

        </div>
    </Layout>
  );
}
