const express = require('express');
const router = express.Router();
const User = require('../models/User');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const nodemailer = require('nodemailer');

const createEmailTransporter = async () => {
  if (process.env.SMTP_HOST && process.env.SMTP_USER && process.env.SMTP_PASS) {
    return nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: parseInt(process.env.SMTP_PORT || '587', 10),
      secure: process.env.SMTP_SECURE === 'true',
      auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS }
    });
  }

  if (process.env.NODE_ENV === 'production') {
    throw new Error('SMTP is not configured. Set SMTP_HOST, SMTP_PORT, SMTP_USER, and SMTP_PASS for email delivery.');
  }

  const testAccount = await nodemailer.createTestAccount();
  return nodemailer.createTransport({
    host: testAccount.smtp.host,
    port: testAccount.smtp.port,
    secure: testAccount.smtp.secure,
    auth: { user: testAccount.user, pass: testAccount.pass }
  });
};

// Register
router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    let user = await User.findOne({ email });
    if (user) {
      return res.status(400).json({ message: 'User already exists' });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    user = new User({
      username,
      email,
      password: hashedPassword
    });

    await user.save();

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
      expiresIn: '7d'
    });

    res.status(201).json({ 
      message: 'User registered successfully',
      token,
      user: { id: user._id, username: user.username, email: user.email }
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Login
router.post('/login', async (req, res) => {
  try {
    const { identifier, password, rememberMe } = req.body;

    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });
    if (!user) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    const isPasswordMatch = await bcrypt.compare(password, user.password);
    if (!isPasswordMatch) {
      return res.status(400).json({ message: 'Invalid credentials' });
    }

    // DEV BYPASS: skip 2FA in development mode when SKIP_2FA=true
    if (process.env.NODE_ENV !== 'production' && process.env.SKIP_2FA === 'true') {
      const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', {
        expiresIn: rememberMe ? '30d' : '7d'
      });
      console.log('DEV: 2FA skipped for user:', user.email);
      return res.json({ message: 'Login successful', token, user: { id: user._id, username: user.username, email: user.email, role: user.role } });
    }

    // Mandatory 2FA: generate a short-lived twoFactorToken and send code via email
    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFactorCode = code;
    user.twoFactorExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    try {
      const transporter = await createEmailTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com',
        to: user.email,
        subject: 'Your login verification code',
        text: `Your login verification code is: ${code}. It expires in 10 minutes.`
      });
    } catch (err) {
      console.error('Failed to send 2FA email during login:', err);
      return res.status(500).json({ message: err.message.includes('SMTP is not configured') ? err.message : 'Failed to send verification email' });
    }

    const setup = !user.twoFactorEnabled;
    const jwtSecret = process.env.JWT_SECRET || 'secret';
    const twoFactorToken = jwt.sign(
      { userId: user._id.toString(), twoFactor: true, rememberMe: !!rememberMe, setup },
      jwtSecret,
      { expiresIn: '10m' }
    );
    console.log('2FA token issued for user:', user._id.toString(), '| twoFactor: true | setup:', setup);
    return res.json({
      message: setup ? '2FA setup required' : '2FA required',
      twoFactor: true,
      twoFactorToken,
      setup
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Verify 2FA token and code, then issue the real auth token
router.post('/verify-2fa', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.body.twoFactorToken || req.query.twoFactorToken;
    const { code } = req.body;
    if (!token) {
      console.error('verify-2fa missing token', {
        authHeader: req.headers.authorization,
        bodyToken: req.body.twoFactorToken,
        queryToken: req.query.twoFactorToken,
        code
      });
      return res.status(400).json({ message: 'Missing twoFactorToken' });
    }
    if (!code) return res.status(400).json({ message: 'Code is required' });

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      console.log('verify-2fa payload:', payload);
    } catch (err) {
      console.error('verify-2fa invalid JWT:', err.message, '| token prefix:', token.slice(0, 20) + '...');
      return res.status(401).json({ message: 'Invalid or expired twoFactorToken' });
    }
    if (!payload.twoFactor || !payload.userId) {
      console.error('verify-2fa bad payload — twoFactor:', payload.twoFactor, '| userId:', payload.userId);
      return res.status(400).json({ message: 'Session expired. Please log in again.' });
    }

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorCode || !user.twoFactorExpires) return res.status(400).json({ message: 'No code pending' });
    if (new Date() > new Date(user.twoFactorExpires)) return res.status(400).json({ message: 'Code expired' });
    if (user.twoFactorCode !== String(code)) return res.status(400).json({ message: 'Invalid code' });

    if (payload.setup) {
      user.twoFactorEnabled = true;
    }

    user.twoFactorCode = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    const remember = payload.rememberMe ? true : false;
    const authToken = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: remember ? '30d' : '7d' });

    res.json({ message: 'Login successful', token: authToken, user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    console.error('POST /api/auth/verify-2fa failed:', error);
    res.status(500).json({ message: error.message || 'Verification failed' });
  }
});

