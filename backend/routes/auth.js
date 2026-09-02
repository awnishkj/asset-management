const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const QRCode = require('qrcode');

// ── otplib v13 — synchronous TOTP helpers ────────────────────────────────
// Confirmed working API from package inspection:
//   generateSecret()                            → Base32 secret string
//   generateSync({ type:'totp', secret })       → 6-digit code string
//   verifySync({ type:'totp', token, secret })  → { valid, delta, epoch, timeStep }
//   generateURI({ type, label, secret, issuer }) → otpauth:// URI string

const {
  generateSecret,
  generateSync,
  verifySync,
  generateURI,
} = require('otplib');

/**
 * Generate a new Base32 TOTP secret.
 */
function totpGenerateSecret() {
  return generateSecret();
}

/**
 * Build an otpauth:// URI compatible with Google/Microsoft Authenticator.
 * label format: "AssetTrack:user@email.com"
 */
function totpGenerateUri(email, secret) {
  return generateURI({
    type: 'totp',
    label: `AssetTrack:${email}`,
    secret,
    issuer: 'AssetTrack',
  });
}

/**
 * Verify a TOTP code against a secret.
 * Returns true if valid, false otherwise.
 */
function totpVerify(token, secret) {
  try {
    const result = verifySync({ type: 'totp', token: String(token), secret });
    return result && result.valid === true;
  } catch (err) {
    console.error('[totp] verifySync error:', err.message);
    return false;
  }
}

// ─── Register ─────────────────────────────────────────────────────────────
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;

    const existing = await User.findOne({ email });
    if (existing) return res.status(400).json({ message: 'User already exists' });

    const hashedPassword = await bcrypt.hash(password, await bcrypt.genSalt(10));

    // New users start with twoFactorEnabled=false and no TOTP secret
    const user = new User({
      username,
      email,
      password: hashedPassword,
      twoFactorEnabled: false,
    });
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

    // ── FIRST LOGIN: no twoFactorSecret yet ──────────────────────────────────
    // Generate TOTP secret, return QR code. No JWT issued until TOTP verified.
    if (!user.twoFactorEnabled && !user.twoFactorSecret) {
      const secret = totpGenerateSecret();
      user.twoFactorPendingSecret = secret;
      await user.save();

      const otpauthUri = totpGenerateUri(user.email, secret);
      let qrCode;
      try {
        qrCode = await QRCode.toDataURL(otpauthUri);
      } catch (err) {
        console.error('[auth] QR code generation failed:', err.message);
        return res.status(500).json({ message: 'Failed to generate QR code' });
      }

      const twoFactorToken = jwt.sign(
        { userId: user._id.toString(), twoFactor: true, setup: true, rememberMe: !!rememberMe },
        process.env.JWT_SECRET || 'secret',
        { expiresIn: '10m' }
      );

      console.log('[auth] First login — TOTP setup initiated for userId:', user._id.toString());

      return res.json({
        twoFactor: true,
        setup: true,
        twoFactorToken,
        qrCode,            // base64 PNG — shown once only
        manualKey: secret, // manual entry key — shown once only
        message: 'Scan the QR code with your Authenticator app, then enter the 6-digit code.',
      });
    }

    // ── SUBSEQUENT LOGINS: twoFactorEnabled=true ─────────────────────────────
    // No email. Return temporary token — /verify-2fa checks the Authenticator code.
    const twoFactorToken = jwt.sign(
      { userId: user._id.toString(), twoFactor: true, setup: false, rememberMe: !!rememberMe },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '10m' }
    );
    console.log('[auth] 2FA required — TOTP verify needed for userId:', user._id.toString());

    return res.json({
      twoFactor: true,
      setup: false,
      twoFactorToken,
      message: 'Enter the 6-digit code from your Authenticator app.',
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ─── Verify 2FA (TOTP) ────────────────────────────────────────────────────
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

    if (payload.setup) {
      // Setup: verify against twoFactorPendingSecret, then promote it
      if (!user.twoFactorPendingSecret) {
        return res.status(400).json({ message: 'No setup in progress. Please log in again.' });
      }
      if (!totpVerify(code, user.twoFactorPendingSecret)) {
        return res.status(400).json({ message: 'Invalid code. Make sure your Authenticator app is synced.' });
      }

      user.twoFactorSecret = user.twoFactorPendingSecret;
      user.twoFactorPendingSecret = undefined;
      user.twoFactorEnabled = true;
      await user.save();
      console.log('[auth] TOTP setup complete — 2FA enabled for userId:', user._id.toString());

    } else {
      // Regular login: verify against permanent twoFactorSecret
      if (!user.twoFactorSecret) {
        return res.status(400).json({ message: 'Authenticator not configured. Please contact support.' });
      }
      if (!totpVerify(code, user.twoFactorSecret)) {
        return res.status(400).json({ message: 'Invalid code. Check your Authenticator app.' });
      }
    }

    const authToken = jwt.sign(
      { userId: user._id },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: payload.rememberMe ? '30d' : '7d' }
    );

    // Never expose TOTP secrets in the response
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

// ─── Resend 2FA — not applicable for Authenticator TOTP ──────────────────
router.post('/resend-2fa', (req, res) => {
  res.status(400).json({
    message: 'Authenticator codes are generated by your Authenticator app and cannot be resent. Open Google Authenticator or Microsoft Authenticator to get your current code.',
  });
});

// ─── QR Login — requires password + Authenticator TOTP, no bypass ────────
router.post('/qr-login', async (req, res) => {
  try {
    const { identifier, password, totpCode } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }],
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Authenticator not set up. Please log in from the main login page first.' });
    }
    if (!totpCode) {
      return res.status(400).json({ message: 'Authenticator code is required.' });
    }
    if (!totpVerify(totpCode, user.twoFactorSecret)) {
      return res.status(400).json({ message: 'Invalid Authenticator code.' });
    }

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

// ─── Forgot Password — Step 1: verify account exists ─────────────────────
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ message: 'Email is required' });

    const user = await User.findOne({ email });
    if (!user || !user.twoFactorEnabled || !user.twoFactorSecret) {
      // Avoid user enumeration — always return success-like message
      return res.json({ message: 'If this account exists and has Authenticator set up, you may proceed to verification.' });
    }

    const resetStepToken = jwt.sign(
      { userId: user._id.toString(), resetStep: 'totp', purpose: 'password-reset' },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '10m' }
    );

    res.json({
      message: 'Account found. Enter the 6-digit code from your Authenticator app.',
      resetStepToken,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to process request' });
  }
});

