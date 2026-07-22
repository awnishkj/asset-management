const express = require('express');
const router = express.Router();
const QRCode = require('qrcode');
const Asset = require('../models/Asset');

// Generate QR code
router.post('/generate', async (req, res) => {
  try {
    const { assetId, assetName } = req.body;

    const qrData = JSON.stringify({
      assetId,
      assetName,
      timestamp: new Date().toISOString()
    });

    const qrCode = await QRCode.toDataURL(qrData);

    // Update asset with QR code
    await Asset.findOneAndUpdate(
      { assetId },
      { qrCode },
      { new: true }
    );

    res.json({ qrCode });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

// Decode QR code
router.post('/decode', async (req, res) => {
  try {
    const { qrData } = req.body;
    const decodedData = JSON.parse(Buffer.from(qrData, 'base64').toString());
    res.json(decodedData);
  } catch (error) {
    res.status(400).json({ message: 'Invalid QR code' });
  }
});

module.exports = router;