// Resend 2FA code using an existing twoFactorToken
router.post('/resend-2fa', async (req, res) => {
  try {
    const token = req.headers.authorization?.split(' ')[1] || req.body.twoFactorToken || req.query.twoFactorToken;
    if (!token) {
      console.error('resend-2fa missing token', {
        authHeader: req.headers.authorization,
        bodyToken: req.body.twoFactorToken,
        queryToken: req.query.twoFactorToken
      });
      return res.status(400).json({ message: 'Missing twoFactorToken' });
    }

    let payload;
    try {
      payload = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    } catch (err) {
      console.error('resend-2fa invalid JWT', { token: token.slice(0, 10) + '...' });
      return res.status(401).json({ message: 'Invalid or expired twoFactorToken' });
    }
    if (!payload.twoFactor || !payload.userId) return res.status(400).json({ message: 'Invalid two factor token' });

    const user = await User.findById(payload.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFactorCode = code;
    user.twoFactorExpires = new Date(Date.now() + 10 * 60 * 1000);
    await user.save();

    const twoFactorToken = jwt.sign({ userId: user._id, twoFactor: true, rememberMe: payload.rememberMe ? true : false, setup: !user.twoFactorEnabled }, process.env.JWT_SECRET || 'secret', { expiresIn: '10m' });

    try {
      const transporter = await createEmailTransporter();
      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER || 'no-reply@example.com',
        to: user.email,
        subject: 'Your new login verification code',
        text: `Your new login verification code is: ${code}. It expires in 10 minutes.`
      });
    } catch (err) {
      console.error('Failed to send 2FA email during resend:', err);
      return res.status(500).json({ message: err.message.includes('SMTP is not configured') ? err.message : 'Failed to send verification email' });
    }
    res.json({ message: 'Verification code resent', twoFactorToken });
  } catch (error) {
    console.error('POST /api/auth/resend-2fa failed:', error);
    res.status(500).json({ message: error.message || 'Resend failed' });
  }
});

// Quick login for phone QR scan — password only, no 2FA
router.post('/qr-login', async (req, res) => {
  try {
    const { identifier, password } = req.body;
    const user = await User.findOne({
      $or: [{ email: identifier }, { username: identifier }]
    });
    if (!user) return res.status(400).json({ message: 'Invalid credentials' });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) return res.status(400).json({ message: 'Invalid credentials' });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET || 'secret', { expiresIn: '7d' });
    res.json({ token, user: { id: user._id, username: user.username, email: user.email, role: user.role } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Forgot password — send reset code to email
router.post('/forgot-password', async (req, res) => {
  try {
    const { email } = req.body;
    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'No account found with that email' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    user.twoFactorCode = code;
    user.twoFactorExpires = new Date(Date.now() + 15 * 60 * 1000);
    await user.save();

    const transporter = await createEmailTransporter();
    await transporter.sendMail({
      from: process.env.SMTP_FROM || process.env.SMTP_USER,
      to: user.email,
      subject: 'Password Reset Code — AssetTrack',
      text: `Your password reset code is: ${code}\n\nThis code expires in 15 minutes.\n\nIf you did not request this, ignore this email.`
    });

    res.json({ message: 'Reset code sent to your email' });
  } catch (err) {
    res.status(500).json({ message: err.message || 'Failed to send reset email' });
  }
});

// Reset password — verify code and set new password
router.post('/reset-password', async (req, res) => {
  try {
    const { email, code, newPassword } = req.body;
    if (!email || !code || !newPassword) return res.status(400).json({ message: 'All fields required' });

    const user = await User.findOne({ email });
    if (!user) return res.status(404).json({ message: 'User not found' });
    if (!user.twoFactorCode || user.twoFactorCode !== code) return res.status(400).json({ message: 'Invalid or expired code' });
    if (user.twoFactorExpires < new Date()) return res.status(400).json({ message: 'Code has expired' });

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