// ─── Forgot Password — Step 2: verify TOTP → issue password-reset token ──
router.post('/forgot-password/verify-totp', async (req, res) => {
  try {
    const { resetStepToken, totpCode } = req.body;
    if (!resetStepToken || !totpCode) {
      return res.status(400).json({ message: 'Token and Authenticator code are required' });
    }

    let payload;
    try {
      payload = jwt.verify(resetStepToken, process.env.JWT_SECRET || 'secret');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired token. Please start again.' });
    }

    if (payload.resetStep !== 'totp' || payload.purpose !== 'password-reset') {
      return res.status(400).json({ message: 'Invalid token type.' });
    }

    const user = await User.findById(payload.userId);
    if (!user || !user.twoFactorSecret) {
      return res.status(404).json({ message: 'User not found or Authenticator not configured.' });
    }

    if (!totpVerify(totpCode, user.twoFactorSecret)) {
      return res.status(400).json({ message: 'Invalid Authenticator code.' });
    }

    const passwordResetToken = jwt.sign(
      { userId: user._id.toString(), purpose: 'password-reset', verified: true },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '10m' }
    );

    res.json({
      message: 'Authenticator verified. You may now reset your password.',
      passwordResetToken,
    });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Verification failed' });
  }
});

// ─── Reset Password — Step 3: apply new password ─────────────────────────
router.post('/reset-password', async (req, res) => {
  try {
    const { passwordResetToken, newPassword } = req.body;
    if (!passwordResetToken || !newPassword) {
      return res.status(400).json({ message: 'Reset token and new password are required' });
    }

    let payload;
    try {
      payload = jwt.verify(passwordResetToken, process.env.JWT_SECRET || 'secret');
    } catch (err) {
      return res.status(401).json({ message: 'Invalid or expired reset token. Please start again.' });
    }

    if (payload.purpose !== 'password-reset' || !payload.verified) {
      return res.status(400).json({ message: 'Invalid reset token.' });
    }

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.password = await bcrypt.hash(newPassword, 10);
    user.twoFactorCode = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Reset failed' });
  }
});

module.exports = router;
