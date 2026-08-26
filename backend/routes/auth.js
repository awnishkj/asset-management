const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const { sendEmail } = require('../services/email');

// ─── Register ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

    const user = new User({ username, email, password: hashedPassword });
    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    });

    res.status(201).json({
      message: 'User registered successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Login ────────────────────────────────────────────────────────────────
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) return res.status(400).json({ message: 'Invalid credentials' });

    // DEV BYPASS: skip 2FA when SKIP_2FA=true in development
    if (process.env.NODE_ENV !== 'production' && process.env.SKIP_2FA === 'true') {
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: rememberMe ? '30d' : '7d',
      });
      console.log('[auth] DEV: 2FA skipped for user:', user.email);
      return res.json({
        message: 'Login successful',
        token,
        user: { id: user._id, username: user.username, email: user.email, role: user.role },
      });
    }

    // ── FIRST LOGIN: twoFactorEnabled is false in the database ──────────────
    // No OTP generated, no email sent.
    // Issue JWT immediately, then flip twoFactorEnabled → true for all future logins.
    if (!user.twoFactorEnabled) {
      user.twoFactorEnabled = true;
      await user.save();

      const token = jwt.sign(
        { userId: user._id },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: rememberMe ? '30d' : '7d' }
      );
      console.log('[auth] First login — 2FA enabled for future logins. userId:', user._id.toString());
      return res.json({
        message: 'Login successful',
        token,
        user: { id: user._id, username: user.username, email: user.email, role: user.role },
      });
    }

    // ── SUBSEQUENT LOGINS: twoFactorEnabled is true → require OTP ───────────
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFactorCode = code;
    user.twoFactorExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: 'Your AssetTrack login verification code',
        text: `Your login verification code is: ${code}\n\nThis code expires in 10 minutes.\n\nIf you did not request this, please ignore this email.`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px">
            <h2 style="color:#1e293b;margin-bottom:8px">AssetTrack Login</h2>
            <p style="color:#475569">Your verification code is:</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#3b82f6;padding:16px 0">${code}</div>
            <p style="color:#94a3b8;font-size:13px">Expires in 10 minutes. If you didn't request this, ignore this email.</p>
          </div>`,
      });
    } catch (err) {
      console.error('[auth] Failed to send 2FA email during login:', err.message);
      return res.status(500).json({ message: 'Failed to send verification email. Please try again.' });
    }

    const twoFactorToken = jwt.sign(
      { userId: user._id.toString(), twoFactor: true, rememberMe: !!rememberMe },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '10m' }
    );
    console.log('[auth] 2FA token issued — userId:', user._id.toString());

    return res.json({
      message: '2FA required',
      twoFactor: true,
      twoFactorToken,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Verify 2FA ───────────────────────────────────────────────────────────
router.post('/verify-2fa', async (req, res) => {
  try {
    const token =
      req.headers.authorization?.split(' ')[1] ||
      req.body.twoFactorToken ||
      req.query.twoFactorToken;

    const { code } = req.body;

    if (!token) {
      console.error('[auth] verify-2fa: missing token');
      return res.status(400).json({ message: 'Missing twoFactorToken' });
    }
    if (!code) return res.status(400).json({ message: 'Code is required' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch (err) {
      console.error('[auth] verify-2fa: invalid JWT —', err.message);
      return res.status(401).json({ message: 'Invalid or expired twoFactorToken' });
    }

    if (!payload.twoFactor || !payload.userId) {
      console.error('[auth] verify-2fa: bad payload');
      return res.status(400).json({ message: 'Session expired. Please log in again.' });
    }

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorCode || !user.twoFactorExpires)
      return res.status(400).json({ message: 'No code pending' });
    if (new Date() > new Date(user.twoFactorExpires))
      return res.status(400).json({ message: 'Code expired' });
    if (user.twoFactorCode !== String(code))
      return res.status(400).json({ message: 'Invalid code' });

    // twoFactorEnabled is already true — just clear the pending code
    user.twoFactorCode = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    const authToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: payload.rememberMe ? '30d' : '7d' }
    );

    res.json({
      message: 'Login successful',
      token: authToken,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    console.error('[auth] POST /verify-2fa failed:', error);
    res.status(500).json({ message: error.message || 'Verification failed' });
  }
});

// ─── Resend 2FA ───────────────────────────────────────────────────────────
router.post('/resend-2fa', async (req, res) => {
  try {
    const token =
      req.headers.authorization?.split(' ')[1] ||
      req.body.twoFactorToken ||
      req.query.twoFactorToken;

    if (!token) {
      console.error('[auth] resend-2fa: missing token');
      return res.status(400).json({ message: 'Missing twoFactorToken' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch (err) {
      console.error('[auth] resend-2fa: invalid JWT');
      return res.status(401).json({ message: 'Invalid or expired twoFactorToken' });
    }
    if (!payload.twoFactor || !payload.userId)
      return res.status(400).json({ message: 'Invalid two factor token' });

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFactorCode = code;
    user.twoFactorExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const newTwoFactorToken = jwt.sign(
      { userId: user._id, twoFactor: true, rememberMe: !!payload.rememberMe },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '10m' }
    );

    try {
      await sendEmail({
        to: user.email,
        subject: 'Your new AssetTrack verification code',
        text: `Your new login verification code is: ${code}\n\nThis code expires in 10 minutes.`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px">
            <h2 style="color:#1e293b;margin-bottom:8px">New Verification Code</h2>
            <p style="color:#475569">Your new verification code is:</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#3b82f6;padding:16px 0">${code}</div>
            <p style="color:#94a3b8;font-size:13px">Expires in 10 minutes.</p>
          </div>`,
      });
    } catch (err) {
      console.error('[auth] Failed to send 2FA email during resend:', err.message);
      return res.status(500).json({ message: 'Failed to resend verification email. Please try again.' });
    }

    res.json({ message: 'Verification code resent', twoFactorToken: newTwoFactorToken });
  } catch (error) {
    console.error('[auth] POST /resend-2fa failed:', error);
    res.status(500).json({ message: error.message || 'Resend failed' });
  }
});

