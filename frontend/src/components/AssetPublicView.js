import React, { useEffect, useState, useCallback, useRef } from 'react';
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

// ── Helpers ──────────────────────────────────────────────────────────────────

/**
 * Decode the JWT exp claim client-side (no secret needed — server still
 * verifies the signature on every request). Returns true if expired/invalid.
 */
function jwtExpired(token) {
  try {
    const payload = JSON.parse(atob(token.split('.')[1]));
    return payload.exp ? Date.now() / 1000 > payload.exp : false;
  } catch {
    return true;
  }
}

/** Remove stale session data from localStorage. */
function clearSession() {
  localStorage.removeItem('token');
  localStorage.removeItem('user');
}

/** Return a valid token from localStorage, or null if missing/expired. */
function getValidToken() {
  const t = localStorage.getItem('token');
  if (!t || jwtExpired(t)) return null;
  return t;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function AssetPublicView() {
  const { assetId } = useParams();
  const navigate   = useNavigate();
  const [searchParams] = useSearchParams();
  const scannedBy = searchParams.get('source') === 'pc' ? 'PC Scan' : 'Mobile Scan';

  // ── Refs (survive re-renders, never cause extra renders) ──────────────────
  // Prevents double-click from opening TOTP modal or submitting twice.
  const totpOpeningRef   = useRef(false); // guard: only one TOTP modal open at a time
  const totpVerifyingRef = useRef(false); // guard: only one /verify-update call at a time
  const submittingRef    = useRef(false); // guard: only one /update call at a time

  // ── Session state ─────────────────────────────────────────────────────────
  const [isLoggedIn, setIsLoggedIn] = useState(() => {
    const t = localStorage.getItem('token');
    if (!t || jwtExpired(t)) { if (t) clearSession(); return false; }
    return true;
  });

  // ── Login gate state ──────────────────────────────────────────────────────
  const [showLoginGate,   setShowLoginGate]   = useState(false);
  const [loginForm,       setLoginForm]       = useState({ identifier: '', password: '' });
  const [loginError,      setLoginError]      = useState('');
  const [loginLoading,    setLoginLoading]    = useState(false);
  const [twoFactorPending, setTwoFactorPending] = useState(false);
  const [twoFactorToken,  setTwoFactorToken]  = useState('');
  const [twoFactorCode,   setTwoFactorCode]   = useState('');

  // ── Asset-update TOTP modal state ─────────────────────────────────────────
  const [showTotpModal, setShowTotpModal] = useState(false);
  const [totpInput,     setTotpInput]     = useState('');
  const [totpError,     setTotpError]     = useState('');
  const [totpLoading,   setTotpLoading]   = useState(false);
  // updateToken lives only in component state — never in localStorage/sessionStorage
  const [updateToken, setUpdateToken] = useState(null);

  // ── Asset state ───────────────────────────────────────────────────────────
  const [asset,       setAsset]       = useState(null);
  const [history,     setHistory]     = useState([]);
  const [loading,     setLoading]     = useState(true);
  const [error,       setError]       = useState('');
  const [view,        setView]        = useState('details');
  const [form,        setForm]        = useState({ status: 'Active', location: '', remarks: '' });
  const [submitSuccess, setSubmitSuccess] = useState(false);
  const [submitting,  setSubmitting]  = useState(false);
  const [submitError, setSubmitError] = useState('');

  // ── Data fetching ─────────────────────────────────────────────────────────

  const fetchAsset = useCallback(async () => {
    try {
      const res = await axios.get(`${API_URL}/assets/public/${encodeURIComponent(assetId)}`);
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
      const res = await axios.get(`${API_URL}/assets/public/${encodeURIComponent(assetId)}/history`);
      setHistory(res.data || []);
    } catch { /* non-critical */ }
  }, [assetId]);

  useEffect(() => { fetchAsset(); fetchHistory(); }, [fetchAsset, fetchHistory]);

  // Clear update token whenever the asset changes
  useEffect(() => { setUpdateToken(null); }, [assetId]);

  // ── Core helper: call /verify-update with a code and store the result ─────
  /**
   * Calls POST /assets/public/:assetId/verify-update with the given code.
   *
   * @param {string} code       - 6-digit TOTP code (already trimmed)
   * @param {string} bearerJwt  - the full session JWT from localStorage
   * @returns {{ ok: boolean, updateToken?: string, errorMsg?: string, status?: number }}
   */
  const callVerifyUpdate = useCallback(async (code, bearerJwt) => {
    console.log('[verify-update] → calling POST /verify-update | assetId:', assetId);
    try {
      const res = await axios.post(
        `${API_URL}/assets/public/${encodeURIComponent(assetId)}/verify-update`,
        { totpCode: code },
        { headers: { Authorization: `Bearer ${bearerJwt}` } }
      );
      console.log('[verify-update] ✓ success | updateToken received:', !!res.data.updateToken);
      return { ok: true, updateToken: res.data.updateToken };
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || 'Verification failed.';
      console.log('[verify-update] ✗ failed | status:', status, '| message:', msg);
      return { ok: false, status, errorMsg: msg };
    }
  }, [assetId]);

  // ── handleUpdateClick ─────────────────────────────────────────────────────
  /**
   * Entry point when the user taps "Update Asset".
   *
   * Flow A (already logged in):
   *   valid JWT → open TOTP modal once
   *
   * Flow B (no valid session):
   *   invalid/expired JWT → clear session → show login gate
   */
  const handleUpdateClick = () => {
    console.log('[handleUpdateClick] called | isLoggedIn:', isLoggedIn);

    // Double-click guard
    if (totpOpeningRef.current) {
      console.log('[handleUpdateClick] blocked — TOTP already opening');
      return;
    }

    const token = getValidToken();
    console.log('[handleUpdateClick] token valid:', !!token);

    if (!token) {
      clearSession();
      setIsLoggedIn(false);
      setUpdateToken(null);
      setShowLoginGate(true);
      console.log('[handleUpdateClick] → showing login gate (no valid session)');
      return;
    }

    // Valid session — open TOTP modal once
    totpOpeningRef.current = true;
    setTotpInput('');
    setTotpError('');
    setShowTotpModal(true);
    console.log('[handleUpdateClick] → showing TOTP modal (session valid)');
    // Reset guard after state settles
    setTimeout(() => { totpOpeningRef.current = false; }, 300);
  };

  // ── Login gate: password step ─────────────────────────────────────────────
  const handleLogin = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    console.log('[handleLogin] login attempt started');
    try {
      // qr-login requires totpCode — it will fail here because we don't have
      // it yet. We fall through to /auth/login which initiates the TOTP step.
      const res = await axios.post(`${API_URL}/auth/qr-login`, {
        identifier: loginForm.identifier,
        password:   loginForm.password,
      });
      // qr-login succeeded (rare — only if server-side SKIP_2FA or similar)
      localStorage.setItem('token', res.data.token);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setIsLoggedIn(true);
      setShowLoginGate(false);
      console.log('[handleLogin] qr-login succeeded → auto-verifying update (no second prompt needed)');
      // qr-login doesn't give us a TOTP code to reuse, so show the TOTP modal
      // once for the asset-update authorisation.
      totpOpeningRef.current = true;
      setTotpInput('');
      setTotpError('');
      setShowTotpModal(true);
      setTimeout(() => { totpOpeningRef.current = false; }, 300);
    } catch {
      // Expected path: qr-login fails → use /auth/login which returns twoFactor:true
      try {
        const res2 = await axios.post(`${API_URL}/auth/login`, {
          identifier: loginForm.identifier,
          password:   loginForm.password,
          rememberMe: false,
        });
        if (res2.data?.twoFactor) {
          setTwoFactorToken(res2.data.twoFactorToken || '');
          setTwoFactorPending(true);
          setLoginError('');
          console.log('[handleLogin] → 2FA required, showing Authenticator input in login gate');
        } else {
          // Login without 2FA (SKIP_2FA dev mode)
          localStorage.setItem('token', res2.data.token);
          localStorage.setItem('user', JSON.stringify(res2.data.user));
          setIsLoggedIn(true);
          setShowLoginGate(false);
          console.log('[handleLogin] login (no 2FA) succeeded → opening TOTP modal for asset update');
          totpOpeningRef.current = true;
          setTotpInput('');
          setTotpError('');
          setShowTotpModal(true);
          setTimeout(() => { totpOpeningRef.current = false; }, 300);
        }
      } catch (err2) {
        setLoginError(err2.response?.data?.message || 'Invalid credentials');
        console.log('[handleLogin] failed:', err2.response?.data?.message);
      }
    } finally {
      setLoginLoading(false);
    }
  };

  // ── Login gate: 2FA (Authenticator) step ─────────────────────────────────
  /**
   * The user just typed their Authenticator code to complete login.
   * After /verify-2fa succeeds we have a valid session JWT AND we already
   * have the TOTP code in `twoFactorCode`. We reuse it immediately to call
   * /verify-update — this eliminates the second prompt entirely.
   *
   * The backend still verifies the code against user.twoFactorSecret.
   * Security is unchanged — we just avoid asking the user to type it twice.
   */
  const handleVerify2FA = async (e) => {
    e.preventDefault();
    setLoginLoading(true);
    setLoginError('');
    console.log('[handleVerify2FA] called');
    try {
      const res = await axios.post(
        `${API_URL}/auth/verify-2fa`,
        { code: twoFactorCode, twoFactorToken },
        { headers: { Authorization: `Bearer ${twoFactorToken}` } }
      );
      const sessionToken = res.data.token;
      localStorage.setItem('token', sessionToken);
      localStorage.setItem('user', JSON.stringify(res.data.user));
      setIsLoggedIn(true);
      setShowLoginGate(false);
      setTwoFactorPending(false);
      console.log('[handleVerify2FA] login complete → reusing login code for asset-update verify (no second prompt)');

      // ── KEY FIX: reuse the same code for the asset-update authorisation ──
      // The user just proved they are who they say they are with this code.
      // Pass it straight to /verify-update — the backend re-verifies it
      // against user.twoFactorSecret independently. No second prompt shown.
      if (totpVerifyingRef.current) {
        console.log('[handleVerify2FA] verify-update already in flight, skipping duplicate');
        return;
      }
      totpVerifyingRef.current = true;
      setTotpLoading(true);

      const result = await callVerifyUpdate(twoFactorCode, sessionToken);
      setTotpLoading(false);
      totpVerifyingRef.current = false;

      // Clear the login code from state immediately after use
      setTwoFactorCode('');

      if (result.ok) {
        setUpdateToken(result.updateToken);
        console.log('[handleVerify2FA] asset-update token received → opening update form');
        setView('update');
      } else if (result.status === 401) {
        // Shouldn't happen right after a fresh login, but guard anyway
        clearSession();
        setIsLoggedIn(false);
        setLoginError('Session error. Please log in again.');
        setShowLoginGate(true);
      } else {
        // TOTP code was accepted for login but rejected for update (clock drift, etc.)
        // Fall back to showing the TOTP modal so user can enter a fresh code
        console.log('[handleVerify2FA] auto-verify failed, falling back to TOTP modal:', result.errorMsg);
        totpOpeningRef.current = true;
        setTotpInput('');
        setTotpError(result.errorMsg || 'Please enter your Authenticator code to authorise this update.');
        setShowTotpModal(true);
        setTimeout(() => { totpOpeningRef.current = false; }, 300);
      }
    } catch (err) {
      setLoginError(err.response?.data?.message || 'Invalid code');
      console.log('[handleVerify2FA] /verify-2fa failed:', err.response?.data?.message);
    } finally {
      setLoginLoading(false);
    }
  };

  // ── TOTP modal: Verify button ─────────────────────────────────────────────
  /**
   * Used by the already-logged-in path only.
   * The login gate is already closed; this is the single TOTP prompt.
   */
  const handleTotpVerify = async (e) => {
    e.preventDefault();
    console.log('[handleTotpVerify] called');

    // Double-submit guard
    if (totpVerifyingRef.current) {
      console.log('[handleTotpVerify] blocked — verify already in flight');
      return;
    }

    const code = totpInput.trim();
    if (!code) {
      setTotpError('Please enter the 6-digit code from your Authenticator app.');
      return;
    }
    if (!/^\d{6}$/.test(code)) {
      setTotpError('Code must be exactly 6 digits.');
      return;
    }

    const token = getValidToken();
    if (!token) {
      clearSession();
      setIsLoggedIn(false);
      setUpdateToken(null);
      setShowTotpModal(false);
      setLoginError('Your session has expired. Please log in again.');
      setShowLoginGate(true);
      console.log('[handleTotpVerify] session expired → redirecting to login');
      return;
    }

    totpVerifyingRef.current = true;
    setTotpLoading(true);
    setTotpError('');

    const result = await callVerifyUpdate(code, token);

    setTotpLoading(false);
    totpVerifyingRef.current = false;

    if (result.ok) {
      setUpdateToken(result.updateToken);
      setShowTotpModal(false);
      setTotpInput('');
      setView('update');
      console.log('[handleTotpVerify] ✓ update token stored → update form opened');
    } else if (result.status === 401) {
      clearSession();
      setIsLoggedIn(false);
      setUpdateToken(null);
      setShowTotpModal(false);
      setTotpInput('');
      setLoginError('Your session has expired. Please log in again.');
      setShowLoginGate(true);
    } else if (result.status === 400 && result.errorMsg?.toLowerCase().includes('not set up')) {
      setTotpError('Authenticator is not set up on your account. Please complete 2FA setup first.');
    } else {
      setTotpError(result.errorMsg || 'Invalid Authenticator code. Please try again.');
    }
  };

  const handleTotpCancel = () => {
    setShowTotpModal(false);
    setTotpInput('');
    setTotpError('');
    console.log('[handleTotpCancel] TOTP modal cancelled');
  };

  // ── Asset update submit ───────────────────────────────────────────────────
  const handleSubmit = async () => {
    // Double-click guard
    if (submittingRef.current) {
      console.log('[handleSubmit] blocked — submit already in flight');
      return;
    }

    if (!updateToken) {
      setSubmitError('Update authorisation has expired. Please verify your Authenticator code again.');
      setTotpInput('');
      setTotpError('');
      setShowTotpModal(true);
      console.log('[handleSubmit] no updateToken → re-opening TOTP modal');
      return;
    }

    const token = getValidToken();
    if (!token) {
      clearSession();
      setIsLoggedIn(false);
      setUpdateToken(null);
      setView('details');
      setSubmitError('Session expired. Please log in and verify again.');
      console.log('[handleSubmit] session expired before submit');
      return;
    }

    submittingRef.current = true;
    setSubmitting(true);
    setSubmitError('');
    console.log('[handleSubmit] → POST /update | assetId:', assetId);

    try {
      const storedUser  = localStorage.getItem('user');
      const loggedInUser = storedUser ? JSON.parse(storedUser) : null;
      const updatedBy   = loggedInUser?.username || loggedInUser?.email || null;

      await axios.post(
        `${API_URL}/assets/public/${encodeURIComponent(assetId)}/update`,
        {
          status:    form.status,
          location:  form.location  || undefined,
          remarks:   form.remarks   || undefined,
          scannedBy,
          updatedBy,
        },
        {
          headers: {
            Authorization:    `Bearer ${token}`,
            'X-Update-Token': updateToken,
          },
        }
      );

      // Invalidate update token after successful use
      setUpdateToken(null);
      console.log('[handleSubmit] ✓ update successful');

      if (searchParams.get('source') === 'pc') {
        window.close();
        navigate('/dashboard');
      } else {
        setSubmitSuccess(true);
      }
    } catch (err) {
      const status = err.response?.status;
      const msg    = err.response?.data?.message || 'Update failed. Try again.';
      console.log('[handleSubmit] ✗ failed | status:', status);
      if (status === 401) {
        clearSession();
        setIsLoggedIn(false);
        setUpdateToken(null);
        setView('details');
        setSubmitError('Your session expired. Please log in and verify again.');
      } else if (status === 403) {
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
      submittingRef.current = false;
    }
  };

  // ── Back from update view ─────────────────────────────────────────────────
  const handleBackToDetails = () => {
    setUpdateToken(null);
    setView('details');
  };

  // ── Render ────────────────────────────────────────────────────────────────

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

      {/* ── Top bar ── */}
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
            <img src="/logo.png" alt="logo"
              style={{ width: 56, height: 56, objectFit: 'contain', display: 'block', margin: '0 auto 12px' }} />
            <h2 style={{ color: '#f1f5f9', fontSize: 18, textAlign: 'center', margin: '0 0 4px' }}>
              Login Required
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 20px' }}>
              {twoFactorPending
                ? 'Enter the 6-digit code from your Authenticator app to log in and authorise this update.'
                : 'Login to update this asset'}
            </p>

            <form onSubmit={twoFactorPending ? handleVerify2FA : handleLogin}
              style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {!twoFactorPending ? (
                <>
                  <input style={S.loginInput} type="text" placeholder="Username or Email"
                    value={loginForm.identifier}
                    onChange={e => setLoginForm(f => ({ ...f, identifier: e.target.value }))}
                    autoComplete="username" required />
                  <input style={S.loginInput} type="password" placeholder="Password"
                    value={loginForm.password}
                    onChange={e => setLoginForm(f => ({ ...f, password: e.target.value }))}
                    autoComplete="current-password" required />
                </>
              ) : (
                <input
                  style={{
                    ...S.loginInput,
                    textAlign: 'center',
                    fontSize: 26,
                    fontWeight: 700,
                    letterSpacing: 10,
                    padding: '14px 10px',
                  }}
                  type="text"
                  inputMode="numeric"
                  pattern="\d{6}"
                  maxLength={6}
                  placeholder="000000"
                  value={twoFactorCode}
                  onChange={e => {
                    setLoginError('');
                    setTwoFactorCode(e.target.value.replace(/\D/g, '').slice(0, 6));
                  }}
                  autoComplete="one-time-code"
                  autoFocus
                />
              )}

              {loginError && (
                <p style={{ color: '#f87171', fontSize: 13, margin: 0 }}>{loginError}</p>
              )}

              <button type="submit" style={S.submitBtn} disabled={loginLoading}>
                {loginLoading
                  ? (twoFactorPending ? 'Verifying…' : 'Logging in…')
                  : (twoFactorPending ? 'Verify & Authorise Update' : 'Login')}
              </button>

              {twoFactorPending && (
                <button type="button"
                  onClick={() => { setTwoFactorPending(false); setTwoFactorCode(''); setLoginError(''); }}
                  style={{ background: 'none', border: 'none', color: '#94a3b8', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                  ← Back
                </button>
              )}
              <button type="button"
                onClick={() => { setShowLoginGate(false); setTwoFactorPending(false); setTwoFactorCode(''); setLoginError(''); }}
                style={{ background: 'none', border: 'none', color: '#64748b', fontSize: 13, cursor: 'pointer', textAlign: 'center' }}>
                Cancel
              </button>
            </form>
          </div>
        </div>
      )}

      {/* ── AUTHENTICATOR VERIFICATION MODAL (already-logged-in path only) ── */}
      {showTotpModal && (
        <div style={S.overlay}>
          <div style={S.loginCard}>
            <div style={{ textAlign: 'center', marginBottom: 12 }}>
              <span style={{ fontSize: 40, lineHeight: 1 }}>🔐</span>
            </div>
            <h2 style={{ color: '#f1f5f9', fontSize: 18, textAlign: 'center', margin: '0 0 6px' }}>
              Authenticator Verification
            </h2>
            <p style={{ color: '#64748b', fontSize: 13, textAlign: 'center', margin: '0 0 20px', lineHeight: 1.5 }}>
              Enter the 6-digit code from your Authenticator app to authorise this update.
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
                style={{ ...S.submitBtn, background: totpLoading ? '#16a34a' : '#22c55e', opacity: totpLoading ? 0.8 : 1 }}
                disabled={totpLoading}
              >
                {totpLoading ? 'Verifying…' : 'Verify'}
              </button>

              <button type="button" onClick={handleTotpCancel}
                style={{ background: 'none', border: '1px solid #334155', borderRadius: 10, color: '#94a3b8', fontSize: 14, padding: '12px', cursor: 'pointer', width: '100%' }}>
                Cancel
              </button>
            </form>

            <p style={{ color: '#475569', fontSize: 12, textAlign: 'center', marginTop: 14, lineHeight: 1.5 }}>
              Open Google Authenticator or Microsoft Authenticator and enter the current code for{' '}
              <strong style={{ color: '#64748b' }}>AssetTrack</strong>.
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

          {submitError && (
            <p style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>{submitError}</p>
          )}

          <button style={S.submitBtn} onClick={handleSubmit} disabled={submitting}>
            {submitting ? 'Submitting…' : 'Submit Update'}
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
                    : asset.category === 'Vehicles'   ? '🚗'
                    : asset.category === 'Furniture'  ? '🪑'
                    : asset.category === 'Machinery'  ? '⚙️' : '📦'}
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
              { label: 'Last Updated', value: asset.lastUpdated
                  ? new Date(asset.lastUpdated).toLocaleString('en-IN', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
                  : '—' },
              { label: 'Updated By',   value: asset.updatedBy || '—' },
            ].map(({ label, value }) => (
              <div key={label} style={S.detailRow}>
                <span style={S.detailLabel}>{label}</span>
                <span style={S.detailValue}>{value}</span>
              </div>
            ))}
            {asset.latitude && asset.longitude && (
              <div style={{ ...S.detailRow, flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
                <span style={S.detailLabel}>Last Location</span>
                <span style={{ color: '#4ade80', fontSize: 13 }}>
                  📍 {Number(asset.latitude).toFixed(4)}, {Number(asset.longitude).toFixed(4)}
                </span>
                {asset.location && (
                  <span style={{ color: '#94a3b8', fontSize: 12 }}>{asset.location}</span>
                )}
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
                        {h.location && (
                          <p style={{ color: '#94a3b8', fontSize: 12, margin: '2px 0 0' }}>{h.location}</p>
                        )}
                        {h.remarks && (
                          <p style={{ color: '#64748b', fontSize: 12, margin: '2px 0 0', fontStyle: 'italic' }}>"{h.remarks}"</p>
                        )}
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

// ── Styles ────────────────────────────────────────────────────────────────────

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
    width: 36, height: 36,
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
  topTitle:  { color: '#f1f5f9', fontSize: 17, fontWeight: 600 },
  backBtn: {
    background: 'none', border: 'none', color: '#94a3b8',
    fontSize: 22, cursor: 'pointer', padding: '0 8px', width: 32,
  },
  scrollBody: {
    flex: 1, padding: '20px 16px 40px',
    display: 'flex', flexDirection: 'column', gap: 12,
    maxWidth: 520, width: '100%', alignSelf: 'center',
  },
  field:    { display: 'flex', flexDirection: 'column', gap: 6 },
  label:    { color: '#94a3b8', fontSize: 13, fontWeight: 500 },
  input: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 10, color: '#f1f5f9', fontSize: 15,
    padding: '12px 14px', outline: 'none',
  },
  select: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 10, color: '#f1f5f9', fontSize: 15,
    padding: '12px 14px', outline: 'none',
    width: '100%', appearance: 'auto',
  },
  textarea: {
    background: '#1e293b', border: '1px solid #334155',
    borderRadius: 10, color: '#f1f5f9', fontSize: 14,
    padding: '12px 14px', outline: 'none',
    resize: 'vertical', fontFamily: 'inherit',
  },
  loginCard: {
    background: '#1e293b', borderRadius: 16, padding: '32px 24px',
    width: '100%', maxWidth: 360, border: '1px solid #334155',
  },
  overlay: {
    position: 'fixed', top: 0, left: 0, right: 0, bottom: 0,
    background: 'rgba(0,0,0,0.75)',
    display: 'flex', alignItems: 'center', justifyContent: 'center',
    padding: 24, zIndex: 100,
  },
  loginInput: {
    background: '#0f172a', border: '1px solid #334155',
    borderRadius: 10, color: '#f1f5f9', fontSize: 15,
    padding: '12px 14px', outline: 'none',
    width: '100%', boxSizing: 'border-box',
  },
  submitBtn: {
    background: '#22c55e', color: '#fff', border: 'none',
    borderRadius: 12, padding: '16px', fontSize: 16,
    fontWeight: 700, cursor: 'pointer', width: '100%', marginTop: 8,
  },
  viewDetailsBtn: {
    background: 'transparent', color: '#94a3b8',
    border: '1px solid #334155', borderRadius: 12,
    padding: '14px', fontSize: 15, fontWeight: 500,
    cursor: 'pointer', width: '100%',
  },
  detailCard: {
    background: '#1e293b', borderRadius: 14,
    padding: '16px', border: '1px solid #334155',
  },
  assetIcon: {
    width: 56, height: 56, borderRadius: 14, background: '#0f172a',
    display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  statusBadge: {
    display: 'inline-block', padding: '3px 12px',
    borderRadius: 20, fontSize: 12, fontWeight: 600, border: '1px solid',
  },
  detailRow: {
    display: 'flex', justifyContent: 'space-between', alignItems: 'center',
    padding: '9px 0', borderBottom: '1px solid #0f172a',
  },
  detailLabel: { color: '#64748b', fontSize: 13 },
  detailValue: { color: '#e2e8f0', fontSize: 13, fontWeight: 500, textAlign: 'right', maxWidth: '60%' },
  historyRow:  { display: 'flex', gap: 12, alignItems: 'flex-start' },
  historyDot:  { width: 12, height: 12, borderRadius: '50%', flexShrink: 0, marginTop: 3 },
  historyLine: { width: 2, flex: 1, background: '#334155', marginTop: 2, minHeight: 20 },
};
