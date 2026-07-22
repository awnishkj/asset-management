const express = require('express');
const router = express.Router();
const ScanHistory = require('../models/ScanHistory');

// Get scan history
router.get('/', async (req, res) => {
  try {
    const history = await ScanHistory.find().sort({ scannedAt: -1 }).limit(100);
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Add scan record
router.post('/', async (req, res) => {
  const record = new ScanHistory(req.body);
  try {
    await record.save();
    res.status(201).json(record);
  } catch (error) {
    res.status(400).json({ message: error.message });
  }
});

// Get asset scan history
router.get('/asset/:assetId', async (req, res) => {
  try {
    const history = await ScanHistory.find({ assetId: req.params.assetId }).sort({ scannedAt: -1 });
    res.json(history);
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
