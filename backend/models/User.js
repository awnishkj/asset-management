const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: true,
    unique: true
  },
  email: {
    type: String,
    required: true,
    unique: true
  },
  password: {
    type: String,
    required: true
  },
  phone: { type: String },
  location: { type: String },
  profilePic: { type: String },
  joinedAt: { type: Date, default: Date.now },
  empId: { type: String },
  twoFactorEnabled: { type: Boolean, default: false },
  twoFactorSecret: { type: String },           // permanent TOTP secret (after setup)
  twoFactorPendingSecret: { type: String },     // temporary secret during first-login setup
  notificationPrefs: { type: Object, default: {} },
  role: {
    type: String,
    enum: ['admin', 'manager', 'user'],
    default: 'user'
  },
  twoFactorCode: { type: String },
  twoFactorExpires: { type: Date },
  rememberMe: {
    type: Boolean,
    default: false
  },
  createdAt: {
    type: Date,
    default: Date.now
  }
});

module.exports = mongoose.model('User', userSchema);
