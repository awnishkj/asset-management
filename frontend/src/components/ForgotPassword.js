import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function ForgotPassword() {
  const navigate = useNavigate();

  // step 1 = enter email
  // step 2 = enter Authenticator code
  // step 3 = enter new password
  const [step, setStep] = useState(1);

  const [email, setEmail] = useState('');
  const [resetStepToken, setResetStepToken] = useState('');
  const [totpCode, setTotpCode] = useState('');
  const [passwordResetToken, setPasswordResetToken] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirm, setConfirm] = useState('');

  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  // Step 1: verify account exists
  const handleCheckEmail = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password`, { email });
      if (res.data?.resetStepToken) {
        setResetStepToken(res.data.resetStepToken);
        setMessage(res.data.message || 'Account found. Open your Authenticator app.');
        setStep(2);
      } else {
        // Account not found or Authenticator not set up — don't reveal which
        setMessage('If this account exists and has Authenticator set up, you may proceed.');
        setStep(2); // still advance so flow isn't broken — step 2 will fail gracefully
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to process request');
    } finally { setLoading(false); }
  };

  // Step 2: verify Authenticator TOTP
  const handleVerifyTotp = async (e) => {
    e.preventDefault();
    setLoading(true); setError(''); setMessage('');
    try {
      const res = await axios.post(`${API_URL}/auth/forgot-password/verify-totp`, {
        resetStepToken,
        totpCode,
      });
      setPasswordResetToken(res.data.passwordResetToken);
      setMessage(res.data.message || 'Verified. Enter your new password.');
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.message || 'Invalid code or session expired. Please start again.');
    } finally { setLoading(false); }
  };

  // Step 3: apply new password
  const handleReset = async (e) => {
    e.preventDefault();
    if (newPassword !== confirm) return setError('Passwords do not match');
    if (newPassword.length < 4) return setError('Password must be at least 4 characters');
    setLoading(true); setError('');
    try {
      await axios.post(`${API_URL}/auth/reset-password`, { passwordResetToken, newPassword });
      setMessage('Password reset successfully! Redirecting to login...');
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.message || 'Reset failed');
    } finally { setLoading(false); }
  };

  const stepTitle = {
    1: 'Reset your password',
    2: 'Authenticator verification',
    3: 'Set new password',
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src="/logo.png"
            alt="AssetTrack Logo"
            style={{ width: 90, height: 90, objectFit: 'contain', display: 'block', margin: '0 auto 16px' }}
          />
          <h1>ASSETTRACK</h1>
          <p className="tagline">{stepTitle[step]}</p>
        </div>

        {message && (
          <div style={{ background: '#e8f5e9', color: '#2e7d32', padding: '12px', borderRadius: 8, marginBottom: 16, fontSize: 14 }}>
            {message}
          </div>
        )}
        {error && <div className="error-message">{error}</div>}

        {/* Step 1 — Email */}
        {step === 1 && (
          <form onSubmit={handleCheckEmail} className="login-form">
            <div className="form-group">
              <label>Registered Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Enter your registered email"
                required
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Checking...' : 'Continue'}
            </button>
          </form>
        )}

        {/* Step 2 — Authenticator TOTP */}
        {step === 2 && (
          <form onSubmit={handleVerifyTotp} className="login-form">
            <div className="info-message" style={{ marginBottom: 16 }}>
              Open your Authenticator app and enter the 6-digit code for AssetTrack.
            </div>
            <div className="form-group">
              <label>Authenticator Code</label>
              <input
                type="text"
                inputMode="numeric"
                value={totpCode}
                onChange={e => setTotpCode(e.target.value)}
                placeholder="Enter 6-digit code"
                maxLength={6}
                autoFocus
                required
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Verifying...' : 'Verify'}
            </button>
            <button
              type="button"
              onClick={() => { setStep(1); setError(''); setMessage(''); }}
              style={{ marginTop: 8, width: '100%', padding: 10, background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 14 }}
            >
              ← Back
            </button>
          </form>
        )}

        {/* Step 3 — New password */}
        {step === 3 && (
          <form onSubmit={handleReset} className="login-form">
            <div className="form-group">
              <label>New Password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                placeholder="Enter new password"
                required
              />
            </div>
            <div className="form-group">
              <label>Confirm Password</label>
              <input
                type="password"
                value={confirm}
                onChange={e => setConfirm(e.target.value)}
                placeholder="Confirm new password"
                required
              />
            </div>
            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Resetting...' : 'Reset Password'}
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
