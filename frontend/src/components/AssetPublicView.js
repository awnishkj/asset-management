import React, { useEffect, useState, useCallback } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import axios from 'axios';

const API_URL = process.env.REACT_APP_API_URL || `http://${window.location.hostname}:5000/api`;

const STATUS_OPTIONS = [
  { value: 'Active',      label: 'ACTIVE (In Use)' },
  { value: 'Inactive',    label: 'INACTIVE (Not in Use)' },
  { value: 'Maintenance', label: 'MAINTENANCE' },
  { value: 'Damaged',     label: 'DAMAGED' },
];

const STATUS_STYLE = {
  Active:      { bg: '#1a472a', color: '#4ade80', border: '#22c55e' },
  Inactive:    { bg: '#1e3a5f', color: '#60a5fa', border: '#3b82f6' },
  Maintenance: { bg: '#4a2c00', color: '#fbbf24', border: '#f59e0b' },
  Damaged:     { bg: '#4a1515', color: '#f87171', border: '#ef4444' },
};

/**
 * Decode a JWT payload without verifying the signature (client-side only).
 * Used solely to check the 'exp' claim so we can detect a stale localStorage token
 * before attempting a backend call. The server still verifies the signature.
 */
function jwtExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    // exp is seconds since epoch
    return payload.exp && Date.now() / 1000 > payload.exp;
  } catch {
    return true; // unparseable → treat as expired
  }
}

/**
 * Clear the stale session from localStorage and reset login state.
 */
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

