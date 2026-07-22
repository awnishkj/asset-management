import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1); // 1=email, 2=code+newpw
  const [email, setEmail] = useState('');
  const [code, setCode] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleSendCode = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      await axios.post(`${API_URL}/auth/forgot-password`, { email });
      setMessage('A 6-digit reset code has been sent to your email.');
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to send code');
    } finally { setLoading(false); }
  };

  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) return setError('Passwords do not match');
    if (newPassword.length < 4) return setError('Password must be at least 4 characters');
    setLoading(true); setError('');
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { email, code, newPassword });
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="AssetTrack Logo" style={{ width: 90, height: 90, objectFit: 'contain', display: 'block', margin: '0 auto 16px' }} />
          <h1>ASSETTRACK</h1>
          <p className="tagline">{step === 1 ? 'Reset your password' : 'Enter reset code'}</p>
        </div>

        {message && <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>{message}</div>}
        {error && <div className="error-message">{error}</div>}

        {step === 1 ? (
          <form onSubmit={handleSendCode} className="login-form">
            <div className="form-group">
              <label>Email Address</label>
              <input type="email" value={email} onChange={e => setEmail(e.target.value)}
                placeholder="Enter your registered email" required />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Sending...' : 'Send Reset Code'}
            </button>
          </form>
        ) : (
          <form onSubmit={handleReset} className="login-form">
            <div className="form-group">
              <label>Reset Code</label>
              <input type="text" value={code} onChange={e => setCode(e.target.value)}
                placeholder="Enter 6-digit code from email" maxLength={6} required />
            </div>
            <div className="form-group">
              <label>New Password</label>
              <input type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password" required />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input type="password" value={confirm} onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password" required />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
            </button>
            <button type="button" onClick={() => setStep(1)}
              style={{ marginTop: 8, width: '100%', padding: 10, background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 14 }}>
              ← Back
            </button>
          </form>
        )}

        <div className="login-footer">
          <a href="/login">Back to Login</a>
        </div>
      </div>
    </div>
  );
}
