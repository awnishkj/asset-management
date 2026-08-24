const express = require('express');
const router = express.Router();
const Asset = require('../models/Asset');

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

// Public update asset from mobile QR scan — no auth needed
router.post('/public/:assetId/update', async (req, res) => {
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