// ─── QR Login (no 2FA) ────────────────────────────────────────────────────
router.post('/qr-login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d',
    });
    res.json({
      token,
      user: { id: user._id, username: user.username, email: user.email, role: user.role },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Forgot Password ──────────────────────────────────────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with that email' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFactorCode = code;
    user.twoFactorExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    try {
      await sendEmail({
        to: user.email,
        subject: 'AssetTrack Password Reset Code',
        text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`,
        html: `
          <div style="font-family:sans-serif;max-width:480px;margin:auto;padding:32px;background:#f8fafc;border-radius:12px">
            <h2 style="color:#1e293b;margin-bottom:8px">Password Reset</h2>
            <p style="color:#475569">Your reset code is:</p>
            <div style="font-size:36px;font-weight:700;letter-spacing:8px;color:#ef4444;padding:16px 0">${code}</div>
            <p style="color:#94a3b8;font-size:13px">Expires in 15 minutes. If you didn't request this, ignore this email.</p>
          </div>`,
      });
    } catch (err) {
      console.error('[auth] Failed to send password reset email:', err.message);
      return res.status(500).json({ message: 'Failed to send reset email. Please try again.' });
    }

    res.json({ message: 'Reset code sent to your email' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to send reset email' });
  }
});

// ─── Reset Password ───────────────────────────────────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword)
      return res.status(400).json({ message: 'All fields required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorCode || user.twoFactorCode !== code)
      return res.status(400).json({ message: 'Invalid or expired code' });
    if (user.twoFactorExpires < new Date())
      return res.status(400).json({ message: 'Code has expired' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.twoFactorCode = null;
    user.twoFactorExpires = null;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Reset failed' });
  }
});

module.exports = router;
