import React, { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { FiEye, FiEyeOff } from 'react-icons/fi';
import axios from 'axios';
import '../styles/Login.css';

export default function Signup() {
  const [username, setUsername] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const navigate = useNavigate();

  const handleSignup = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');
    setSuccess('');

    try {
      await axios.post('/auth/register', {
        username,
        email,
        password
      });

      setSuccess('Signup successful! Redirecting to login...');
      setTimeout(() => {
        navigate('/login');
      }, 1200);
    } catch (err) {
      setError(err.response?.data?.message || 'Signup failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="login-container">
      <div className="login-card">
        <div className="login-header">
          <div className="logo-area">
            <div className="logo">
              <img src="/logo.png" alt="AssetTrack Logo" style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'contain' }} />
            </div>
          </div>
          <h1>ASSETTRACK</h1>
          <p className="tagline">Smart Asset Tracking with QR Codes</p>
        </div>

        <form onSubmit={handleSignup} className="login-form">
          <div className="form-group">
            <label>Username</label>
            <input
              type="text"
              placeholder="Enter your username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Email</label>
            <input
              type="email"
              placeholder="Enter your email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="form-group">
            <label>Password</label>
            <div className="password-input">
              <input
                type={showPassword ? 'text' : 'password'}
                placeholder="Create a password"
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
          {success && <div className="success-message">{success}</div>}

          <button type="submit" className="login-btn" disabled={loading}>
            {loading ? 'Signing up...' : 'Sign up'}
          </button>
        </form>

        <div className="login-footer">
          <p>Already have an account? <Link to="/login">Log in</Link></p>
        </div>

        <div className="qr-section">
          <p className="qr-text">Register and start tracking.</p>
          <div className="qr-placeholder">
            <div className="qr-icon">█ █ █</div>
          </div>
        </div>
      </div>
    </div>
  );
}