export default function AssetPublicView() {
  const { assetId } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const scannedBy = searchParams.get('source') === 'pc' ? 'PC Scan' : 'Mobile Scan';

  // ── ALL hooks declared unconditionally first ──
  // isLoggedIn: true only if token exists AND is not expired
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const t = localStorage.getItem('token');
    if (!t || jwtExpired(t)) {
      if (t) clearSession(); // purge stale token immediately
      return false;
    }
    return true;
  });
  const [showLoginGate, setShowLoginGate] = useState(false);
  const [loginForm, setLoginForm] = useState({ identifier: '', password: '' });
  const [loginError, setLoginError] = useState('');
  const [loginLoading, setLoginLoading] = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorToken, setTwoFactorToken] = useState('');
  const [twoFactorCode, setTwoFactorCode] = useState('');

  // ── TOTP verification modal state ──
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpInput, setTotpInput] = useState('');
  const [totpError, setTotpError] = useState('');
  const [totpLoading, setTotpLoading] = useState(false);
  // updateToken is held only in component state — never persisted to localStorage/sessionStorage
  const [updateToken, setUpdateToken] = useState(null);

  const [asset, setAsset] = useState(null);
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [view, setView] = useState('details');
  const [form, setForm] = useState({ status: 'Active', latitude: '', longitude: '', location: '', remarks: '' });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState('');

  const fetchAsset = useCallback(async () => {
    try {
      const encodedId = encodeURIComponent(assetId);
      const res = await axios.get(`${API_URL}/assets/public/${encodedId}`);
      setAsset(res.data);
      setForm(f => ({ ...f, status: res.data.status || 'Active' }));
    } catch (err) {
      setError(err.response?.data?.message || 'Asset not found');
    } finally {
      setLoading(false);
    }
  }, [assetId]);

  const fetchHistory = useCallback(async () => {
    try {
      const encodedId = encodeURIComponent(assetId);
      const res = await axios.get(`${API_URL}/assets/public/${encodedId}/history`);
      setHistory(res.data || []);
    } catch { /* ignore */ }
  }, [assetId]);

  useEffect(() => {
    fetchAsset();
    fetchHistory();
  }, [fetchAsset, fetchHistory]);

  // Clear the update token whenever the asset changes (navigating away and back)
  useEffect(() => {
    setUpdateToken(null);
  }, [assetId]);

  // ── Handlers ──

  /**
   * Called when the user clicks "Update Asset".
   * Flow:
   *   not logged in  → show login gate first
   *   logged in, no updateToken → show TOTP modal
   *   logged in, valid updateToken → go straight to update view
   */
  const handleUpdateClick = () => {
    // Re-check token expiry at click time — it may have expired while the page was open
    const storedToken = localStorage.getItem('token');
    if (!isLoggedIn || !storedToken || jwtExpired(storedToken)) {
      clearSession();
      setIsLoggedIn(false);
      setUpdateToken(null);
      setShowLoginGate(true);
      return;
    }
    // Always require a fresh TOTP verification — never trust a stale token
    setTotpInput('');
    setTotpError('');
    setShowTotpModal(true);
  };

  // ── Login gate ──
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await axios.post(`${API_URL}/auth/qr-login`, {
        identifier: loginForm.identifier,
        password: loginForm.password,
      });
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setIsLoggedIn(true);
      setShowLoginGate(false);
      // After login, immediately prompt for TOTP verification
      setTotpInput('');
      setTotpError('');
      setShowTotpModal(true);
    } catch (err) {
      try {
        const res2 = await axios.post(`${API_URL}/auth/login`, {
          identifier: loginForm.identifier,
          password: loginForm.password,
          rememberMe: false,
        });
        if (res2.data?.twoFactor) {
          setTwoFactorToken(res2.data.twoFactorToken || '');
          setTwoFactorPending(true);
          setLoginError('Enter the 6-digit code from your Authenticator app.');
        } else {
          localStorage.setItem('token', res2.data.token);
          localStorage.setItem('user', JSON.stringify(res2.data.user));
          setIsLoggedIn(true);
          setShowLoginGate(false);
          setTotpInput('');
          setTotpError('');
          setShowTotpModal(true);
        }
      } catch (err2) {
        setLoginError(err2.response?.data?.message || err.response?.data?.message || 'Invalid credentials');
      }
    } finally {
      setLoginLoading(false);
    }
  };

  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    try {
      const res = await axios.post(
        `${API_URL}/auth/verify-2fa`,
        { code: twoFactorCode, twoFactorToken },
        { headers: { Authorization: `Bearer ${twoFactorToken}` } }
      );
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setIsLoggedIn(true);
      setShowLoginGate(false);
      setTwoFactorPending(false);
      // After completing 2FA login, prompt for TOTP update verification
      setTotpInput('');
      setTotpError('');
      setShowTotpModal(true);
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid code');
    } finally {
      setLoginLoading(false);
    }
  };

  // ── TOTP update-verification modal ──
  const handleTotpVerify = async (e) => {
    e.preventDefault();
    const code = totpInput.trim();
    if (!code) {
      setTotpError('Please enter the 6-digit code from your Authenticator app.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setTotpError('Code must be exactly 6 digits.');
      return;
    }
    setTotpLoading(true);
    setTotpError('');
    try {
      const token = localStorage.getItem('token');

      // Guard: if token has expired since the modal opened, bail to login
      if (!token || jwtExpired(token)) {
        clearSession();
        setIsLoggedIn(false);
        setUpdateToken(null);
        setShowTotpModal(false);
        setTotpInput('');
        setLoginError('Your session has expired. Please log in again.');
        setShowLoginGate(true);
        return;
      }

      const encodedId = encodeURIComponent(assetId);
      const res = await axios.post(
        `${API_URL}/assets/public/${encodedId}/verify-update`,
        { totpCode: code },
        { headers: { Authorization: `Bearer ${token}` } }
      );
      // Store the update token in component state only — not in localStorage
      setUpdateToken(res.data.updateToken);
      setShowTotpModal(false);
      setTotpInput('');
      setView('update');
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || '';

      if (status === 401) {
        // Session token expired or invalid — clear it and force re-login
        clearSession();
        setIsLoggedIn(false);
        setUpdateToken(null);
        setShowTotpModal(false);
        setTotpInput('');
        setLoginError('Your session has expired. Please log in again.');
        setShowLoginGate(true);
      } else if (status === 400 && msg.toLowerCase().includes('not set up')) {
        setTotpError('Authenticator is not set up for your account. Please complete 2FA setup first.');
      } else {
        // 400 invalid code or any other error
        setTotpError(msg || 'Invalid Authenticator code. Please try again.');
      }
    } finally {
      setTotpLoading(false);
    }
  };

  const handleTotpCancel = () => {
    setShowTotpModal(false);
    setTotpInput('');
    setTotpError('');
  };

  // ── Asset update submit ──
  const handleSubmit = async () => {
    if (!updateToken) {
      setSubmitError('Update authorisation has expired. Please verify your Authenticator code again.');
      // Re-open TOTP modal so the user can re-verify without reloading
      setTotpInput('');
      setTotpError('');
      setShowTotpModal(true);
      return;
    }
    setSubmitting(true);
    setSubmitError('');
    try {
      const encodedId = encodeURIComponent(assetId);
      const storedUser = localStorage.getItem('user');
      const loggedInUser = storedUser ? JSON.parse(storedUser) : null;
      const updatedBy = loggedInUser?.username || loggedInUser?.email || null;
      const token = localStorage.getItem('token');

      await axios.post(
        `${API_URL}/assets/public/${encodedId}/update`,
        {
          status:    form.status,
          latitude:  form.latitude  || undefined,
          longitude: form.longitude || undefined,
          location:  form.location  || undefined,
          remarks:   form.remarks   || undefined,
          scannedBy: scannedBy,
          updatedBy: updatedBy,
        },
        {
          headers: {
            Authorization:    `Bearer ${token}`,
            'X-Update-Token': updateToken,
          },
        }
      );

      // Invalidate the update token immediately after a successful update
      setUpdateToken(null);

      const openedFromPC = searchParams.get('source') === 'pc';
      if (openedFromPC && !!token) {
        window.close();
        navigate('/dashboard');
      } else {
        setSubmitSuccess(true);
      }
    } catch (err) {
      const status = err.response?.status;
      const msg = err.response?.data?.message || 'Update failed. Try again.';
      if (status === 401) {
        // Session expired mid-flow
        clearSession();
        setIsLoggedIn(false);
        setUpdateToken(null);
        setView('details');
        setSubmitError('Your session expired. Please log in and verify again.');
      } else if (status === 403) {
        // Update token expired or mismatched — re-verify
        setUpdateToken(null);
        setSubmitError(msg + ' Please verify your Authenticator code again.');
        setTotpInput('');
        setTotpError('');
        setShowTotpModal(true);
      } else {
        setSubmitError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  // ── Back from update view resets the update token ──
  const handleBackToDetails = () => {
    setUpdateToken(null);
    setView('details');
  };

  // ── Conditional renders AFTER all hooks ──

  if (submitSuccess) return (
    <div style={S.center}>
      <div style={{ fontSize: 64, marginBottom: 16 }}>✅</div>
      <h2 style={{ color: '#4ade80', fontSize: 22, margin: '0 0 8px' }}>Update Submitted!</h2>
      <p style={{ color: '#94a3b8', fontSize: 15, textAlign: 'center', padding: '0 24px' }}>
        Asset <strong style={{ color: '#f1f5f9' }}>{assetId}</strong> has been updated successfully.
      </p>
      <button
        onClick={() => { setSubmitSuccess(false); setView('details'); fetchAsset(); fetchHistory(); }}
        style={{ marginTop: 24, background: '#22c55e', color: '#fff', border: 'none', borderRadius: 12, padding: '14px 32px', fontSize: 15, fontWeight: 600, cursor: 'pointer' }}
      >
        View Asset Details
      </button>
      <button
        onClick={() => navigate(-1)}
        style={{ marginTop: 10, background: 'transparent', color: '#94a3b8', border: '1px solid #334155', borderRadius: 12, padding: '12px 32px', fontSize: 14, cursor: 'pointer' }}
      >
        Go Back
      </button>
    </div>
  );

  if (loading) return (
    <div style={S.center}>
      <div style={S.spinner} />
      <p style={{ color: '#aaa', marginTop: 16, fontSize: 14 }}>Loading asset...</p>
    </div>
  );

  if (error) return (
    <div style={S.center}>
      <div style={{ fontSize: 48 }}>❌</div>
      <h2 style={{ color: '#fff', marginTop: 12 }}>Asset Not Found</h2>
      <p style={{ color: '#aaa', marginTop: 8 }}>ID: {assetId}</p>
    </div>
  );

  const ss = STATUS_STYLE[asset.status] || STATUS_STYLE.Active;

  return (
    <div style={S.page}>
      {/* Top bar */}
      <div style={S.topBar}>
        {view === 'update'
          ? <button style={S.backBtn} onClick={handleBackToDetails}>←</button>
          : <span style={{ width: 32 }} />
        }
        <span style={S.topTitle}>{view === 'update' ? 'Update Asset' : 'Asset Details'}</span>
        <span style={{ width: 32 }} />
      </div>

      {/* ── LOGIN OVERLAY ── */}
      {showLoginGate && (
        <div style={S.overlay}>
          <div style={S.loginCard}>
            <img src="/logo.png" alt="logo" style={{ width: 56, height: 56, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />
            <h2 style={{ color: '#f1f5f9', fontSize: 18, textAlign: 'center', margin: '0 0 4px' }}>Login Required</h2>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>Login to update this asset</p>

            <form onSubmit={twoFactorPending ? handleVerify2FA : handleLogin} style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!twoFactorPending ? (
                <>
                  <input style={S.loginInput} type="text" placeholder="Username or Email"
                    value={loginForm.identifier} onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))} required />
                  <input style={S.loginInput} type="password" placeholder="Password"
                    value={loginForm.password} onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))} required />
                </>
              ) : (
                <>
                  <p style={{ color: '#60a5fa', fontSize: 13, margin: 0, textAlign: 'center' }}>
                    Enter the 6-digit code from your Authenticator app to complete login.
                  </p>
                  <input style={S.loginInput} type="text" placeholder="6-digit Authenticator code"
                    value={twoFactorCode} onChange={e => setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                    maxLength={6} inputMode="numeric" pattern="\d{6}" required autoFocus />
                </>
              )}
              {loginError && <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{loginError}</p>}
              <button type="submit" style={S.submitBtn} disabled={loginLoading}>
                {loginLoading ? (twoFactorPending ? 'Verifying...' : 'Logging in...') : (twoFactorPending ? 'Verify Code' : 'Login')}
              </button>
              {twoFactorPending && (
                <button type="button" onClick={() => { setTwoFactorPending(false); setTwoFactorCode(''); setLoginError(''); }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                  ← Back
                </button>
              )}
              <button type="button" onClick={() => { setShowLoginGate(false); setTwoFactorPending(false); setTwoFactorCode(''); setLoginError(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── AUTHENTICATOR VERIFICATION MODAL ── */}
      {showTotpModal && (
        <div style={S.overlay}>
          <div style={S.loginCard}>
            {/* Shield icon */}
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>🔐</span>
            </div>
            <h2 style={{ color: '#f1f5f9', fontSize: 18, textAlign: 'center', margin: '0 0 6px' }}>
              Authenticator Verification
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
              Enter the 6-digit code from your Authenticator app to continue.
            </p>

            <form onSubmit={handleTotpVerify} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
              <input
                style={{
                  ...S.loginInput,
                  textAlign: 'center',
                  fontSize: 26,
                  fontWeight: 700,
                  letterSpacing: 10,
                  padding: '14px 10px',
                  color: '#f1f5f9',
                }}
                type="text"
                inputMode="numeric"
                pattern="\d{6}"
                maxLength={6}
                placeholder="000000"
                value={totpInput}
                onChange={e => {
                  setTotpError('');
                  setTotpInput(e.target.value.replace(/\D/g, '').slice(0, 6));
                }}
                autoFocus
                autoComplete="one-time-code"
              />

              {totpError && (
                <p style={{ color: '#f87171', fontSize: 13, margin: 0, textAlign: 'center' }}>
                  {totpError}
                </p>
              )}

              <button
                type="submit"
                style={{
                  ...S.submitBtn,
                  background: totpLoading ? '#16a34a' : '#22c55e',
                  opacity: totpLoading ? 0.8 : 1,
                }}
                disabled={totpLoading}
              >
                {totpLoading ? 'Verifying…' : 'Verify'}
              </button>

              <button
                type="button"
                onClick={handleTotpCancel}
                style={{
                  background: 'none',
                  border: '1px solid #334155',
                  borderRadius: 10,
                  color: '#94a3b8',
                  fontSize: 14,
                  padding: '12px',
                  cursor: 'pointer',
                  width: '100%',
                }}
              >
                Cancel
              </button>
            </form>

            <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              Open Google Authenticator or Microsoft Authenticator and enter the current code for <strong style={{ color: '#64748b' }}>AssetTrack</strong>.
            </p>
          </div>
        </div>
      )}

      {/* ── UPDATE FORM VIEW ── */}
      {view === 'update' && (
        <div style={S.scrollBody}>
          <div style={S.field}>
            <label style={S.label}>Asset ID</label>
            <input style={S.input} value={asset.assetId} readOnly />
          </div>

          <div style={S.field}>
            <label style={S.label}>Asset Name</label>
            <input style={S.input} value={asset.assetName} readOnly />
          </div>

          <div style={S.field}>
            <label style={S.label}>Current Location</label>
            <input
              style={S.input}
              value={form.location}
              onChange={e => setForm(f => ({ ...f, location: e.target.value }))}
              placeholder="Type location"
            />
          </div>

          <div style={S.field}>
            <label style={S.label}>Status</label>
            <select
              style={S.select}
              value={form.status}
              onChange={e => setForm(f => ({ ...f, status: e.target.value }))}
            >
              {STATUS_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div style={S.field}>
            <label style={S.label}>Remarks (Optional)</label>
            <textarea
              style={S.textarea}
              placeholder="Enter remarks"
              value={form.remarks}
              onChange={e => setForm(f => ({ ...f, remarks: e.target.value }))}
              rows={3}
            />
          </div>

          {submitError && <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{submitError}</p>}

          <button style={S.submitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting...' : 'Submit Update'}
          </button>

          <button style={S.viewDetailsBtn} onClick={handleBackToDetails}>
            View Asset Details
          </button>
        </div>
      )}

      {/* ── ASSET DETAILS VIEW ── */}
      {view === 'details' && (
        <div style={S.scrollBody}>

          {/* Asset header card */}
          <div style={S.detailCard}>
            <div style={{ display: 'flex', gap: 14, alignItems: 'flex-start' }}>
              <div style={S.assetIcon}>
                <span style={{ fontSize: 28 }}>
                  {asset.category === 'IT Equipment' ? '💻'
                    : asset.category === 'Vehicles' ? '🚗'
                    : asset.category === 'Furniture' ? '🪑'
                    : asset.category === 'Machinery' ? '⚙️' : '📦'}
                </span>
              </div>
              <div style={{ flex: 1 }}>
                <p style={{ color: '#94a3b8', fontSize: 12, margin: 0 }}>{asset.assetId}</p>
                <h2 style={{ color: '#fff', fontSize: 18, margin: '2px 0 6px' }}>{asset.assetName}</h2>
                <span style={{ ...S.statusBadge, background: ss.bg, color: ss.color, borderColor: ss.border }}>
                  {asset.status}
                </span>
              </div>
            </div>
          </div>

          {/* Detail rows */}
          <div style={S.detailCard}>
            {[
              { label: 'Category',     value: asset.category },
              { label: 'Description',  value: asset.description || '—' },
              { label: 'Status',       value: asset.status },
              { label: 'Last Updated', value: asset.lastUpdated ? new Date(asset.lastUpdated).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }) : '—' },
              { label: 'Updated By',   value: asset.updatedBy || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={S.detailRow}>
                <span style={S.detailLabel}>{label}</span>
                <span style={S.detailValue}>{value}</span>
              </div>
            ))}
            {asset.latitude && asset.longitude && (
              <div style={{ ...S.detailRow, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={S.detailLabel}>Current Location</span>
                <span style={{ color: '#4ade80', fontSize: 13 }}>
                  📍 {Number(asset.latitude).toFixed(4)}, {Number(asset.longitude).toFixed(4)}
                </span>
                {asset.location && <span style={{ color: '#94a3b8', fontSize: 12 }}>{asset.location}</span>}
              </div>
            )}
          </div>

          {/* Location History */}
          {history.length > 0 && (
            <div style={S.detailCard}>
              <h3 style={{ color: '#fff', fontSize: 16, margin: '0 0 14px' }}>Location History</h3>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 0 }}>
                {history.map((h, i) => {
                  const dotColor = i === 0 ? '#3b82f6' : i === 1 ? '#22c55e' : i === 2 ? '#a3a3a3' : '#eab308';
                  return (
                    <div key={h._id || i} style={S.historyRow}>
                      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                        <div style={{ ...S.historyDot, background: dotColor }} />
                        {i < history.length - 1 && <div style={S.historyLine} />}
                      </div>
                      <div style={{ flex: 1, paddingBottom: i < history.length - 1 ? 14 : 0 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                          <span style={{ color: '#e2e8f0', fontSize: 13, fontWeight: 500 }}>
                            {new Date(h.scannedAt).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}
                          </span>
                          {h.status && (
                            <span style={{ fontSize: 11, color: STATUS_STYLE[h.status]?.color || '#aaa' }}>{h.status}</span>
                          )}
                        </div>
                        {h.location && <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }}>{h.location}</p>}
                        {h.remarks && <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0', fontStyle: 'italic' }}>"{h.remarks}"</p>}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          )}

          <button style={S.submitBtn} onClick={handleUpdateClick}>
            ✏️ Update Asset
          </button>
        </div>
      )}
    </div>
  );
}

const S = {
  page: {
    minHeight: '100vh',
    background: '#0f172a',
    fontFamily: "'Segoe UI', sans-serif",
    display: 'flex',
    flexDirection: 'column',
  },
  center: {
    minHeight: '100vh',
    background: '#0f172a',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    fontFamily: "'Segoe UI', sans-serif",
  },
  spinner: {
    width: 36,
    height: 36,
    border: '3px solid #334155',
    borderTop: '3px solid #667eea',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  topBar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '16px 20px',
    borderBottom: '1px solid #1e293b',
  },
  topTitle: { color: '#f1f5f9', fontSize: 17, fontWeight: 600 },
  backBtn: {
    background: 'none',
    border: 'none',
    color: '#94a3b8',
    fontSize: 22,
    cursor: 'pointer',
    padding: '0 8px',
    width: 32,
  },
  scrollBody: {
    flex: 1,
    padding: '20px 16px 40px',
    display: 'flex',
    flexDirection: 'column',
    gap: 12,
    maxWidth: 520,
    width: '100%',
    alignSelf: 'center',
  },
  field: { display: 'flex', flexDirection: 'column', gap: 6 },
  label: { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
  input: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 15,
    padding: '12px 14px',
    outline: 'none',
  },
  select: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 15,
    padding: '12px 14px',
    outline: 'none',
    width: '100%',
    appearance: 'auto',
  },
  textarea: {
    background: '#1e293b',
    border: '1px solid #334155',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 14,
    padding: '12px 14px',
    outline: 'none',
    resize: 'vertical',
    fontFamily: 'inherit',
  },
  loginCard: {
    background: '#1e293b',
    borderRadius: 16,
    padding: '32px 24px',
    width: '100%',
    maxWidth: 360,
    border: '1px solid #334155',
  },
  overlay: {
    position: 'fixed',
    top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    zIndex: 100,
  },
  loginInput: {
    background: '#0f172a',
    border: '1px solid #334155',
    borderRadius: 10,
    color: '#f1f5f9',
    fontSize: 15,
    padding: '12px 14px',
    outline: 'none',
    width: '100%',
    boxSizing: 'border-box',
  },
  submitBtn: {
    background: '#22c55e',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '16px',
    fontSize: 16,
    fontWeight: 700,
    cursor: 'pointer',
    width: '100%',
    marginTop: 8,
  },
  viewDetailsBtn: {
    background: 'transparent',
    color: '#94a3b8',
    border: '1px solid #334155',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 500,
    cursor: 'pointer',
    width: '100%',
  },
  detailCard: {
    background: '#1e293b',
    borderRadius: 14,
    padding: '16px',
    border: '1px solid #334155',
  },
  assetIcon: {
    width: 56,
    height: 56,
    borderRadius: 14,
    background: '#0f172a',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    flexShrink: 0,
  },
  statusBadge: {
    display: 'inline-block',
    padding: '3px 12px',
    borderRadius: 20,
    fontSize: 12,
    fontWeight: 600,
    border: '1px solid',
  },
  detailRow: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '9px 0',
    borderBottom: '1px solid #0f172a',
  },
  detailLabel: { color: '#64748b', fontSize: 13 },
  detailValue: { color: '#e2e8f0', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%' },
  historyRow: {
    display: 'flex',
    gap: 12,
    alignItems: 'flex-start',
  },
  historyDot: {
    width: 12,
    height: 12,
    borderRadius: '50%',
    flexShrink: 0,
    marginTop: 3,
  },
  historyLine: {
    width: 2,
    flex: 1,
    background: '#334155',
    marginTop: 2,
    minHeight: 20,
  },
};
