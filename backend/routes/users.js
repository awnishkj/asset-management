const express = require('express');
const router = express.Router();
const User = require('../models/User');
const auth = require('../middleware/auth');
const multer = require('multer');
const nodemailer = require('nodemailer');

const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } }); // 5MB limit

// Get all users
router.get('/', auth, async (req, res) => {
  try {
    const users = await User.find().select('-password');
    res.json(users);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get current user
router.get('/me', auth, async (req, res) => {
  try {
    res.json(req.currentUser);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get user by ID
router.get('/:id', auth, async (req, res) => {
  try {
    const user = await User.findById(req.params.id).select('-password');
    if (!user) {
      return res.status(404).json({ message: 'User not found' });
    }
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Update current user profile
router.put('/me', auth, async (req, res) => {
  try {
    const allowedFields = ['username', 'email', 'phone', 'location', 'profilePic', 'empId', 'twoFactorEnabled', 'notificationPrefs'];
    const update = {};

    for (const key of allowedFields) {
      if (Object.prototype.hasOwnProperty.call(req.body, key)) {
        update[key] = req.body[key];
      }
    }

    if (Object.keys(update).length === 0) {
      return res.status(400).json({ message: 'No valid profile fields supplied' });
    }

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    Object.assign(user, update);
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (error) {
    console.error('PUT /api/users/me failed:', error);
    if (error.code === 11000) {
      const field = Object.keys(error.keyValue || {}).join(', ') || 'field';
      return res.status(400).json({ message: `Duplicate ${field} already exists` });
    }
    res.status(500).json({ message: error.message || 'Something went wrong!' });
  }
});

// Upload avatar (multipart/form-data)
router.post('/me/avatar', auth, upload.single('avatar'), async (req, res) => {
  try {
    if (!req.file) return res.status(400).json({ message: 'No file uploaded' });

    const mime = req.file.mimetype || 'application/octet-stream';
    const base64 = req.file.buffer.toString('base64');
    const dataUrl = `data:${mime};base64,${base64}`;

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    user.profilePic = dataUrl;
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    res.json(userObj);
  } catch (error) {
    console.error('POST /api/users/me/avatar failed:', error);
    res.status(500).json({ message: error.message || 'Upload failed' });
  }
});

// Send 2FA code to user's email
router.post('/me/2fa/send', auth, async (req, res) => {
  try {
    const { type, newEmail } = req.body || {};
    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const expires = new Date(Date.now() + 10 * 60 * 1000); // 10 minutes

    user.twoFactorCode = code;
    user.twoFactorExpires = expires;
    await user.save();

    // Determine recipient — delete-user and add-user always go to admin email, email-change to new address
    const ADMIN_EMAIL = 'awnishkj2004@gmail.com';
    const recipient = (type === 'email-change' && newEmail)
      ? newEmail
      : (type === 'delete-user' || type === 'add-user')
        ? ADMIN_EMAIL
        : user.email;

    // Send email if SMTP configured
    if (process.env.SMTP_HOST && process.env.SMTP_USER) {
      const transporter = nodemailer.createTransport({
        host: process.env.SMTP_HOST,
        port: parseInt(process.env.SMTP_PORT || '587', 10),
        secure: process.env.SMTP_SECURE === 'true',
        auth: {
          user: process.env.SMTP_USER,
          pass: process.env.SMTP_PASS
        }
      });

      const subject = type === 'email-change'
        ? 'Verify your new email address'
        : 'Your verification code';
      const text = type === 'email-change'
        ? `Your email change verification code is: ${code}. It expires in 10 minutes.`
        : `Your verification code is: ${code}. It expires in 10 minutes.`;

      await transporter.sendMail({
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to: recipient,
        subject,
        text
      });
      return res.json({ message: 'Verification code sent' });
    }

    // Fallback: log code to server for development
    console.log(`2FA code for ${recipient}: ${code}`);
    res.json({ message: 'Verification code generated (check server logs in development)' });
  } catch (error) {
    console.error('POST /api/users/me/2fa/send failed:', error);
    res.status(500).json({ message: error.message || 'Failed to send code' });
  }
});

// Verify 2FA code
router.post('/me/2fa/verify', auth, async (req, res) => {
  try {
    const { code, type } = req.body || {};
    if (!code) return res.status(400).json({ message: 'Code is required' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    if (!user.twoFactorCode || !user.twoFactorExpires) return res.status(400).json({ message: 'No code pending' });
    if (new Date() > new Date(user.twoFactorExpires)) return res.status(400).json({ message: 'Code expired' });
    if (user.twoFactorCode !== String(code)) return res.status(400).json({ message: 'Invalid code' });

    // if enabling 2FA, set flag
    if (type === 'enable') {
      user.twoFactorEnabled = true;
    }

    // clear code
    user.twoFactorCode = undefined;
    user.twoFactorExpires = undefined;
    await user.save();

    const userObj = user.toObject();
    delete userObj.password;
    res.json({ message: 'Verified', user: userObj });
  } catch (error) {
    console.error('POST /api/users/me/2fa/verify failed:', error);
    res.status(500).json({ message: error.message || 'Verification failed' });
  }
});

// Change password
router.post('/me/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;
    if (!currentPassword || !newPassword) return res.status(400).json({ message: 'Missing passwords' });

    const user = await User.findById(req.userId);
    if (!user) return res.status(404).json({ message: 'User not found' });

    const bcrypt = require('bcryptjs');
    const match = await bcrypt.compare(currentPassword, user.password);
    if (!match) return res.status(400).json({ message: 'Current password is incorrect' });

    const salt = await bcrypt.genSalt(10);
    user.password = await bcrypt.hash(newPassword, salt);
    await user.save();

    res.json({ message: 'Password updated' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add user by admin (requires 2FA verification)
router.post('/admin/add-user', auth, async (req, res) => {
  try {
    const { username, email, password, role, code } = req.body;
    if (!username || !email || !password || !code) return res.status(400).json({ message: 'All fields and verification code are required' });

    // Verify admin's 2FA code
    const admin = await User.findById(req.userId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.twoFactorCode || !admin.twoFactorExpires) return res.status(400).json({ message: 'No code pending. Request a code first.' });
    if (new Date() > new Date(admin.twoFactorExpires)) return res.status(400).json({ message: 'Code expired' });
    if (admin.twoFactorCode !== String(code)) return res.status(400).json({ message: 'Invalid code' });

    // Clear code
    admin.twoFactorCode = undefined;
    admin.twoFactorExpires = undefined;
    await admin.save();

    // Check if user already exists
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) return res.status(400).json({ message: 'Username or email already exists' });

    const bcrypt = require('bcryptjs');
    const hashed = await bcrypt.hash(password, 10);
    const newUser = new User({ username, email, password: hashed, role: role || 'user' });
    await newUser.save();

    const userObj = newUser.toObject();
    delete userObj.password;
    res.status(201).json({ message: 'User created successfully', user: userObj });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Delete user by ID (admin only, requires 2FA verification code sent first)
router.delete('/:id', auth, async (req, res) => {
  try {
    const { code } = req.body;
    if (!code) return res.status(400).json({ message: '2FA code required' });

    // Verify code of the requesting user (admin)
    const admin = await User.findById(req.userId);
    if (!admin) return res.status(404).json({ message: 'Admin not found' });
    if (!admin.twoFactorCode || !admin.twoFactorExpires) return res.status(400).json({ message: 'No code pending. Request a code first.' });
    if (new Date() > new Date(admin.twoFactorExpires)) return res.status(400).json({ message: 'Code expired' });
    if (admin.twoFactorCode !== String(code)) return res.status(400).json({ message: 'Invalid code' });

    // Clear code
    admin.twoFactorCode = undefined;
    admin.twoFactorExpires = undefined;
    await admin.save();

    // Prevent self-deletion
    if (req.params.id === req.userId.toString()) return res.status(400).json({ message: 'Cannot delete your own account' });

    const deleted = await User.findByIdAndDelete(req.params.id);
    if (!deleted) return res.status(404).json({ message: 'User not found' });

    res.json({ message: 'User deleted successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
