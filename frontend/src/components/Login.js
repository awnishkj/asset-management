import React, { useState } from 'react';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import { useNavigate } from 'react-router-dom';
import axios from 'axios';
import '../styles/Login.css';
import { sanitizeServerMessage } from '../utils/errors';

const API_URL = process.env.REACT_APP_API_URL || 'http://localhost:5000/api';

export default function Login() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [rememberMe, setRememberMe] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // 2FA state
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifying, setVerifying] = useState(false);

  // Setup (first login) state
  const [isSetup, setIsSetup] = useState(false);
  const [qrCode, setQrCode] = useState('');
  const [manualKey, setManualKey] = useState('');

  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password,
        rememberMe,
      });

      if (response.data?.twoFactor) {
        setTwoFactorToken(response.data.twoFactorToken || '');
        setTwoFactorPending(true);

        if (response.data.setup) {
          // First login — show QR code for Authenticator setup
          setIsSetup(true);
          setQrCode(response.data.qrCode || '');
          setManualKey(response.data.manualKey || '');
        } else {
          // Existing user — just ask for Authenticator code
          setIsSetup(false);
        }
        return;
      }

      // Immediate login (e.g. dev bypass)
      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      if (rememberMe) localStorage.setItem('rememberMe', 'true');
      navigate('/dashboard');
    } catch (err) {
      setError(sanitizeServerMessage(err.response?.data?.message) || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setError('');

    if (!twoFactorToken) {
      setError('Session expired. Please log in again.');
      setTwoFactorPending(false);
      setVerifying(false);
      return;
    }

    try {
      const res = await axios.post(
        `${API_URL}/auth/verify-2fa`,
        { code: twoFactorCode, twoFactorToken },
        { headers: { Authorization: `Bearer ${twoFactorToken}` } }
      );
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      sessionStorage.setItem('loginTime', new Date().toISOString());
      if (rememberMe) localStorage.setItem('rememberMe', 'true');
      navigate('/dashboard');
    } catch (err) {
      setError(sanitizeServerMessage(err.response?.data?.message) || 'Verification failed');
    } finally {
      setVerifying(false);
    }
  };

  const handleBackToLogin = () => {
    setTwoFactorPending(false);
    setTwoFactorToken('');
    setTwoFactorCode('');
    setIsSetup(false);
    setQrCode('');
    setManualKey('');
    setError('');
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img
            src="/logo.png"
            alt="AssetTrack Logo"
            style={{ width: 100, height: 100, objectFit: 'contain', display: 'block', margin: '0 auto 16px' }}
          />
          <h1>ASSETTRACK</h1>
          <p className="tagline">Smart Asset Tracking with QR Codes</p>
        </div>

        {/* ── Password login form ── */}
        {!twoFactorPending && (
          <form onSubmit={handleLogin} className="login-form">
            <div className="form-group">
              <label>Username or Email</label>
              <input
                type="text"
                placeholder="Enter your username or email"
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                required
              />
            </div>
            <div className="form-group">
              <label>Password</label>
              <div className="password-input">
                <input
                  type={showPassword ? 'text' : 'password'}
                  placeholder="Enter your password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  required
                />
                <button
                  type="button"
                  className="toggle-password"
                  onClick={() => setShowPassword(!showPassword)}
                >
                  {showPassword ? <FiEyeOff /> : <FiEye />}
                </button>
              </div>
            </div>

            {error && <div className="error-message">{error}</div>}

            <div className="form-group checkbox">
              <input
                type="checkbox"
                id="rememberMe"
                checked={rememberMe}
                onChange={(e) => setRememberMe(e.target.checked)}
              />
              <label htmlFor="rememberMe">Remember Me</label>
              <a href="/forgot-password" className="forgot-link">Forgot Password?</a>
            </div>

            <button type="submit" className="login-btn" disabled={loading}>
              {loading ? 'Logging in...' : 'Login'}
            </button>
          </form>
        )}

        {/* ── TOTP verification form ── */}
        {twoFactorPending && (
          <form onSubmit={handleVerify} className="login-form">

            {/* First login: show QR setup */}
            {isSetup && (
              <div style={{ marginBottom: 20 }}>
                <h3 style={{ color: '#1e293b', fontSize: 16, marginBottom: 8, textAlign: 'center' }}>
                  Set Up Authenticator
                </h3>
                <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginBottom: 16 }}>
                  Scan this QR code with <strong>Google Authenticator</strong> or <strong>Microsoft Authenticator</strong>.
                </p>

                {qrCode && (
                  <div style={{ textAlign: 'center', marginBottom: 16 }}>
                    <img
                      src={qrCode}
                      alt="Authenticator QR Code"
                      style={{ width: 200, height: 200, border: '2px solid #e2e8f0', borderRadius: 8 }}
                    />
                  </div>
                )}

                {manualKey && (
                  <div style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: '10px 14px', marginBottom: 16 }}>
                    <p style={{ color: '#64748b', fontSize: 12, margin: '0 0 4px' }}>Manual setup key:</p>
                    <code style={{ color: '#1e293b', fontSize: 13, wordBreak: 'break-all', letterSpacing: 1 }}>
                      {manualKey}
                    </code>
                  </div>
                )}

                <p style={{ color: '#475569', fontSize: 13, textAlign: 'center', marginBottom: 8 }}>
                  After scanning, enter the 6-digit code generated by your Authenticator app below.
                </p>
              </div>
            )}

            {/* Existing user: just show code prompt */}
            {!isSetup && (
              <div className="info-message" style={{ marginBottom: 16 }}>
                Enter the 6-digit code from your Authenticator app.
              </div>
            )}

            <div className="form-group">
              <label>{isSetup ? 'Authenticator Code (from app)' : 'Authenticator Code'}</label>
              <input
                type="text"
                inputMode="numeric"
                placeholder="Enter 6-digit code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                maxLength={6}
                autoFocus
                required
              />
            </div>

            {error && <div className="error-message">{error}</div>}

            <button type="submit" className="login-btn" disabled={verifying}>
              {verifying ? 'Verifying...' : 'Verify'}
            </button>

            <button
              type="button"
              onClick={handleBackToLogin}
              style={{ marginTop: 8, width: '100%', padding: 10, background: 'none', border: 'none', color: '#667eea', cursor: 'pointer', fontSize: 14 }}
            >
              ← Back to Login
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
