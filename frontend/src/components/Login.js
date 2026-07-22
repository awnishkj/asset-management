import React, { useEffect, useState } from 'react';
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
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');
  const [verifying, setVerifying] = useState(false);
  const [twoFactorSetup, setTwoFactorSetup] = useState(false);
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);
  const navigate = useNavigate();

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    // Clear any stale 2FA token from a previous session
    localStorage.removeItem('twoFactorToken');

    try {
      const response = await axios.post(`${API_URL}/auth/login`, {
        identifier,
        password,
        rememberMe
      });

      if (response.data && response.data.twoFactor) {
        const token = response.data.twoFactorToken || '';
        setTwoFactorPending(true);
        setTwoFactorToken(token);
        // Do NOT persist to localStorage — keep only in state to avoid stale token issues
        setTwoFactorSetup(!!response.data.setup);
        setError(sanitizeServerMessage(response.data.message) || (response.data.setup ? '2FA setup is required. Check your email for the code.' : 'Enter verification code'));
        return;
      }

      localStorage.setItem('token', response.data.token);
      localStorage.setItem('user', JSON.stringify(response.data.user));
      
      if (rememberMe) {
        localStorage.setItem('rememberMe', 'true');
      }

      navigate('/dashboard');
    } catch (err) {
      setError(sanitizeServerMessage(err.response?.data?.message) || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!resendCooldown) return;
    const timer = setInterval(() => {
      setResendCooldown((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [resendCooldown]);

  const handleVerify = async (e) => {
    e.preventDefault();
    setVerifying(true);
    setError('');
    try {
      const headers = {};
      // Always use state token, never fall back to stale localStorage value
      const token = twoFactorToken;
      if (!token) {
        setError('Session expired. Please log in again.');
        setTwoFactorPending(false);
        setVerifying(false);
        return;
      }
      headers.Authorization = `Bearer ${token}`;
      const res = await axios.post(`${API_URL}/auth/verify-2fa`, { code: twoFactorCode, twoFactorToken: token }, { headers });
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

  const handleResend = async () => {
    if (resendCooldown > 0 || resendLoading) return;
    setResendLoading(true);
    setError('');
    try {
      const headers = {};
      // Always use state token
      const token = twoFactorToken;
      if (token) headers.Authorization = `Bearer ${token}`;
      const response = await axios.post(`${API_URL}/auth/resend-2fa`, { twoFactorToken: token }, { headers });
      const newToken = response.data.twoFactorToken;
      if (newToken) {
        setTwoFactorToken(newToken);
        // Keep only in state, not localStorage
      }
      setError(sanitizeServerMessage(response.data.message) || 'Verification code resent. Check your email.');
      setResendCooldown(30);
    } catch (err) {
      setError(sanitizeServerMessage(err.response?.data?.message) || 'Resend failed');
    } finally {
      setResendLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <img src="/logo.png" alt="AssetTrack Logo" style={{ width: 100, height: 100, objectFit: 'contain', display: 'block', margin: '0 auto 16px' }} />
          <h1>ASSETTRACK</h1>
          <p className="tagline">Smart Asset Tracking with QR Codes</p>
        </div>

        <form onSubmit={twoFactorPending ? handleVerify : handleLogin} className="login-form">
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

          {!twoFactorPending ? (
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
          ) : (
            <div className="form-group">
              <label>Verification Code</label>
              <input
                type="text"
                placeholder="Enter the 6-digit code"
                value={twoFactorCode}
                onChange={(e) => setTwoFactorCode(e.target.value)}
                required
              />
            </div>
          )}

          {error && <div className="error-message">{error}</div>}
          {twoFactorSetup && <div className="info-message">Two-factor authentication will be enabled for your account after verification.</div>}
          {twoFactorPending && <div className="info-message">A verification code has been sent to your email. Check your inbox.</div>}
          {twoFactorPending && (
            <div className="resend-row">
              <button
                type="button"
                className="resend-btn"
                onClick={handleResend}
                disabled={resendLoading || resendCooldown > 0}
              >
                {resendLoading ? 'Resending...' : resendCooldown > 0 ? `Resend available in ${resendCooldown}s` : 'Resend code'}
              </button>
              <button
                type="button"
                className="resend-btn"
                style={{ marginLeft: '8px' }}
                onClick={() => {
                  setTwoFactorPending(false);
                  setTwoFactorToken('');
                  setTwoFactorCode('');
                  setError('');
                  localStorage.removeItem('twoFactorToken');
                }}
              >
                Back to Login
              </button>
            </div>
          )}

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

          <button type="submit" className="login-btn" disabled={loading || verifying}>
            {twoFactorPending ? (verifying ? 'Verifying...' : 'Verify') : (loading ? 'Logging in...' : 'Login')}
          </button>
        </form>

        {/* <div className="login-footer">
          <p>Don't have an account? <a href="/signup">Sign up</a></p>
        </div> */}

      </div>
    </div>
  );
}
