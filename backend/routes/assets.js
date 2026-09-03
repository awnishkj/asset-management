const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const authMiddleware = require('../middleware/auth');

// ── otplib v13 — same import pattern as auth.js ──────────────────────────
const { verifySync } = require('otplib');

/**
 * Verify a TOTP token against a secret using the shared otplib v13 API.
 * Returns true if valid, false otherwise. Never logs the token.
 */
function totpVerify(token, secret) {
  try {
    const result = verifySync({ type: 'totp', token: String(token), secret });
    return result && result.valid === true;
  } catch (err) {
    console.error('[assets] totpVerify error:', err.message);
    return false;
  }
}

/**
 * Middleware: validate the X-Update-Token header for protected update routes.
 * Checks: JWT signature, purpose='asset-update', userId match (from JWT auth),
 * assetId match (URL param), and expiry (handled by jwt.verify).
 *
 * Attach to any route that requires a prior TOTP verification.
 * Requires authMiddleware to run first so req.userId is populated.
 */
function requireUpdateToken(req, res, next) {
  const updateToken = req.headers['x-update-token'];
  if (!updateToken) {
    return res.status(403).json({ message: 'Asset update requires Authenticator verification. Please verify first.' });
  }
  let payload;
  try {
    payload = jwt.verify(updateToken, process.env.JWT_SECRET || 'secret');
  } catch (err) {
    return res.status(403).json({ message: 'Update authorisation expired or invalid. Please verify again.' });
  }
  if (payload.purpose !== 'asset-update') {
    return res.status(403).json({ message: 'Invalid update token purpose.' });
  }
  // userId in token must match the authenticated user (req.userId set by authMiddleware)
  if (!req.userId || payload.userId !== req.userId) {
    return res.status(403).json({ message: 'Update token does not match authenticated user.' });
  }
  // assetId in token must match the URL param (supports both MongoDB _id and assetId string)
  const urlAssetId = decodeURIComponent(req.params.id || req.params.assetId || '');
  if (payload.assetId !== urlAssetId) {
    return res.status(403).json({ message: 'Update token is not valid for this asset.' });
  }
  next();
}

// Get all assets
router.get('/', async (req, res) => {
  try {
    const assets = await Asset.find();
    res.json(assets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Stats — MUST be before /:id
router.get('/stats/overview', async (req, res) => {
  try {
    const totalAssets = await Asset.countDocuments();
    const activeAssets = await Asset.countDocuments({ status: 'Active' });
    const maintenance = await Asset.countDocuments({ status: 'Maintenance' });
    const inactive = await Asset.countDocuments({ status: 'Inactive' });
    const damaged = await Asset.countDocuments({ status: 'Damaged' });
    const assetsByCategory = await Asset.aggregate([
      { $group: { _id: '$category', count: { $sum: 1 } } }
    ]);
    res.json({ totalAssets, activeAssets, maintenance, inactive, damaged, assetsByCategory });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public list of all assets — no auth needed, used by phone QR scan
router.get('/public-list', async (req, res) => {
  try {
    const assets = await Asset.find().select('assetId assetName category status location lastUpdated').sort({ lastUpdated: -1 });
    res.json(assets);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// ── TOTP Verification for asset update (authenticated users only) ─────────
// POST /api/assets/public/:assetId/verify-update
// Requires: Bearer JWT (logged-in user), body: { totpCode }
// Returns:  { updateToken } — short-lived JWT tied to userId + assetId
router.post('/public/:assetId/verify-update', authMiddleware, async (req, res) => {
  try {
    const { totpCode } = req.body;
    if (!totpCode || String(totpCode).trim() === '') {
      return res.status(400).json({ message: 'Authenticator code is required.' });
    }

    // Load the authenticated user's TOTP secret — never trust anything from the frontend
    const user = await User.findById(req.userId).select('twoFactorSecret twoFactorEnabled');
    if (!user) {
      return res.status(401).json({ message: 'User not found.' });
    }
    if (!user.twoFactorEnabled || !user.twoFactorSecret) {
      return res.status(400).json({ message: 'Authenticator app is not set up for your account. Please complete 2FA setup first.' });
    }

    // Verify TOTP — do NOT log the code
    const valid = totpVerify(String(totpCode).trim(), user.twoFactorSecret);
    if (!valid) {
      return res.status(400).json({ message: 'Invalid Authenticator code. Please try again.' });
    }

    const assetId = decodeURIComponent(req.params.assetId);

    // Issue a short-lived, asset-scoped update token (5 minutes)
    const updateToken = jwt.sign(
      {
        purpose:  'asset-update',
        userId:   req.userId,
        assetId:  assetId,
      },
      process.env.JWT_SECRET || 'secret',
      { expiresIn: '5m' }
    );

    console.log('[assets] TOTP update-verification granted for userId:', req.userId, 'assetId:', assetId);

    return res.json({ updateToken, message: 'Verification successful. You may now update the asset.' });
  } catch (err) {
    console.error('[assets] POST /public/:assetId/verify-update error:', err.message);
    res.status(500).json({ message: err.message || 'Verification failed.' });
  }
});

// Public lookup by assetId string — no auth needed, used by QR scan on phone
router.get('/public/:assetId', async (req, res) => {
  try {
    const assetId = decodeURIComponent(req.params.assetId);
    console.log('Public lookup assetId:', JSON.stringify(assetId));
    const asset = await Asset.findOne({ assetId }).select('-qrCode -__v');
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public update asset from mobile QR scan — requires login + TOTP update token
router.post('/public/:assetId/update', authMiddleware, requireUpdateToken, async (req, res) => {
  try {
    const { status, latitude, longitude, location, remarks, scannedBy, updatedBy } = req.body;
    const assetId = decodeURIComponent(req.params.assetId);
    const asset = await Asset.findOne({ assetId });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });

    if (status) asset.status = status;
    if (latitude != null) asset.latitude = latitude;
    if (longitude != null) asset.longitude = longitude;
    if (location) asset.location = location;
    asset.lastUpdated = new Date();
    asset.updatedBy = updatedBy || scannedBy || 'Mobile Scan';
    await asset.save();

    const ScanHistory = require('../models/ScanHistory');
    await ScanHistory.create({
      assetId: asset.assetId,
      assetName: asset.assetName,
      location: location || '',
      latitude,
      longitude,
      status: status || asset.status,
      remarks: remarks || '',
      scannedBy: scannedBy || 'Mobile Scan',
      updatedBy: updatedBy || null,
      scannedAt: new Date(),
    });

    const assetObj = asset.toObject();
    delete assetObj.qrCode;
    res.json({ message: 'Asset updated successfully', asset: assetObj });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Public location history — no auth needed
router.get('/public/:assetId/history', async (req, res) => {
  try {
    const ScanHistory = require('../models/ScanHistory');
    const assetId = decodeURIComponent(req.params.assetId);
    const history = await ScanHistory.find({ assetId })
      .sort({ scannedAt: -1 })
      .limit(20)
      .select('-__v');
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Get asset by MongoDB _id
router.get('/:id', async (req, res) => {
  try {
    const asset = await Asset.findById(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json(asset);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Create asset
router.post('/', async (req, res) => {
  const asset = new Asset(req.body);
  try {
    await asset.save();
    res.status(201).json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Update asset
router.put('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndUpdate(req.params.id, req.body, { new: true });
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json(asset);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Delete asset
router.delete('/:id', async (req, res) => {
  try {
    const asset = await Asset.findByIdAndDelete(req.params.id);
    if (!asset) return res.status(404).json({ message: 'Asset not found' });
    res.json({ message: 'Asset deleted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
